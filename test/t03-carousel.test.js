import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import {
  KIND, MANIFEST_EVERY, parseFrame, encodeDocument, carousel,
} from '../src/optical/protocol.js';

const FIXTURE = readFileSync('fixtures/document-small.bin');

/** 46 frames de datos + 6 de paridad: un ciclo entra holgado en 200 emisiones. */
const encoded = () => encodeDocument(FIXTURE, { compress: false, chunkSize: 900 });

/** Toma n frames del generador infinito, ya parseados. */
function take(gen, n) {
  const out = [];
  for (const raw of gen) {
    out.push(parseFrame(raw));
    if (out.length === n) break;
  }
  return out;
}

test('carousel es un generador infinito', () => {
  const gen = carousel(encoded());
  assert.equal(typeof gen.next, 'function');
  assert.equal(typeof gen[Symbol.iterator], 'function');
  const primeros = take(gen, 5000);
  assert.equal(primeros.length, 5000, 'el generador se agotó: debía ser infinito');
  assert.ok(primeros.every((f) => f !== null), 'todo frame emitido tiene que parsear');
});

test('el primer frame emitido es el MANIFEST', () => {
  const [primero] = take(carousel(encoded()), 1);
  assert.equal(primero.kind, KIND.MANIFEST);
});

test('aparece un MANIFEST al menos cada 12 frames', () => {
  const frames = take(carousel(encoded()), 200);
  const posiciones = frames.flatMap((f, i) => (f.kind === KIND.MANIFEST ? [i] : []));

  assert.ok(posiciones.length > 1);
  assert.equal(posiciones[0], 0);
  assert.equal(MANIFEST_EVERY, 12);

  let previa = posiciones[0];
  for (const pos of posiciones.slice(1)) {
    assert.ok(pos - previa <= MANIFEST_EVERY, `hueco de ${pos - previa} frames sin manifest`);
    previa = pos;
  }
  // Y ninguna ventana de 12 frames consecutivos queda sin manifest.
  for (let i = 0; i + MANIFEST_EVERY <= frames.length; i++) {
    const ventana = frames.slice(i, i + MANIFEST_EVERY);
    assert.ok(ventana.some((f) => f.kind === KIND.MANIFEST), `ventana en ${i} sin manifest`);
  }
});

test('un ciclo cubre todos los índices de datos del 0 al total-1', () => {
  const enc = encoded();
  const frames = take(carousel(enc), 200);

  const vistos = new Set(frames.filter((f) => f.kind === KIND.DATA).map((f) => f.index));
  assert.equal(vistos.size, enc.manifest.total);
  for (let i = 0; i < enc.manifest.total; i++) {
    assert.ok(vistos.has(i), `falta el frame de datos ${i}`);
  }
});

test('un ciclo cubre todas las ventanas de paridad', () => {
  const enc = encoded();
  const frames = take(carousel(enc), 200);
  const vistos = new Set(frames.filter((f) => f.kind === KIND.PARITY).map((f) => f.index));
  assert.equal(vistos.size, enc.frames.parity.length);
});

test('la paridad va intercalada con los datos de su ventana, no toda al final', () => {
  const enc = encoded();
  const frames = take(carousel(enc), 200).filter((f) => f.kind !== KIND.MANIFEST);

  const primeraParidad = frames.findIndex((f) => f.kind === KIND.PARITY);
  const ultimoDato = frames.findLastIndex((f) => f.kind === KIND.DATA);
  assert.ok(primeraParidad < ultimoDato, 'la paridad aparece recién después de todos los datos');

  // La paridad de la ventana w llega justo después de los datos de esa ventana.
  const { parityWindow } = enc.manifest;
  const idx = frames.findIndex((f) => f.kind === KIND.PARITY && f.index === 0);
  const antes = frames.slice(0, idx).filter((f) => f.kind === KIND.DATA).map((f) => f.index);
  assert.deepEqual(antes, [...Array(parityWindow).keys()]);
});

test('la paridad de la ventana 0 es el XOR de sus chunks rellenados a chunkSize', () => {
  const enc = encoded();
  const { chunkSize, parityWindow } = enc.manifest;

  const chunks = enc.frames.data
    .slice(0, parityWindow)
    .map((raw) => parseFrame(raw).payload);

  const esperado = Buffer.alloc(chunkSize);
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) esperado[i] ^= chunk[i];
  }

  const paridad = parseFrame(enc.frames.parity[0]).payload;
  assert.equal(paridad.length, chunkSize);
  assert.deepEqual(paridad, esperado);
});

test('la paridad de la última ventana rellena el chunk corto con ceros', () => {
  const enc = encodeDocument(FIXTURE, { compress: false, chunkSize: 900 });
  const { chunkSize, parityWindow, total } = enc.manifest;
  const w = enc.frames.parity.length - 1;

  const chunks = enc.frames.data
    .slice(w * parityWindow, total)
    .map((raw) => parseFrame(raw).payload);
  assert.ok(chunks.at(-1).length < chunkSize, 'este caso necesita un último chunk corto');

  const esperado = Buffer.alloc(chunkSize);
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) esperado[i] ^= chunk[i];
  }
  assert.deepEqual(parseFrame(enc.frames.parity[w]).payload, esperado);
});

test('carousel acepta tanto el resultado de encodeDocument como {frames} pelado', () => {
  const enc = encoded();
  const a = take(carousel(enc), 60).map((f) => `${f.kind}:${f.index}`);
  const b = take(carousel({ frames: enc.frames }), 60).map((f) => `${f.kind}:${f.index}`);
  assert.deepEqual(b, a, 'el parityWindow se lee del propio frame de manifest');
});

test('un documento de un solo chunk sigue emitiendo un carrusel válido', () => {
  const enc = encodeDocument(Buffer.from('hola', 'utf8'), { compress: false });
  assert.equal(enc.manifest.total, 1);

  const frames = take(carousel(enc), 40);
  assert.equal(frames[0].kind, KIND.MANIFEST);
  assert.ok(frames.some((f) => f.kind === KIND.DATA && f.index === 0));
  assert.ok(frames.some((f) => f.kind === KIND.PARITY && f.index === 0));
});
