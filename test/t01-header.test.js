import test from 'node:test';
import assert from 'node:assert/strict';

import {
  MAGIC,
  VERSION,
  HEADER_LEN,
  KIND,
  packHeader,
  parseFrame,
} from '../src/optical/protocol.js';

/** Arma un frame completo: header + payload. */
const frame = (kind, docId, index, total, payload) =>
  Buffer.concat([packHeader(kind, docId, index, total, payload.length), payload]);

test('constantes del protocolo AGP1', () => {
  assert.equal(MAGIC, 0x41475031);
  assert.equal(Buffer.from('AGP1', 'ascii').readUInt32BE(0), MAGIC);
  assert.equal(VERSION, 1);
  assert.equal(HEADER_LEN, 16);
  assert.deepEqual(KIND, { MANIFEST: 1, DATA: 2, PARITY: 3 });
});

test('packHeader produce 16 bytes big-endian', () => {
  const h = packHeader(KIND.DATA, 0xdeadbeef, 0x0102, 0x0304, 0x0005);
  assert.equal(h.length, HEADER_LEN);
  assert.equal(h.readUInt32BE(0), MAGIC);
  assert.equal(h.readUInt32BE(6), 0xdeadbeef);
  assert.equal(h.readUInt16BE(10), 0x0102);
  assert.equal(h.readUInt16BE(12), 0x0304);
  assert.equal(h.readUInt16BE(14), 0x0005);
});

test('round-trip de header: parseFrame recupera cada campo', () => {
  const payload = Buffer.from('hola mundo', 'utf8');
  const parsed = parseFrame(frame(KIND.DATA, 0xdeadbeef, 7, 42, payload));

  assert.equal(parsed.kind, KIND.DATA);
  assert.equal(parsed.docId, 0xdeadbeef);
  assert.equal(parsed.index, 7);
  assert.equal(parsed.total, 42);
  assert.deepEqual(parsed.payload, payload);
});

test('round-trip en los tres KIND y en los bordes de cada campo', () => {
  for (const kind of Object.values(KIND)) {
    const parsed = parseFrame(frame(kind, 0xffffffff, 0xffff, 0xffff, Buffer.alloc(0)));
    assert.equal(parsed.kind, kind);
    assert.equal(parsed.docId, 0xffffffff);
    assert.equal(parsed.index, 0xffff);
    assert.equal(parsed.total, 0xffff);
    assert.equal(parsed.payload.length, 0);
  }
  const zero = parseFrame(frame(KIND.MANIFEST, 0, 0, 0, Buffer.alloc(0)));
  assert.equal(zero.docId, 0);
  assert.equal(zero.index, 0);
});

test('magia distinta devuelve null', () => {
  const bad = frame(KIND.DATA, 1, 0, 1, Buffer.from('x'));
  bad.writeUInt32BE(0x41475032, 0); // "AGP2" — no es nuestra magia
  assert.equal(parseFrame(bad), null);

  const noise = Buffer.alloc(HEADER_LEN + 4, 0x5a);
  assert.equal(parseFrame(noise), null);
});

test('buffer truncado devuelve null', () => {
  const full = frame(KIND.DATA, 1, 0, 1, Buffer.from('payload largo', 'utf8'));
  for (const len of [0, 1, 15, HEADER_LEN, full.length - 1]) {
    assert.equal(parseFrame(full.subarray(0, len)), null, `largo ${len} debería dar null`);
  }
});

test('largo declarado que no coincide con el real devuelve null', () => {
  const payload = Buffer.from('cinco', 'utf8');

  const corto = frame(KIND.DATA, 1, 0, 1, payload);
  corto.writeUInt16BE(payload.length + 1, 14); // declara más de lo que trae
  assert.equal(parseFrame(corto), null);

  const largo = Buffer.concat([frame(KIND.DATA, 1, 0, 1, payload), Buffer.from('extra')]);
  assert.equal(parseFrame(largo), null);
});

test('versión no soportada devuelve {unsupportedVersion}', () => {
  const f = frame(KIND.DATA, 1, 0, 1, Buffer.from('x'));
  f.writeUInt8(2, 4);
  assert.deepEqual(parseFrame(f), { unsupportedVersion: 2 });

  const f9 = frame(KIND.DATA, 1, 0, 1, Buffer.from('x'));
  f9.writeUInt8(9, 4);
  assert.deepEqual(parseFrame(f9), { unsupportedVersion: 9 });
});

test('la versión se chequea antes que el largo: un v2 raro sigue reportando versión', () => {
  const f = frame(KIND.DATA, 1, 0, 1, Buffer.from('x'));
  f.writeUInt8(2, 4);
  f.writeUInt16BE(999, 14); // largo incoherente además de versión mala
  assert.deepEqual(parseFrame(f), { unsupportedVersion: 2 });
});

test('kind desconocido devuelve null', () => {
  const f = frame(KIND.DATA, 1, 0, 1, Buffer.from('x'));
  f.writeUInt8(7, 5);
  assert.equal(parseFrame(f), null);
});

test('parseFrame nunca lanza: cualquier entrada es tolerada', () => {
  const basura = [
    undefined, null, 0, 1, '', 'AGP1', {}, [], true, NaN,
    Buffer.alloc(0), Buffer.alloc(3), Buffer.alloc(1024, 0xff),
    new Uint8Array([0x41, 0x47, 0x50, 0x31]),
  ];
  for (const v of basura) {
    assert.doesNotThrow(() => parseFrame(v), `parseFrame lanzó con ${String(v)}`);
  }
  for (let i = 0; i < 500; i++) {
    const len = Math.floor(Math.random() * 64);
    const buf = Buffer.alloc(len);
    for (let j = 0; j < len; j++) buf[j] = Math.floor(Math.random() * 256);
    if (len >= 4 && Math.random() < 0.5) buf.writeUInt32BE(MAGIC, 0);
    assert.doesNotThrow(() => parseFrame(buf));
  }
});

test('parseFrame acepta Uint8Array además de Buffer', () => {
  const f = frame(KIND.DATA, 0x11223344, 3, 9, Buffer.from('uint8', 'utf8'));
  const parsed = parseFrame(new Uint8Array(f));
  assert.equal(parsed.docId, 0x11223344);
  assert.deepEqual(Buffer.from(parsed.payload), Buffer.from('uint8', 'utf8'));
});

test('el payload devuelto no comparte memoria mutable con la entrada', () => {
  const f = frame(KIND.DATA, 1, 0, 1, Buffer.from('abc', 'utf8'));
  const parsed = parseFrame(f);
  f.fill(0);
  assert.deepEqual(Buffer.from(parsed.payload), Buffer.from('abc', 'utf8'));
});

test('packHeader rechaza campos fuera de rango', () => {
  assert.throws(() => packHeader(KIND.DATA, 1, 0, 0x10000, 0));
  assert.throws(() => packHeader(KIND.DATA, 1, 0x10000, 1, 0));
  assert.throws(() => packHeader(KIND.DATA, 0x1_0000_0000, 0, 1, 0));
  assert.throws(() => packHeader(99, 1, 0, 1, 0));
});
