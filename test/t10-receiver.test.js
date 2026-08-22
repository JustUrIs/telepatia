import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { renderVerdict, renderFailure, progressLabel } from '../src/ui/receiver.js';
import { FAILURE_CODES } from '../src/shared/contract.js';
import { encodeDocument, FrameDecoder } from '../src/optical/protocol.js';

const sample = JSON.parse(readFileSync(new URL('../fixtures/verdict-sample.json', import.meta.url), 'utf8'));

test('renderVerdict produce una fila por check, con su evidencia', () => {
  const view = renderVerdict(sample);
  assert.equal(view.rows.length, sample.checks.length);
  assert.equal(view.status, 'review');
  for (const row of view.rows) {
    assert.equal(typeof row.id, 'string');
    assert.ok(Array.isArray(row.evidence));
    assert.ok(row.evidence.every((e) => e.bbox === null || e.bbox.length === 4));
  }
  // El check que falla en el fixture tiene que quedar marcado.
  assert.equal(view.failedCount, 1);
  assert.equal(view.rows.find((r) => r.id === 'issue_date_not_future').tone, 'bad');
});

test('renderVerdict marca visualmente los campos sin anclar', () => {
  const view = renderVerdict(sample);
  assert.equal(view.hasUngrounded, true);
  assert.equal(view.ungrounded.length, 1);
  assert.equal(view.ungrounded[0].key, 'supplierTaxId');
  assert.equal(view.ungrounded[0].tone, 'warn');
});

test('renderVerdict cubre los tres estados con títulos y tonos distintos', () => {
  const seen = new Map();
  for (const status of ['pass', 'fail', 'review']) {
    const v = renderVerdict({ ...sample, verdict: status });
    seen.set(status, [v.title, v.tone]);
  }
  const titles = [...seen.values()].map(([t]) => t);
  assert.equal(new Set(titles).size, 3, 'los tres estados deben tener títulos distintos');
  assert.equal(seen.get('pass')[1], 'ok');
  assert.equal(seen.get('fail')[1], 'bad');
  assert.equal(seen.get('review')[1], 'warn');
});

test('renderFailure da mensajes distintos y no vacíos para los tres códigos', () => {
  const codes = [FAILURE_CODES.digestMismatch, FAILURE_CODES.ungroundedFields, FAILURE_CODES.unsupportedVersion];
  const texts = codes.map((code) =>
    renderFailure({ stage: 'assemble', code, message: 'x' }).text);
  assert.equal(new Set(texts).size, 3);
  for (const t of texts) assert.ok(t.length > 20, `mensaje demasiado corto: ${t}`);
  // Una versión no soportada no es recuperable reintentando.
  assert.equal(renderFailure({ stage: 'scan', code: FAILURE_CODES.unsupportedVersion, message: 'x' }).recoverable, false);
  assert.equal(renderFailure({ stage: 'assemble', code: FAILURE_CODES.digestMismatch, message: 'x' }).recoverable, true);
});

test('renderVerdict y renderFailure rechazan entrada inválida en vez de renderizar basura', () => {
  assert.throws(() => renderVerdict({ verdict: 'quizás', checks: [], ungrounded: [], matched: null }), TypeError);
  assert.throws(() => renderVerdict(null), TypeError);
  assert.throws(() => renderFailure({ stage: 'inexistente', code: 'x', message: 'y' }), TypeError);
});

test('progressLabel refleja el estado del decoder, incluido el recuento de paridad', () => {
  const decoder = new FrameDecoder();
  assert.equal(progressLabel(decoder).percent, 0);
  assert.match(progressLabel(decoder).text, /Buscando/);

  const doc = Buffer.from('x'.repeat(5000));
  const enc = encodeDocument(doc, { chunkSize: 300, parityWindow: 4, compress: false });
  decoder.push(enc.frames.manifest);
  for (const f of enc.frames.data) decoder.push(f);
  const p = progressLabel(decoder);
  assert.equal(p.percent, 100);
  assert.match(p.text, /bloques/);
});
