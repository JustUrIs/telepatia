import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, writeFileSync, mkdtempSync, mkdirSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runPipeline } from '../src/audit/pipeline.js';
import { explainVerdict, checksDigest } from '../src/audit/explain.js';
import { FakeBackend } from '../src/audit/backend.js';
import { STAGES, isVerdict } from '../src/shared/contract.js';
import { INVOICE, TODAY } from './_invoice.js';

const url = (n) => new URL(`../fixtures/${n}`, import.meta.url);
const clean = JSON.parse(readFileSync(url('ocr-invoice-clean.json'), 'utf8'));
const TXS = JSON.parse(readFileSync(url('statement-normalized.json'), 'utf8'));

function tmpDoc(content = 'documento de prueba') {
  const dir = mkdtempSync(join(tmpdir(), 'tel-pipe-'));
  const path = join(dir, 'document.bin');
  writeFileSync(path, content);
  return { path, ledgerPath: join(dir, 'ledger.json') };
}
const backend = (over = {}) => new FakeBackend({ blocks: clean, extraction: INVOICE, ...over });

test('el pipeline completo produce un Verdict válido', async () => {
  const { path, ledgerPath } = tmpDoc();
  const r = await runPipeline({ documentPath: path, transactions: TXS, backend: backend(),
    today: TODAY, ledgerPath, persist: false });
  assert.equal(r.ok, true, JSON.stringify(r.failure));
  assert.equal(isVerdict(r.verdict), true);
  assert.equal(r.verdict.verdict, 'pass');
  assert.ok(r.verdict.matched, 'debería haber matcheado la transferencia');
});

test('metrics tiene una entrada por CADA etapa de STAGES', async () => {
  const { path, ledgerPath } = tmpDoc();
  const r = await runPipeline({ documentPath: path, transactions: TXS, backend: backend(),
    today: TODAY, ledgerPath, persist: false });
  assert.equal(r.metrics.stages.length, STAGES.length);
  assert.deepEqual(r.metrics.stages.map((s) => s.stage), STAGES);
  // scan/assemble los hizo el receptor óptico: figuran como skipped, no ausentes.
  assert.equal(r.metrics.stages.find((s) => s.stage === 'scan').status, 'skipped');
  for (const s of ['ocr', 'extract', 'ground', 'reconcile', 'match', 'verdict']) {
    const entry = r.metrics.stages.find((x) => x.stage === s);
    assert.equal(entry.status, 'ok', `${s}: ${entry.error ?? ''}`);
    assert.ok(typeof entry.ms === 'number');
  }
  assert.ok(typeof r.metrics.totalMs === 'number');
  assert.equal(r.metrics.documentBytes > 0, true);
});

test('si explain() falla, explanation queda null y el veredicto NO cambia', async () => {
  const { path, ledgerPath } = tmpDoc();
  const base = await runPipeline({ documentPath: path, transactions: TXS, backend: backend(),
    today: TODAY, ledgerPath, persist: false });
  const broken = await runPipeline({ documentPath: path, transactions: TXS,
    backend: backend({ failOn: ['explain'] }), today: TODAY, ledgerPath, persist: false });
  assert.equal(broken.ok, true);
  assert.equal(broken.verdict.explanation, null);
  assert.equal(broken.verdict.verdict, base.verdict.verdict);
  assert.deepEqual(broken.verdict.checks.map((c) => c.ok), base.verdict.checks.map((c) => c.ok));
});

test('explanation llega cuando el backend responde', async () => {
  const { path, ledgerPath } = tmpDoc();
  const r = await runPipeline({ documentPath: path, transactions: TXS,
    backend: backend({ explanation: 'Todo cierra.' }), today: TODAY, ledgerPath, persist: false });
  assert.equal(r.verdict.explanation, 'Todo cierra.');
});

test('un OCR que falla produce un Failure tipado, no una excepción', async () => {
  const { path, ledgerPath } = tmpDoc();
  const r = await runPipeline({ documentPath: path, backend: backend({ failOn: ['ocr'] }),
    today: TODAY, ledgerPath, persist: false });
  assert.equal(r.ok, false);
  assert.equal(r.failure.stage, 'ocr');
  assert.equal(r.metrics.stages.find((s) => s.stage === 'ocr').status, 'error');
});

test('un OCR vacío se reporta como documento ilegible', async () => {
  const { path, ledgerPath } = tmpDoc();
  const r = await runPipeline({ documentPath: path, backend: backend({ blocks: [] }),
    today: TODAY, ledgerPath, persist: false });
  assert.equal(r.ok, false);
  assert.equal(r.failure.code, 'emptyDocument');
});

test('una extracción que no cumple el schema se corta en extract', async () => {
  const { path, ledgerPath } = tmpDoc();
  const r = await runPipeline({ documentPath: path,
    backend: backend({ extraction: { ...INVOICE, approved: true } }),
    today: TODAY, ledgerPath, persist: false });
  assert.equal(r.ok, false);
  assert.equal(r.failure.stage, 'extract');
  assert.equal(r.failure.code, 'malformedExtraction');
  assert.match(r.failure.message, /approved/);
});

test('un documento vacío se detecta antes de gastar el modelo', async () => {
  const { path, ledgerPath } = tmpDoc('');
  const b = backend();
  const r = await runPipeline({ documentPath: path, backend: b, today: TODAY, ledgerPath, persist: false });
  assert.equal(r.ok, false);
  assert.equal(r.failure.code, 'emptyDocument');
  assert.equal(b.calls.ocr, 0, 'no debería haber llamado al OCR');
});

test('persist escribe verdict.json y metrics.json', async () => {
  const dir = mkdtempSync(join(tmpdir(), 'tel-run-'));
  const path = join(dir, 'document.bin');
  writeFileSync(path, 'x');
  const cwd = process.cwd();
  process.chdir(dir);
  try {
    mkdirSync('runs', { recursive: true });
    const r = await runPipeline({ documentPath: path, transactions: TXS, backend: backend(),
      today: TODAY, docId: 0xdeadbeef, ledgerPath: join(dir, 'ledger.json'), persist: true });
    assert.equal(r.ok, true);
    const written = JSON.parse(readFileSync('runs/deadbeef/metrics.json', 'utf8'));
    assert.equal(written.docId, 'deadbeef');
    assert.equal(written.stages.length, STAGES.length);
    assert.ok(JSON.parse(readFileSync('runs/deadbeef/verdict.json', 'utf8')).verdict);
  } finally { process.chdir(cwd); }
});

test('el reporte de hardware viaja en las métricas', async () => {
  const { path, ledgerPath } = tmpDoc();
  const res = { cpuCount: 8, totalRamMB: 32768, gpu: 'none' };
  const r = await runPipeline({ documentPath: path, transactions: TXS, backend: backend(),
    today: TODAY, ledgerPath, persist: false, systemResources: res });
  assert.deepEqual(r.metrics.systemResources, res);
});

test('runPipeline valida sus argumentos', async () => {
  await assert.rejects(() => runPipeline({ documentPath: 'x' }), TypeError);
  await assert.rejects(() => runPipeline({ backend: backend() }), TypeError);
  await assert.rejects(() => runPipeline(null), TypeError);
});

test('checksDigest no explota con entrada basura y recorta', () => {
  assert.deepEqual(checksDigest(null), []);
  assert.equal(checksDigest(Array.from({ length: 100 }, (_, i) => ({ id: `c${i}`, ok: true }))).length, 24);
});

test('explainVerdict devuelve null ante un backend inservible', async () => {
  assert.equal(await explainVerdict(null, [{ id: 'a', ok: true }]), null);
  assert.equal(await explainVerdict({}, [{ id: 'a', ok: true }]), null);
  assert.equal(await explainVerdict(new FakeBackend({ explanation: '   ' }), [{ id: 'a', ok: true }]), null);
});
