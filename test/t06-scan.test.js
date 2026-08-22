import test from 'node:test';
import assert from 'node:assert/strict';

import { encodeDocument, carousel, parseFrame, FrameDecoder } from '../src/optical/protocol.js';
import { frameToMatrix } from '../src/optical/render.js';
import { scanRgba, ScanLoop } from '../src/optical/scan.js';

const MARGIN = 4;
const SCALE = 3;

/**
 * Rasteriza una matriz de módulos a RGBA en memoria: es la cámara del test.
 * Vive acá y no en `src/` a propósito — en produccion ese trabajo lo hace el
 * canvas del navegador.
 */
function rasterize({ size, data }, scale = SCALE, margin = MARGIN) {
  const width = (size + 2 * margin) * scale;
  const rgba = new Uint8ClampedArray(width * width * 4).fill(255);
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!data[y * size + x]) continue;
      for (let dy = 0; dy < scale; dy++) {
        for (let dx = 0; dx < scale; dx++) {
          const px = ((y + margin) * scale + dy) * width + ((x + margin) * scale + dx);
          rgba[px * 4] = 0;
          rgba[px * 4 + 1] = 0;
          rgba[px * 4 + 2] = 0;
        }
      }
    }
  }
  return { rgba, width, height: width };
}

/** Documento chico y determinista: 3 chunks a chunkSize 900. */
const DOC = Buffer.from(Array.from({ length: 2700 }, (_, i) => (i * 37 + 11) & 0xff));
const encodeDoc = () => encodeDocument(DOC, { compress: false, chunkSize: 900 });

test('round-trip sin camara: los bytes salen identicos a los que entraron', () => {
  const enc = encodeDoc();
  for (const raw of [enc.frames.manifest, ...enc.frames.data, ...enc.frames.parity]) {
    const { rgba, width, height } = rasterize(frameToMatrix(raw));
    const salida = scanRgba(rgba, width, height);

    assert.notEqual(salida, null, 'no decodifico un frame que acabamos de renderizar');
    assert.ok(salida instanceof Uint8Array);
    assert.deepEqual(Buffer.from(salida), Buffer.from(raw));
  }
});

test('scanRgba acepta Uint8ClampedArray y Uint8Array por igual', () => {
  const enc = encodeDoc();
  const { rgba, width, height } = rasterize(frameToMatrix(enc.frames.data[0]));

  const desdeClamped = scanRgba(rgba, width, height);
  const desdePlano = scanRgba(new Uint8Array(rgba), width, height);

  assert.deepEqual(desdePlano, desdeClamped);
  assert.deepEqual(Buffer.from(desdeClamped), Buffer.from(enc.frames.data[0]));
});

test('scanRgba devuelve null cuando no hay QR en cuadro', () => {
  const width = 200;
  const blanco = new Uint8ClampedArray(width * width * 4).fill(255);
  assert.equal(scanRgba(blanco, width, width), null);

  const ruido = new Uint8ClampedArray(width * width * 4);
  for (let i = 0; i < ruido.length; i++) ruido[i] = (i * 97) & 0xff;
  assert.equal(scanRgba(ruido, width, width), null);
});

test('scanRgba valida que las dimensiones cierren con el buffer', () => {
  const width = 40;
  const rgba = new Uint8ClampedArray(width * width * 4);
  assert.throws(() => scanRgba(rgba, width, width + 1), /dimensiones|largo/i);
  assert.throws(() => scanRgba(rgba, 0, width), /dimensiones|ancho|alto/i);
  assert.throws(() => scanRgba(null, width, width), /rgba|buffer/i);
});

test('ScanLoop mueve un documento entero del carrusel al decoder', () => {
  const enc = encodeDoc();
  const decoder = new FrameDecoder();
  const gen = carousel(enc);

  const provider = () => rasterize(frameToMatrix(gen.next().value));
  const loop = new ScanLoop(provider, decoder);

  assert.equal(loop.run(60), true, 'no completo el documento en 60 ticks');
  assert.equal(decoder.complete, true);
  assert.deepEqual(Buffer.from(decoder.assemble().document), DOC);

  const { frames, hits, misses, novel, providerErrors } = loop.stats;
  assert.equal(frames, hits + misses);
  assert.equal(misses, 0, 'todo lo que rasterizamos tenia que decodificar');
  assert.ok(novel > 0 && novel <= hits, 'novel cuenta solo lo que aporto informacion');
  assert.equal(providerErrors, 0);
});

test('ScanLoop corta apenas el decoder esta completo, no gasta ticks de mas', () => {
  const enc = encodeDoc();
  const decoder = new FrameDecoder();
  const gen = carousel(enc);
  const loop = new ScanLoop(() => rasterize(frameToMatrix(gen.next().value)), decoder);

  assert.equal(loop.run(200), true);
  const framesAlCompletar = loop.stats.frames;

  assert.equal(loop.run(50), true, 'ya completo: sigue devolviendo true');
  assert.equal(loop.stats.frames, framesAlCompletar, 'no debe pedir mas frames');
});

test('un provider sin senal no cuenta como frame ni como miss', () => {
  const decoder = new FrameDecoder();
  const loop = new ScanLoop(() => null, decoder);

  assert.equal(loop.run(10), false);
  assert.deepEqual(loop.stats, {
    frames: 0, hits: 0, misses: 0, novel: 0, providerErrors: 0,
  });
});

test('un provider que lanza no mata el loop: se cuenta y se sigue', () => {
  const enc = encodeDoc();
  const decoder = new FrameDecoder();
  const gen = carousel(enc);

  let n = 0;
  const provider = () => {
    n++;
    if (n % 3 === 0) throw new Error('camara desconectada');
    return rasterize(frameToMatrix(gen.next().value));
  };

  const loop = new ScanLoop(provider, decoder);
  assert.equal(loop.run(120), true);
  assert.ok(loop.stats.providerErrors > 0);
  assert.deepEqual(Buffer.from(decoder.assemble().document), DOC);
});

test('stop() corta run() en el proximo tick', () => {
  const enc = encodeDoc();
  const decoder = new FrameDecoder();
  const gen = carousel(enc);

  // Ojo: manifest + 3 chunks ya completan este documento, asi que hay que
  // cortar antes del cuarto cuadro para que el corte sea observable.
  let vistos = 0;
  const loop = new ScanLoop(() => {
    vistos++;
    if (vistos === 2) loop.stop();
    return rasterize(frameToMatrix(gen.next().value));
  }, decoder);

  assert.equal(loop.run(200), false, 'lo cortamos antes de completar');
  assert.equal(loop.stats.frames, 2);
  assert.equal(decoder.complete, false);
  assert.equal(loop.stopped, true);
});

test('tick() devuelve el estado de completitud del decoder', () => {
  const enc = encodeDoc();
  const decoder = new FrameDecoder();
  const gen = carousel(enc);
  const loop = new ScanLoop(() => rasterize(frameToMatrix(gen.next().value)), decoder);

  assert.equal(loop.tick(), false, 'un solo frame no completa un documento de 3 chunks');
  while (!loop.tick());
  assert.equal(decoder.complete, true);
});

test('ScanLoop no interpreta el frame: le sirve cualquier decoder con push/complete', () => {
  const enc = encodeDoc();
  const recibidos = [];
  const espia = {
    push(bytes) { recibidos.push(Buffer.from(bytes)); return true; },
    get complete() { return recibidos.length >= 3; },
  };

  const gen = carousel(enc);
  const loop = new ScanLoop(() => rasterize(frameToMatrix(gen.next().value)), espia);
  assert.equal(loop.run(20), true);

  assert.equal(recibidos.length, 3);
  // Lo que el loop entrego son frames AGP1 intactos, pero eso lo sabe el decoder.
  assert.notEqual(parseFrame(recibidos[0]), null);
  assert.equal(loop.stats.novel, 3);
});

test('el constructor rechaza un provider o un decoder que no cumplan la firma', () => {
  const decoder = new FrameDecoder();
  assert.throws(() => new ScanLoop(null, decoder), /provider/i);
  assert.throws(() => new ScanLoop(() => null, null), /decoder/i);
  assert.throws(() => new ScanLoop(() => null, { push: 1 }), /decoder/i);
  assert.throws(() => new ScanLoop(() => null, decoder).run(0), /maxTicks/i);
});
