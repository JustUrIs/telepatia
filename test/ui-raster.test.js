import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { encodeDocument } from '../src/optical/protocol.js';
import { frameToMatrix } from '../src/optical/render.js';
import { scanRgba } from '../src/optical/scan.js';
import { rasterizeMatrix, escalaEntera, tamanoDisplay, MARGEN } from '../src/ui/raster.js';

const FIXTURE = readFileSync('fixtures/document-small.bin');
const matriz = () => frameToMatrix(
  encodeDocument(FIXTURE, { compress: false, chunkSize: 900 }).frames.data[0],
);

const BLANCO = 0xffffffff;
const NEGRO = 0xff000000;

test('el raster mide modulos + 2 margenes, un modulo por pixel', () => {
  const m = matriz();
  const r = rasterizeMatrix(m);
  assert.equal(r.size, m.size + 2 * MARGEN);
  assert.equal(r.pixels.length, r.size ** 2);
});

test('la quiet zone queda blanca entera', () => {
  const r = rasterizeMatrix(matriz(), 4);
  for (let y = 0; y < 4; y++) {
    for (let x = 0; x < r.size; x++) {
      assert.equal(r.pixels[y * r.size + x], BLANCO, `fila superior ${y},${x}`);
      assert.equal(r.pixels[(r.size - 1 - y) * r.size + x], BLANCO, `fila inferior ${y},${x}`);
    }
  }
});

test('cada modulo oscuro cae en su pixel, corrido por el margen', () => {
  const m = matriz();
  const r = rasterizeMatrix(m, 4);
  for (let y = 0; y < m.size; y++) {
    for (let x = 0; x < m.size; x++) {
      const esperado = m.data[y * m.size + x] ? NEGRO : BLANCO;
      assert.equal(r.pixels[(y + 4) * r.size + (x + 4)], esperado, `modulo ${x},${y}`);
    }
  }
});

test('el patron de busqueda de la esquina aparece donde tiene que estar', () => {
  // Todo QR arranca con un cuadrado 7x7 oscuro arriba a la izquierda.
  const r = rasterizeMatrix(matriz(), 4);
  for (let y = 4; y < 11; y++) {
    assert.equal(r.pixels[y * r.size + 4], NEGRO);
    assert.equal(r.pixels[y * r.size + 10], NEGRO);
  }
  // Y su centro hueco: el anillo blanco a un modulo adentro.
  assert.equal(r.pixels[5 * r.size + 5], BLANCO);
});

test('un raster escalado sigue decodificando: la cadena entera cierra', () => {
  const frame = encodeDocument(FIXTURE, { compress: false, chunkSize: 900 }).frames.data[0];
  const r = rasterizeMatrix(frameToMatrix(frame), 4);

  // Escalado entero con vecino mas cercano, que es lo que hace drawImage con
  // imageSmoothingEnabled en false.
  const escala = 3;
  const lado = r.size * escala;
  const rgba = new Uint8ClampedArray(lado * lado * 4);
  const vista = new Uint32Array(rgba.buffer);
  for (let y = 0; y < lado; y++) {
    for (let x = 0; x < lado; x++) {
      vista[y * lado + x] = r.pixels[Math.floor(y / escala) * r.size + Math.floor(x / escala)];
    }
  }

  const salida = scanRgba(rgba, lado, lado);
  assert.notEqual(salida, null, 'el raster escalado no decodifico');
  assert.deepEqual(Buffer.from(salida), Buffer.from(frame));
});

test('margen cero no rompe, aunque el QR quede sin quiet zone', () => {
  const m = matriz();
  const r = rasterizeMatrix(m, 0);
  assert.equal(r.size, m.size);
  assert.equal(r.pixels.length, m.size ** 2);
});

test('rasterizeMatrix valida su entrada', () => {
  assert.throws(() => rasterizeMatrix(null), /matriz/i);
  assert.throws(() => rasterizeMatrix({ size: 5 }), /matriz/i);
  assert.throws(() => rasterizeMatrix({ size: 5, data: new Uint8Array(10) }), /inconsistente/i);
  assert.throws(() => rasterizeMatrix(matriz(), -1), /margen/i);
  assert.throws(() => rasterizeMatrix(matriz(), 1.5), /margen/i);
});

test('la escala siempre es entera y nunca menor a 1', () => {
  assert.equal(escalaEntera(109, 720, 720), 6);
  assert.equal(escalaEntera(109, 720, 400), 3);
  assert.equal(escalaEntera(185, 500, 500), 2);
  // Un raster mas grande que el lienzo igual devuelve 1: mejor recortado que
  // con escala fraccionaria, que hace ilegible cada modulo.
  assert.equal(escalaEntera(400, 100, 100), 1);
  assert.ok(Number.isInteger(escalaEntera(109, 733, 651)));
});

test('el tamano de display se acota al 90% del lado corto del viewport', () => {
  assert.equal(tamanoDisplay(1200, 800, 2000), 720);
  assert.equal(tamanoDisplay(400, 900, 2000), 360);
  // Y nunca pasa el ancho del contenedor.
  assert.equal(tamanoDisplay(1200, 800, 300), 300);
  assert.ok(tamanoDisplay(0, 0, 0) >= 1);
});
