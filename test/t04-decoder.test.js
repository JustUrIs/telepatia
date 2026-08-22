import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { randomBytes } from 'node:crypto';

import { FAILURE_CODES } from '../src/shared/contract.js';
import {
  KIND, parseFrame, packFrame, encodeDocument, FrameDecoder,
} from '../src/optical/protocol.js';

const FIXTURE = readFileSync('fixtures/document-small.bin');

/** El fixture da 40 chunks exactos: recortarlo deja una cola más corta que chunkSize. */
const COLA_CORTA = FIXTURE.subarray(0, 35500);

/** Barajado determinista (LCG): el test tiene que fallar siempre igual. */
function shuffle(arr, seed = 0x2545f491) {
  const out = [...arr];
  let s = seed >>> 0;
  for (let i = out.length - 1; i > 0; i--) {
    s = (Math.imul(s, 1664525) + 1013904223) >>> 0;
    const j = s % (i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

const todos = (enc) => [enc.frames.manifest, ...enc.frames.data, ...enc.frames.parity];

test('todos los frames desordenados reconstruyen el documento exacto', () => {
  for (const compress of [false, true]) {
    const enc = encodeDocument(FIXTURE, { compress, name: 'doc.bin' });
    const dec = new FrameDecoder();
    for (const raw of shuffle(todos(enc))) dec.push(raw);

    assert.equal(dec.complete, true);
    assert.equal(dec.progress, 1);

    const { document, manifest } = dec.assemble();
    assert.deepEqual(Buffer.from(document), FIXTURE);
    assert.equal(manifest.sha256, enc.manifest.sha256);
    assert.equal(manifest.name, 'doc.bin');
  }
});

test('el manifest puede llegar ultimo y el documento igual se arma', () => {
  const enc = encodeDocument(FIXTURE, { compress: false });
  const dec = new FrameDecoder();
  for (const raw of [...enc.frames.data, ...enc.frames.parity]) dec.push(raw);
  assert.equal(dec.complete, false, 'sin manifest no se puede declarar completo');
  dec.push(enc.frames.manifest);
  assert.equal(dec.complete, true);
  assert.deepEqual(Buffer.from(dec.assemble().document), FIXTURE);
});

test('omitiendo un chunk por ventana, la paridad lo recupera', () => {
  const enc = encodeDocument(FIXTURE, { compress: false });
  const { parityWindow, total } = enc.manifest;

  const omitidos = new Set();
  for (let w = 0; w * parityWindow < total; w++) omitidos.add(w * parityWindow);

  const dec = new FrameDecoder();
  dec.push(enc.frames.manifest);
  const entrada = [
    ...enc.frames.data.filter((_, i) => !omitidos.has(i)),
    ...enc.frames.parity,
  ];
  for (const raw of shuffle(entrada)) dec.push(raw);

  assert.ok(dec.stats.recovered > 0, 'no recupero nada');
  assert.equal(dec.stats.recovered, omitidos.size);
  assert.equal(dec.complete, true);
  assert.deepEqual(Buffer.from(dec.assemble().document), FIXTURE);
});

test('recupera tambien el ultimo chunk, que es mas corto que chunkSize', () => {
  const enc = encodeDocument(COLA_CORTA, { compress: false });
  const { total, chunkSize, bodyLength } = enc.manifest;
  const ultimo = total - 1;
  const largoReal = bodyLength - ultimo * chunkSize;
  assert.ok(largoReal < chunkSize, 'este caso necesita un ultimo chunk corto');

  const dec = new FrameDecoder();
  dec.push(enc.frames.manifest);
  for (const raw of enc.frames.data.filter((_, i) => i !== ultimo)) dec.push(raw);
  for (const raw of enc.frames.parity) dec.push(raw);

  assert.equal(dec.stats.recovered, 1);
  assert.equal(dec.complete, true);
  assert.deepEqual(Buffer.from(dec.assemble().document), COLA_CORTA);
  assert.equal(dec.assemble().document.length, COLA_CORTA.length);
});

test('dos faltantes en la misma ventana no se recuperan', () => {
  const enc = encodeDocument(FIXTURE, { compress: false });
  const dec = new FrameDecoder();
  dec.push(enc.frames.manifest);
  for (const raw of enc.frames.data.filter((_, i) => i !== 0 && i !== 1)) dec.push(raw);
  for (const raw of enc.frames.parity) dec.push(raw);

  assert.equal(dec.stats.recovered, 0);
  assert.equal(dec.complete, false);
  assert.throws(() => dec.assemble(), /incompleto/i);
});

test('la recuperacion funciona aunque la paridad llegue antes que los datos', () => {
  const enc = encodeDocument(FIXTURE, { compress: false });
  const dec = new FrameDecoder();
  for (const raw of enc.frames.parity) dec.push(raw);
  dec.push(enc.frames.manifest);
  for (const raw of enc.frames.data.filter((_, i) => i % 8 !== 3)) dec.push(raw);

  assert.ok(dec.stats.recovered > 0);
  assert.equal(dec.complete, true);
  assert.deepEqual(Buffer.from(dec.assemble().document), FIXTURE);
});

test('un byte alterado hace lanzar a assemble()', () => {
  const enc = encodeDocument(FIXTURE, { compress: false });
  const dec = new FrameDecoder();
  dec.push(enc.frames.manifest);

  enc.frames.data.forEach((raw, i) => {
    if (i !== 5) {
      dec.push(raw);
      return;
    }
    const f = parseFrame(raw);
    const payload = Buffer.from(f.payload);
    payload[0] ^= 0xff;
    dec.push(packFrame(KIND.DATA, f.docId, f.index, f.total, payload));
  });
  for (const raw of enc.frames.parity) dec.push(raw);

  assert.equal(dec.complete, true, 'esta completo en cantidad, corrupto en contenido');
  assert.throws(() => dec.assemble(), (err) => {
    assert.equal(err.code, FAILURE_CODES.digestMismatch);
    return true;
  });
});

test('un body corrupto que ni siquiera descomprime tambien lanza digestMismatch', () => {
  const enc = encodeDocument(Buffer.alloc(8000, 7), { compress: true });
  assert.equal(enc.manifest.compression, 1);

  const dec = new FrameDecoder();
  dec.push(enc.frames.manifest);
  enc.frames.data.forEach((raw, i) => {
    const f = parseFrame(raw);
    const payload = Buffer.from(f.payload);
    if (i === 0) payload.fill(0xa5);
    dec.push(packFrame(KIND.DATA, f.docId, f.index, f.total, payload));
  });

  assert.throws(() => dec.assemble(), (err) => {
    assert.equal(err.code, FAILURE_CODES.digestMismatch);
    return true;
  });
});

test('stats: accepted, duplicate y foreign se cuentan por separado', () => {
  const enc = encodeDocument(FIXTURE, { compress: false });
  const dec = new FrameDecoder();

  dec.push(enc.frames.manifest);
  for (const raw of enc.frames.data) dec.push(raw);
  const aceptados = dec.stats.accepted;

  for (const raw of enc.frames.data.slice(0, 4)) dec.push(raw);
  dec.push(enc.frames.manifest);
  assert.equal(dec.stats.duplicate, 5);
  assert.equal(dec.stats.accepted, aceptados, 'un duplicado no suma accepted');

  for (const basura of [Buffer.alloc(0), Buffer.from('hola'), randomBytes(64), null, {}]) {
    dec.push(basura);
  }
  assert.equal(dec.stats.foreign, 5);
  assert.equal(dec.complete, true, 'la basura no rompe un decode ya completo');
});

test('un docId distinto reinicia todo: dos documentos nunca se fusionan', () => {
  const otro = Buffer.from('otro documento entero', 'utf8');
  const a = encodeDocument(FIXTURE, { compress: false });
  const b = encodeDocument(otro, { compress: false });
  assert.notEqual(a.docId, b.docId);

  const dec = new FrameDecoder();
  dec.push(a.frames.manifest);
  for (const raw of a.frames.data.slice(0, 10)) dec.push(raw);
  assert.ok(dec.progress > 0 && dec.progress < 1);

  for (const raw of todos(b)) dec.push(raw);

  assert.equal(dec.docId, b.docId);
  assert.equal(dec.complete, true);
  assert.deepEqual(Buffer.from(dec.assemble().document), otro);
});

test('progress va de 0 a 1 y es monotono', () => {
  const enc = encodeDocument(FIXTURE, { compress: false });
  const dec = new FrameDecoder();
  assert.equal(dec.progress, 0);
  assert.equal(dec.complete, false);

  dec.push(enc.frames.manifest);
  let previo = dec.progress;
  for (const raw of enc.frames.data) {
    dec.push(raw);
    assert.ok(dec.progress >= previo, 'progress retrocedio');
    assert.ok(dec.progress >= 0 && dec.progress <= 1);
    previo = dec.progress;
  }
  assert.equal(dec.progress, 1);
});

test('reset() descarta el documento pero los contadores sobreviven', () => {
  const enc = encodeDocument(FIXTURE, { compress: false });
  const dec = new FrameDecoder();
  for (const raw of todos(enc)) dec.push(raw);
  assert.equal(dec.complete, true);
  const antes = dec.stats;

  dec.reset();
  assert.equal(dec.complete, false);
  assert.equal(dec.progress, 0);
  assert.equal(dec.docId, null);
  assert.equal(dec.manifest, null);
  assert.throws(() => dec.assemble());
  assert.deepEqual(dec.stats, antes, 'stats mide el canal, no el documento');

  dec.resetStats();
  assert.deepEqual(dec.stats, { accepted: 0, duplicate: 0, foreign: 0, recovered: 0 });
});

test('cambiar de documento tampoco borra los contadores del canal', () => {
  const a = encodeDocument(FIXTURE, { compress: false });
  const b = encodeDocument(Buffer.from('otro documento entero', 'utf8'), { compress: false });

  const dec = new FrameDecoder();
  dec.push(Buffer.from('basura que no es AGP1'));
  dec.push(a.frames.manifest);
  for (const raw of a.frames.data.slice(0, 10)) dec.push(raw);
  const foreignAntes = dec.stats.foreign;
  const acceptedAntes = dec.stats.accepted;

  dec.push(b.frames.manifest);
  assert.equal(dec.docId, b.docId);
  assert.equal(dec.stats.foreign, foreignAntes, 'el cambio de documento no borra foreign');
  assert.ok(dec.stats.accepted > acceptedAntes, 'y sigue sumando sobre lo anterior');
});

test('un frame espurio con su propio total no puede completar el documento', () => {
  const corto = encodeDocument(Buffer.alloc(2400, 3), { compress: false, chunkSize: 900 });
  assert.equal(corto.manifest.total, 3);

  const dec = new FrameDecoder();
  dec.push(corto.frames.manifest);
  dec.push(corto.frames.data[0]);
  dec.push(corto.frames.data[1]);

  // index=7/total=8 con el docId correcto: sin cruce contra el manifest, entraría.
  dec.push(packFrame(KIND.DATA, corto.docId, 7, 8, Buffer.alloc(900)));
  assert.equal(dec.stats.foreign, 1);
  assert.equal(dec.complete, false, 'un chunk espurio no puede dar por completo el documento');

  // Y uno con el index correcto pero el total mentido tampoco pasa.
  dec.push(packFrame(KIND.DATA, corto.docId, 2, 8, Buffer.alloc(600)));
  assert.equal(dec.stats.foreign, 2);
  assert.equal(dec.complete, false);

  dec.push(corto.frames.data[2]);
  assert.equal(dec.complete, true);
  assert.deepEqual(Buffer.from(dec.assemble().document), Buffer.alloc(2400, 3));
});

test('un chunk con largo distinto al que el manifest obliga se descarta', () => {
  const enc = encodeDocument(FIXTURE, { compress: false });
  const { docId, manifest } = enc;

  const dec = new FrameDecoder();
  dec.push(enc.frames.manifest);
  dec.push(packFrame(KIND.DATA, docId, 0, manifest.total, Buffer.alloc(899)));
  dec.push(packFrame(KIND.PARITY, docId, 0, manifest.total, Buffer.alloc(10)));
  assert.equal(dec.stats.foreign, 2);
  assert.equal(dec.progress, 0);
});

test('un manifest forjado que no case con su docId se rechaza', () => {
  const enc = encodeDocument(FIXTURE, { compress: false });
  const legitimo = parseFrame(enc.frames.manifest);
  const forjado = JSON.parse(legitimo.payload.toString('utf8'));
  forjado.sha256 = 'f'.repeat(64); // manifest de otro documento, docId ajeno

  const dec = new FrameDecoder();
  dec.push(packFrame(KIND.MANIFEST, enc.docId, 0, forjado.total, Buffer.from(JSON.stringify(forjado))));
  assert.equal(dec.manifest, null, 'el manifest forjado no debe quedar guardado');
  assert.equal(dec.stats.foreign, 1);

  // Y el legítimo, que llega después, tiene que entrar igual.
  dec.push(enc.frames.manifest);
  assert.equal(dec.manifest.sha256, enc.manifest.sha256);
  for (const raw of enc.frames.data) dec.push(raw);
  assert.deepEqual(Buffer.from(dec.assemble().document), FIXTURE);
});

test('los chunks guardados antes del manifest se revalidan cuando llega', () => {
  const enc = encodeDocument(FIXTURE, { compress: false });
  const { docId, manifest } = enc;

  const dec = new FrameDecoder();
  dec.push(packFrame(KIND.DATA, docId, 0, manifest.total, Buffer.alloc(500))); // largo mentido
  dec.push(enc.frames.data[1]);
  assert.equal(dec.stats.accepted, 2, 'sin manifest todavía no se puede cruzar nada');

  dec.push(enc.frames.manifest);
  assert.equal(dec.progress, 1 / manifest.total, 'el chunk inválido se descartó al validar');
});

test('assemble() antes de tiempo lanza, y stats es una copia', () => {
  const enc = encodeDocument(FIXTURE, { compress: false });
  const dec = new FrameDecoder();
  assert.throws(() => dec.assemble(), /manifest/i);

  dec.push(enc.frames.manifest);
  assert.throws(() => dec.assemble(), /incompleto/i);

  dec.stats.accepted = 9999;
  assert.notEqual(dec.stats.accepted, 9999, 'stats expone estado interno mutable');
});

test('un emisor de version futura se reporta en vez de tratarse como basura', () => {
  const enc = encodeDocument(FIXTURE, { compress: false });
  const futuro = Buffer.from(enc.frames.data[0]);
  futuro.writeUInt8(2, 4);

  const dec = new FrameDecoder();
  assert.equal(dec.unsupportedVersion, null);
  dec.push(futuro);
  assert.equal(dec.unsupportedVersion, 2);
  assert.equal(dec.stats.foreign, 1);
});

test('un indice fuera del total declarado se descarta como ajeno', () => {
  const enc = encodeDocument(FIXTURE, { compress: false });
  const { docId, manifest } = enc;
  const dec = new FrameDecoder();
  dec.push(enc.frames.manifest);
  dec.push(packFrame(KIND.DATA, docId, manifest.total + 3, manifest.total, Buffer.alloc(10)));
  assert.equal(dec.stats.foreign, 1);
  assert.equal(dec.stats.accepted, 1, 'solo el manifest');
});
