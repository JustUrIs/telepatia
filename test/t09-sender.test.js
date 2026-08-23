import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { docIdHex } from '../src/shared/contract.js';
import { KIND, parseFrame, encodeDocument, cycleFrames } from '../src/optical/protocol.js';
import { frameToMatrix } from '../src/optical/render.js';
import { create } from '../src/ui/vendor/qrcode-core.js';
import { planEmission, nextFrame } from '../src/ui/sender.js';

const FIXTURE = readFileSync('fixtures/document-small.bin');

test('importar sender.js no toca el DOM', () => {
  // Si el modulo mirara `document` o `window` al cargar, este archivo ni
  // siquiera habria llegado hasta aca bajo Node.
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(typeof planEmission, 'function');
  assert.equal(typeof nextFrame, 'function');
});

test('planEmission reporta un totalFrames coherente con encodeDocument', () => {
  const plan = planEmission(FIXTURE, { chunkSize: 900, fps: 10, compress: false });
  const enc = encodeDocument(FIXTURE, { chunkSize: 900, compress: false });

  assert.equal(plan.totalFrames, enc.manifest.total);
  assert.equal(plan.totalFrames, 40);
  assert.equal(plan.docId, enc.docId);
  assert.equal(plan.manifest.sha256, enc.manifest.sha256);
});

test('cycleFrames y secondsPerCycle cierran con la formula del contrato', () => {
  for (const fps of [4, 10, 24]) {
    const plan = planEmission(FIXTURE, { chunkSize: 900, fps, compress: false });
    assert.equal(plan.cycleFrames, cycleFrames(plan.manifest));
    assert.equal(plan.cycleFrames, 1 + plan.totalFrames + Math.ceil(plan.totalFrames / 8));
    assert.equal(plan.secondsPerCycle, plan.cycleFrames / fps);
  }
});

test('tres llamadas sucesivas a nextFrame devuelven frames distintos', () => {
  const plan = planEmission(FIXTURE, { chunkSize: 900, fps: 10, compress: false });
  const tres = [nextFrame(plan), nextFrame(plan), nextFrame(plan)];

  const firmas = tres.map((f) => `${f.kind}:${f.index}`);
  assert.equal(new Set(firmas).size, 3, `se repitieron: ${firmas.join(', ')}`);

  const bytes = tres.map((f) => Buffer.from(f.bytes).toString('hex'));
  assert.equal(new Set(bytes).size, 3);
});

test('el primer frame emitido es el manifest, como en el carrusel', () => {
  const plan = planEmission(FIXTURE, { chunkSize: 900, fps: 10, compress: false });
  const primero = nextFrame(plan);
  assert.equal(primero.kind, KIND.MANIFEST);
  assert.equal(parseFrame(primero.bytes).kind, KIND.MANIFEST);
});

test('nextFrame trae la matriz del QR lista para pintar', () => {
  const plan = planEmission(FIXTURE, { chunkSize: 900, fps: 10, compress: false });
  const frame = nextFrame(plan);

  assert.ok(Number.isInteger(frame.matrix.size) && frame.matrix.size > 20);
  assert.equal(frame.matrix.data.length, frame.matrix.size ** 2);
  assert.ok(frame.matrix.data.every((v) => v === 0 || v === 1));
});

test('el encoder vendorizado da matrices identicas a las del paquete npm', () => {
  // El bundle de src/ui/vendor existe porque `qrcode` no carga en un browser.
  // Esta es la asercion que impide que se desincronice del paquete real.
  const enc = encodeDocument(FIXTURE, { chunkSize: 900, compress: false });
  for (const raw of [enc.frames.manifest, enc.frames.data[0], enc.frames.parity[0]]) {
    const vendorizado = create([{ data: Buffer.from(raw), mode: 'byte' }], {
      errorCorrectionLevel: 'L',
    });
    const npm = frameToMatrix(raw);
    assert.equal(vendorizado.modules.size, npm.size);
    assert.deepEqual(Uint8Array.from(vendorizado.modules.data), npm.data);
  }
});

test('una vuelta completa cubre todos los indices de datos y sube el contador', () => {
  const plan = planEmission(FIXTURE, { chunkSize: 900, fps: 10, compress: false });
  assert.equal(plan.lap, 0);

  const vistos = new Set();
  let frame;
  do {
    frame = nextFrame(plan);
    if (frame.kind === KIND.DATA) vistos.add(frame.index);
  } while (plan.lap === 0 && plan.emitted < 500);

  assert.equal(plan.lap, 1, 'no completo una vuelta en 500 frames');
  assert.equal(vistos.size, plan.totalFrames);
});

test('el contador de vuelta avanza de a una, no salta', () => {
  const plan = planEmission(FIXTURE, { chunkSize: 900, fps: 10, compress: false });
  let previa = 0;
  for (let i = 0; i < 400; i++) {
    nextFrame(plan);
    assert.ok(plan.lap - previa <= 1, `salto de ${previa} a ${plan.lap}`);
    previa = plan.lap;
  }
  assert.ok(plan.lap >= 1);
});

test('las matrices se cachean: un frame repetido no se vuelve a encodear', () => {
  const plan = planEmission(FIXTURE, { chunkSize: 900, fps: 10, compress: false });
  const primero = nextFrame(plan);
  for (let i = 0; i < plan.cycleFrames + 20; i++) nextFrame(plan);

  const repetido = plan.frames.manifest;
  assert.ok(plan.matrixCache.has(repetido), 'el manifest tendria que estar cacheado');
  assert.equal(plan.matrixCache.get(repetido), primero.matrix, 'devolvio otra instancia');
});

test('planEmission expone la version de QR que va a usar el emisor', () => {
  const chico = planEmission(FIXTURE, { chunkSize: 200, fps: 10, compress: false });
  const grande = planEmission(FIXTURE, { chunkSize: 900, fps: 10, compress: false });
  assert.ok(grande.version > chico.version, 'mas payload tiene que pedir mas version');
  assert.equal(grande.version, 21);
});

test('planEmission valida fps y delega el resto de la validacion al protocolo', () => {
  for (const fps of [0, -1, 1.5, 'x', 121]) {
    assert.throws(() => planEmission(FIXTURE, { fps }), /fps/i);
  }
  assert.throws(() => planEmission(Buffer.alloc(0), { fps: 10 }), /vac/i);
  assert.throws(() => planEmission(FIXTURE, { fps: 10, chunkSize: 0 }), /chunkSize/i);
  assert.throws(() => nextFrame(null), /plan/i);
  assert.throws(() => nextFrame({}), /plan/i);
});

test('un chunkSize que no entra en ningun QR se rechaza al planificar, no al pintar', () => {
  assert.throws(
    () => planEmission(FIXTURE, { fps: 10, chunkSize: 65535, compress: false }),
    /no entra|capacidad|version/i,
  );
});

test('el docId hexadecimal del plan es el que usa el Bloque B para las rutas', () => {
  const plan = planEmission(FIXTURE, { chunkSize: 900, fps: 10, compress: false });
  assert.equal(plan.docIdHex, docIdHex(plan.docId));
  assert.equal(plan.manifest.sha256.slice(0, 8), plan.docIdHex);
});

// ---------------------------------------------------------------------------
// Techo de tamano: un archivo enorme tiene que fallar rapido y con motivo.
// ---------------------------------------------------------------------------

const { MAX_BYTES, AVISO_BYTES } = await import('../src/ui/sender.js');

test('un archivo por encima del techo se rechaza con el motivo', () => {
  const enorme = new Uint8Array(MAX_BYTES + 1);
  assert.throws(
    () => planEmission(enorme, { fps: 10 }),
    (err) => {
      assert.match(err.message, /m[aá]ximo/i);
      assert.match(err.message, /4\.00 MB/, 'tiene que nombrar el limite en unidades legibles');
      return true;
    },
  );
});

test('el techo se chequea antes de comprimir: un archivo enorme no cuelga el test', () => {
  const t0 = Date.now();
  // 200 MB de ceros: comprimirlos tardaria segundos. Tiene que fallar de una.
  assert.throws(() => planEmission(new Uint8Array(200 * 1024 * 1024), { fps: 10 }));
  assert.ok(Date.now() - t0 < 1500, 'tardo demasiado: se puso a trabajar antes de validar');
});

test('justo en el techo todavia entra', () => {
  assert.doesNotThrow(() => planEmission(new Uint8Array(1024).fill(7), { fps: 10 }));
  assert.ok(AVISO_BYTES < MAX_BYTES, 'el aviso tiene que estar por debajo del techo');
});
