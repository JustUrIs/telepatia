// Los dos bloques, juntos.
//
// Cada bloque pasa sus propios tests. Estos ejercitan la costura, que es donde
// aparecen los bugs que ninguno de los dos puede ver solo: el CSV que parsea el
// Bloque A alimentando el matcher del Bloque B, el documento que reconstruye el
// receptor entrando al pipeline, y el ledger de duplicados sobreviviendo entre
// dos corridas.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, mkdtempSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { isTransaction, isVerdict } from '../src/shared/contract.js';
import { parseCsv } from '../src/csv/parse.js';
import { normalize } from '../src/csv/normalize.js';
import { encodeDocument, carousel, cycleFrames, FrameDecoder } from '../src/optical/protocol.js';
import { runPipeline } from '../src/audit/pipeline.js';
import { FakeBackend } from '../src/audit/backend.js';
import { docIdDe, cargarExtracto } from '../bin/audit.mjs';
import { INVOICE, TODAY } from './_invoice.js';

const BLOQUES = JSON.parse(readFileSync('fixtures/ocr-invoice-clean.json', 'utf8'));
const INYECTADOS = JSON.parse(readFileSync('fixtures/ocr-invoice-injected.json', 'utf8'));
const DOCUMENTO = 'fixtures/document-small.bin';

const ledgerTemporal = () => join(mkdtempSync(join(tmpdir(), 'tel-int-')), 'ledger.json');

const backend = (blocks = BLOQUES, extraction = INVOICE) =>
  new FakeBackend({ blocks, extraction });

/** El pipeline completo, con el extracto real pasando por T-07 y T-08. */
async function auditar(opciones = {}) {
  const { transactions } = cargarExtracto('fixtures/statement.csv');
  return runPipeline({
    documentPath: DOCUMENTO,
    transactions,
    backend: opciones.backend ?? backend(),
    docId: docIdDe(readFileSync(DOCUMENTO)),
    today: TODAY,
    ledgerPath: opciones.ledgerPath ?? ledgerTemporal(),
    persist: false,
    ...opciones.extra,
  });
}

test('el extracto del Bloque A alimenta al matcher del Bloque B', async () => {
  const resultado = await auditar();

  assert.equal(resultado.ok, true, JSON.stringify(resultado.failure));
  assert.ok(isVerdict(resultado.verdict));
  assert.equal(resultado.verdict.verdict, 'pass');

  // La transacción que matcheó salió del CSV crudo, pasando por parseCsv y
  // normalize: si el Bloque A cambia la forma del Transaction, esto se rompe.
  const { matched } = resultado.verdict;
  assert.ok(isTransaction(matched));
  assert.equal(matched.amount, 421820.52);
  assert.equal(matched.ref, 'TRF-99812');
  assert.equal(matched.date, '2026-09-02');
});

test('las transacciones que produce el Bloque A son las que el contrato exige', () => {
  const { transactions, rejected } = cargarExtracto('fixtures/statement.csv');
  assert.equal(transactions.length, 5);
  assert.ok(transactions.every(isTransaction));

  // Y lo que no normaliza sale a la vista, no se descarta.
  assert.equal(rejected.length, 1);
  assert.equal(rejected[0].stage, 'csv');
});

test('REGRESION: el ledger se escribe aunque el pipeline apague el artefacto', async () => {
  // El pipeline pasa `persist:false` a buildVerdict porque escribe el artefacto
  // el mismo, ya enriquecido. Ese flag tambien gobernaba el ledger, asi que el
  // check de duplicado NO PODIA dispararse nunca por el camino del pipeline:
  // dos modulos correctos, un bug que solo existe cuando se unen.
  const ledgerPath = ledgerTemporal();

  const primera = await auditar({ ledgerPath, extra: { persist: true } });
  assert.equal(primera.verdict.verdict, 'pass');
  assert.ok(existsSync(ledgerPath), 'el ledger no se escribio');

  const segunda = await auditar({ ledgerPath, extra: { persist: true } });
  assert.equal(segunda.verdict.verdict, 'fail', 'la misma factura paso dos veces');

  const duplicado = segunda.verdict.checks.find((c) => c.id === 'invoice_not_duplicate');
  assert.equal(duplicado.ok, false);
  assert.match(String(duplicado.actual), /ya vista/i);
});

test('una factura en revision NO entra al ledger: puede volver legitimamente', async () => {
  const ledgerPath = ledgerTemporal();

  const revision = await auditar({
    backend: backend(INYECTADOS),
    ledgerPath,
    extra: { persist: true },
  });
  assert.equal(revision.verdict.verdict, 'review');
  assert.equal(existsSync(ledgerPath), false, 'una factura en revision se registro');
});

test('una inyeccion de prompt no puede aprobar la factura', async () => {
  const resultado = await auditar({ backend: backend(INYECTADOS) });

  assert.equal(resultado.verdict.verdict, 'review');
  assert.ok(resultado.verdict.ungrounded.length > 0, 'la inyeccion paso sin marcarse');

  // Los checks aritmeticos siguen dando bien: el documento no miente en los
  // numeros, miente en las instrucciones. Lo que la frena es el grounding, no
  // que las cuentas no cierren.
  const aritmetica = resultado.verdict.checks.find((c) => c.id === 'subtotal_plus_tax_equals_total');
  assert.equal(aritmetica.ok, true);
});

test('el documento que reconstruye el receptor es el que audita el pipeline', () => {
  // La cadena completa del transporte, sin camara: lo que sale del carrusel y
  // vuelve a armarse tiene el mismo docId con el que el pipeline nombra la
  // corrida. Sin esto, runs/<docId>/ apuntaria a otro documento.
  const bytes = readFileSync(DOCUMENTO);
  const enc = encodeDocument(bytes, { compress: false });
  const dec = new FrameDecoder();

  const gen = carousel(enc);
  const vuelta = cycleFrames(enc.manifest);
  for (let i = 0; i < vuelta * 2 && !dec.complete; i++) dec.push(gen.next().value);

  assert.equal(dec.complete, true);
  const { document } = dec.assemble();
  assert.deepEqual(Buffer.from(document), bytes);
  assert.equal(docIdDe(document), docIdDe(bytes));
  assert.equal(docIdDe(document), enc.docId);
});

test('un documento que no existe falla en assemble, no mas adelante', async () => {
  const { transactions } = cargarExtracto('fixtures/statement.csv');
  const resultado = await runPipeline({
    documentPath: 'fixtures/no-existe.bin',
    transactions,
    backend: backend(),
    persist: false,
  });

  assert.equal(resultado.ok, false);
  assert.equal(resultado.failure.stage, 'assemble');
  assert.equal(resultado.failure.code, 'emptyDocument');
});

test('las metricas cubren las etapas que corrieron, con tiempos reales', async () => {
  const resultado = await auditar();
  const corridas = resultado.metrics.stages.filter((e) => e && Number.isFinite(e.ms));

  for (const etapa of ['ocr', 'extract', 'ground', 'reconcile', 'match', 'verdict']) {
    const encontrada = corridas.find((e) => e.stage === etapa);
    assert.ok(encontrada, `falta la etapa ${etapa} en las metricas`);
    assert.ok(encontrada.ms >= 0);
  }
  assert.ok(resultado.metrics.totalMs > 0);
  assert.equal(resultado.metrics.outcome, 'pass');
});
