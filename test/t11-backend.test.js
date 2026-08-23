import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { FakeBackend, BackendError } from '../src/audit/backend.js';
import { isBackend, isOcrBlock, BACKEND_METHODS } from '../src/shared/contract.js';

const clean = JSON.parse(readFileSync(new URL('../fixtures/ocr-invoice-clean.json', import.meta.url), 'utf8'));

test('FakeBackend cumple la interfaz del contrato', () => {
  const b = new FakeBackend();
  assert.equal(isBackend(b), true);
  for (const m of BACKEND_METHODS) assert.equal(typeof b[m], 'function', `falta ${m}()`);
});

test('ocr() devuelve bloques que pasan isOcrBlock', async () => {
  const b = new FakeBackend({ blocks: clean });
  await b.init();
  const blocks = await b.ocr('/ruta/factura.png');
  assert.ok(blocks.length > 0);
  assert.ok(blocks.every(isOcrBlock));
});

test('ocr() descarta bloques malformados en vez de propagarlos', async () => {
  const b = new FakeBackend({ blocks: [...clean, { text: 'sin bbox' }, null, { text: 'x', bbox: [1, 2], confidence: 0.5 }] });
  const blocks = await b.ocr('/x.png');
  assert.equal(blocks.length, clean.length);
});

test('es determinista: dos llamadas iguales dan salida idéntica', async () => {
  const b = new FakeBackend({ blocks: clean, extraction: { total: 421820.52 } });
  const a1 = await b.ocr('/x.png');
  const a2 = await b.ocr('/x.png');
  assert.deepEqual(a1, a2);
  assert.deepEqual(await b.extract([], {}), await b.extract([], {}));
});

test('devuelve copias, no referencias al estado interno', async () => {
  const b = new FakeBackend({ blocks: clean });
  const first = await b.ocr('/x.png');
  first[0].text = 'MUTADO';
  const second = await b.ocr('/x.png');
  assert.notEqual(second[0].text, 'MUTADO');
});

test('rechaza entradas inválidas con BackendError tipado', async () => {
  const b = new FakeBackend();
  await assert.rejects(() => b.ocr(''), (e) => e instanceof BackendError && e.code === 'emptyDocument');
  await assert.rejects(() => b.extract('no es array', {}), BackendError);
  await assert.rejects(() => b.extract([], null), BackendError);
  await assert.rejects(() => b.explain('no es array'), BackendError);
});

test('failOn simula respuestas inesperadas del SDK en cada método', async () => {
  for (const method of ['init', 'ocr', 'extract', 'explain']) {
    const b = new FakeBackend({ blocks: clean, failOn: [method] });
    const call = { init: () => b.init(), ocr: () => b.ocr('/x.png'),
      extract: () => b.extract([], {}), explain: () => b.explain([]) }[method];
    await assert.rejects(call, (e) => e instanceof BackendError, `${method} debía fallar`);
  }
});

test('dispose() es idempotente y no lanza', async () => {
  const b = new FakeBackend();
  await b.init();
  await b.dispose();
  await b.dispose();
  assert.equal(b.calls.dispose, 2);
  assert.equal(b.ready, false);
});
