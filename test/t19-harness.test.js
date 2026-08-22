import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runHarness, runCase, formatReport, LAYERS } from '../src/audit/harness.js';
import { TODAY } from './_invoice.js';

const url = (n) => new URL(`../fixtures/${n}`, import.meta.url);
const corpus = JSON.parse(readFileSync(url('attacks/corpus.json'), 'utf8'));
const TXS = JSON.parse(readFileSync(url('statement-normalized.json'), 'utf8'));
const opts = () => ({ transactions: TXS, today: TODAY,
  ledgerPath: join(mkdtempSync(join(tmpdir(), 'tel-')), 'ledger.json'), persist: false });

test('el corpus tiene al menos 12 casos y las dos familias', () => {
  assert.ok(corpus.length >= 12, `solo ${corpus.length} casos`);
  const families = new Set(corpus.map((c) => c.family));
  assert.ok(families.has('adversarial'), 'falta la familia adversarial');
  assert.ok(families.has('dirty'), 'falta la familia dirty');
  assert.ok(corpus.every((c) => typeof c.id === 'string' && c.id !== ''));
});

test('runHarness devuelve una fila por caso', () => {
  const r = runHarness(corpus, opts());
  assert.equal(r.rows.length, corpus.length);
  for (const row of r.rows) {
    assert.ok(row.blockedBy === null || LAYERS.includes(row.blockedBy), `capa inválida: ${row.blockedBy}`);
    assert.ok(['pass', 'fail', 'review'].includes(row.verdict));
  }
});

test('NINGÚN caso adversario termina en pass', () => {
  const r = runHarness(corpus, opts());
  assert.deepEqual(r.adversarialPassed, [],
    `ataques que pasaron: ${r.adversarialPassed.join(', ')}`);
});

test('ningún caso sucio termina en pass tampoco (entrada mala no se aprueba sola)', () => {
  const r = runHarness(corpus, opts());
  const dirtyPassed = r.rows.filter((x) => x.family === 'dirty' && x.blockedBy === null);
  assert.deepEqual(dirtyPassed.map((x) => x.id), []);
});

test('las tres capas defensivas participan: ninguna queda sin uso', () => {
  const r = runHarness(corpus, opts());
  for (const layer of LAYERS) {
    assert.ok(r.byLayer[layer] > 0, `la capa "${layer}" no cortó ningún caso; el corpus no la ejercita`);
  }
});

test('la capa que corta cada ataque es la esperada', () => {
  const expected = {
    'inject-approve-field': 'schema',
    'inject-free-text': 'schema',
    'inject-empty-object': 'schema',
    'inject-zero-total': 'ground',
    'inject-inflate-total': 'ground',
    'inject-swap-supplier': 'ground',
    'inject-tamper-arithmetic': 'verdict',
    'inject-future-date': 'verdict',
    'inject-negative-tax': 'verdict',
  };
  const rows = new Map(runHarness(corpus, opts()).rows.map((r) => [r.id, r]));
  for (const [id, layer] of Object.entries(expected)) {
    assert.equal(rows.get(id)?.blockedBy, layer,
      `${id}: esperaba corte en "${layer}", fue "${rows.get(id)?.blockedBy}" (${rows.get(id)?.detail})`);
  }
});

test('un caso legítimo SÍ puede pasar: el harness no aprueba nada por defecto', () => {
  const legit = {
    id: 'control-legitimo', family: 'control',
    blocks: JSON.parse(readFileSync(url('ocr-invoice-clean.json'), 'utf8')),
    extraction: JSON.parse(readFileSync(url('../test/_invoice.js'), 'utf8')
      .match(/export const INVOICE = (\{[\s\S]*?\n\});/)[1]
      .replace(/(\w+):/g, '"$1":').replace(/'/g, '"').replace(/,(\s*[}\]])/g, '$1')),
  };
  const row = runCase(legit, opts());
  assert.equal(row.blockedBy, null, `un caso legítimo fue bloqueado: ${row.detail}`);
  assert.equal(row.verdict, 'pass');
});

test('formatReport produce markdown con una fila por caso', () => {
  const md = formatReport(runHarness(corpus, opts()));
  assert.match(md, /\| caso \| familia \|/);
  for (const c of corpus) assert.ok(md.includes(`\`${c.id}\``), `falta ${c.id} en el reporte`);
  assert.match(md, /Cortes por capa/);
});

test('runHarness rechaza un corpus vacío o inválido', () => {
  assert.throws(() => runHarness([]), TypeError);
  assert.throws(() => runHarness(null), TypeError);
});
