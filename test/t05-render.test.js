import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { encodeDocument, HEADER_LEN } from '../src/optical/protocol.js';
import {
  DEFAULT_MARGIN, QR_CAPACITY_L21, frameToMatrix, matrixToPng, pickVersion,
} from '../src/optical/render.js';

const FIXTURE = readFileSync('fixtures/document-small.bin');

/** Un frame de datos real: 900 de payload + 16 de header = 916 bytes. */
function frameDe916() {
  const enc = encodeDocument(FIXTURE, { compress: false, chunkSize: 900 });
  const frame = enc.frames.data[0];
  assert.equal(frame.length, 916);
  return frame;
}

test('pickVersion(900) es 21, y su capacidad byte alcanza para 916', () => {
  assert.equal(pickVersion(900), 21);
  assert.equal(QR_CAPACITY_L21, 929);
  assert.ok(QR_CAPACITY_L21 >= 900 + HEADER_LEN);
});

test('pickVersion elige el minimo, no el primero comodo', () => {
  // V20 a ECC L aguanta 858 bytes: 858 - 16 = 842 de payload.
  assert.equal(pickVersion(842), 20);
  assert.equal(pickVersion(843), 21);
  assert.equal(pickVersion(1), 1);
  // Y es monotona: mas payload nunca puede dar una version menor.
  let previa = 0;
  for (let chunkSize = 1; chunkSize <= 2000; chunkSize += 7) {
    const v = pickVersion(chunkSize);
    assert.ok(v >= previa, `pickVersion(${chunkSize}) = ${v} bajo de ${previa}`);
    previa = v;
  }
});

test('pickVersion respeta el ECC pedido', () => {
  assert.ok(pickVersion(900, 'H') > pickVersion(900, 'L'), 'mas correccion, mas version');
  assert.ok(pickVersion(900, 'M') >= pickVersion(900, 'L'));
  assert.ok(pickVersion(900, 'Q') >= pickVersion(900, 'M'));
});

test('pickVersion lanza si el chunk no entra ni en V40', () => {
  assert.throws(() => pickVersion(65535), /no entra|capacidad/i);
  assert.throws(() => pickVersion(0));
  assert.throws(() => pickVersion(1.5));
  assert.throws(() => pickVersion(900, 'Z'));
});

test('frameToMatrix de un frame de 916 bytes da una matriz cuadrada de lado 101', () => {
  const { size, data } = frameToMatrix(frameDe916());
  assert.equal(size, 101);
  assert.equal(data.length, size * size);
  assert.ok(data instanceof Uint8Array);
  assert.ok(data.every((v) => v === 0 || v === 1), 'la matriz es binaria');
  assert.ok(data.some((v) => v === 1), 'la matriz no puede estar vacia');
});

test('frameToMatrix codifica en modo byte: 0x00 y 0xff sobreviven', () => {
  // En modo alfanumerico o UTF-8 estos bytes no viajan intactos. Que dos payloads
  // binarios distintos den matrices distintas es la senal de que va en byte.
  const enc = encodeDocument(Buffer.alloc(1800, 0x00), { compress: false, chunkSize: 900 });
  const enc2 = encodeDocument(Buffer.alloc(1800, 0xff), { compress: false, chunkSize: 900 });

  const a = frameToMatrix(enc.frames.data[0]);
  const b = frameToMatrix(enc2.frames.data[0]);
  assert.equal(a.size, b.size);
  assert.notDeepEqual(a.data, b.data);
});

test('frameToMatrix acepta una version explicita y respeta el minimo', () => {
  const frame = frameDe916();
  assert.equal(frameToMatrix(frame, { version: 25 }).size, 25 * 4 + 17);
  assert.throws(() => frameToMatrix(frame, { version: 20 }), /.*/);
});

test('frameToMatrix es determinista', () => {
  const frame = frameDe916();
  assert.deepEqual(frameToMatrix(frame).data, frameToMatrix(frame).data);
});

test('matrixToPng arranca con la firma PNG y declara el ancho esperado', async () => {
  const matrix = frameToMatrix(frameDe916());
  const scale = 4;
  const png = await matrixToPng(matrix, scale);

  assert.ok(Buffer.isBuffer(png));
  assert.deepEqual(png.subarray(0, 4), Buffer.from([0x89, 0x50, 0x4e, 0x47]));

  // IHDR: el ancho vive en los bytes 16..19, big-endian.
  const esperado = (matrix.size + 2 * DEFAULT_MARGIN) * scale;
  assert.equal(png.readUInt32BE(16), esperado);
  assert.equal(png.readUInt32BE(20), esperado, 'el QR es cuadrado');
});

test('matrixToPng escala y margen cambian el ancho de forma predecible', async () => {
  const matrix = frameToMatrix(frameDe916());
  for (const scale of [1, 2, 8]) {
    const png = await matrixToPng(matrix, scale);
    assert.equal(png.readUInt32BE(16), (matrix.size + 2 * DEFAULT_MARGIN) * scale);
  }
  const sinMargen = await matrixToPng(matrix, 3, { margin: 0 });
  assert.equal(sinMargen.readUInt32BE(16), matrix.size * 3);
});

test('matrixToPng rechaza una matriz que no cierra', async () => {
  await assert.rejects(() => matrixToPng({ size: 10, data: new Uint8Array(99) }), /matriz/i);
  await assert.rejects(() => matrixToPng(null), /matriz/i);
  await assert.rejects(() => matrixToPng({ size: 21, data: new Uint8Array(441) }, 0), /escala/i);
});
