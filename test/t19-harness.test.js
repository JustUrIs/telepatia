import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { mkdtempSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { runHarness, runCase, formatReport, LAYERS } from '../src/audit/harness.js';
import { TODAY, INVOICE } from './_invoice.js';

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

test('una familia "__proto__" no contamina Object.prototype', () => {
  const antes = Object.keys(Object.prototype).length;
  const r = runHarness([{ id: 'x', family: '__proto__', blocks: [], extraction: {} }], opts());
  assert.equal(r.rows.length, 1);
  assert.equal(Object.prototype.total, undefined, 'escribió en Object.prototype');
  assert.equal(('total' in {}), false);
  assert.equal(Object.keys(Object.prototype).length, antes);
});

test('adversarialPassed cuenta todo lo que no sea control, no solo "adversarial"', () => {
  const legit = JSON.parse(readFileSync(url('ocr-invoice-clean.json'), 'utf8'));
  // Se importa el modulo en vez de leerlo y parsearlo con una regex:
  // `new URL(...).pathname` en Windows devuelve "/C:/..." y con los espacios
  // como %20, asi que readFileSync fallaba con ENOENT sobre una ruta doble.
  const inv = INVOICE;
  // Un caso con familia arbitraria que SÍ pasa: antes la métrica lo ignoraba.
  const r = runHarness([{ id: 'colado', family: 'injection', blocks: legit, extraction: inv }], opts());
  assert.deepEqual(r.adversarialPassed, ['colado']);
});

// ---------------------------------------------------------------------------
// Las dos metricas. Publicar la de bloqueo sola es publicar media verdad.
// ---------------------------------------------------------------------------

test('el corpus tiene facturas legitimas, no solo ataques', () => {
  const controles = corpus.filter((c) => c.family === 'control');
  assert.ok(controles.length >= 4,
    `${controles.length} casos de control: un sistema que rechaza todo saca 100%`);
});

test('ninguna factura legitima se frena: falsos positivos en cero', () => {
  const r = runHarness(corpus, opts());
  assert.equal(r.falsePositiveRate, 0,
    `frenadas de mas: ${r.falsePositives.join(', ')}`);
  assert.deepEqual(r.falsePositives, []);
  assert.equal(r.controlTotal, corpus.filter((c) => c.family === 'control').length);
});

test('ningun ataque llega a pass', () => {
  const r = runHarness(corpus, opts());
  assert.equal(r.blockRate, 1, `pasaron: ${r.adversarialPassed.join(', ')}`);
  assert.deepEqual(r.adversarialPassed, []);
});

test('una inyeccion que evade la lista de marcadores igual se frena', () => {
  // La lista de INSTRUCTION_MARKERS es una lista, y toda lista se evade. Este
  // caso esta en portugues, sin imperativos: ningun marcador lo toca. Si lo
  // frena algo, ese algo no depende de adivinar el idioma del atacante.
  const caso = corpus.find((c) => c.id === 'inject-bypass-filter');
  assert.ok(caso, 'falta el caso de evasion del filtro');

  const r = runCase(caso, opts());
  assert.notEqual(r.blockedBy, null, 'la evasion del filtro llego a pass');
  assert.notEqual(r.blockedBy, 'schema', 'lo corto el schema: no prueba nada del grounding');
});

test('LA MENTIRA COHERENTE: solo la frena el banco', () => {
  // El atacante ESCRIBE la factura: puede poner cualquier numero en los
  // pixeles. Una falsificacion completa y coherente pasa el schema, ancla
  // contra su propio texto, y cierra la aritmetica.
  //
  // Lo unico que queda es una fuente de verdad que el atacante no controla.
  const caso = corpus.find((c) => c.id === 'inject-bypass-coherent');
  assert.ok(caso, 'falta el caso de la mentira coherente');

  const r = runCase(caso, opts());
  assert.equal(r.ungroundedCount, 0, 'la mentira coherente deberia anclar entera');
  assert.deepEqual(r.failedChecks, [], 'la aritmetica de la mentira deberia cerrar');
  assert.equal(r.blockedBy, 'verdict');
  assert.equal(r.verdict, 'review');
  assert.match(r.detail, /bancaria/i, 'lo tiene que frenar la falta de movimiento');
});

test('formatReport publica las dos metricas juntas', () => {
  const texto = formatReport(runHarness(corpus, opts()));
  assert.match(texto, /Tasa de bloqueo/i);
  assert.match(texto, /Tasa de falsos positivos/i);
});
