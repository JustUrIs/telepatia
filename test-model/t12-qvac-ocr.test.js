// [MODELO] Requiere @qvac/sdk con los modelos descargados. NO corre en la suite
// rápida: `npm run test:model`.
//
// Necesita una imagen de factura en fixtures/invoice.png. El repo no la versiona
// (es un binario grande); poné la tuya o generá una con el emisor.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { existsSync } from 'node:fs';
import { QvacBackend } from '../src/audit/qvac-backend.js';
import { isOcrBlock } from '../src/shared/contract.js';

const IMAGE = new URL('../fixtures/invoice.png', import.meta.url).pathname;

test('OCR real sobre una factura devuelve bloques utilizables', async (t) => {
  if (!existsSync(IMAGE)) return t.skip(`falta ${IMAGE}`);
  const backend = new QvacBackend({ onProgress: (which, p) => process.stderr.write(`\r${which} ${p.percentage?.toFixed(0)}%`) });
  try {
    const blocks = await backend.ocr(IMAGE);
    assert.ok(blocks.length >= 1, 'el OCR no devolvió ningún bloque');
    assert.ok(blocks.every(isOcrBlock), 'algún bloque no cumple el contrato');
    assert.ok(blocks.some((b) => /\d/.test(b.text)), 'ningún bloque tiene números: sospechoso en una factura');
  } finally {
    const r = await backend.dispose();
    assert.equal(r.ok, true, `dispose() falló: ${r.errors.join('; ')}`);
  }
});

test('el proceso sale solo después de dispose(): no queda worker colgado', async (t) => {
  if (!existsSync(IMAGE)) return t.skip(`falta ${IMAGE}`);
  const backend = new QvacBackend();
  await backend.init();
  const r = await backend.dispose();
  assert.equal(r.ok, true);
  // Si esto cuelga, hay un worker sin liberar: el síntoma que mata la demo.
});

test('getSystemResources reporta el hardware para el entregable del track', async () => {
  const res = await new QvacBackend().systemResources();
  assert.ok(res === null || typeof res === 'object');
  if (res) console.log('hardware:', JSON.stringify(res));
});
