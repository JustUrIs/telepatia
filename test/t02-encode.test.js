import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createHash, randomBytes } from 'node:crypto';
import { inflateRawSync } from 'node:zlib';

import { docIdHex } from '../src/shared/contract.js';
import { KIND, HEADER_LEN, parseFrame, encodeDocument } from '../src/optical/protocol.js';

const FIXTURE = readFileSync('fixtures/document-small.bin');
const sha256 = (b) => createHash('sha256').update(b).digest('hex');

/** Lee el manifest desde su frame, pasando por el parser real. */
const manifestOf = (frames) => JSON.parse(parseFrame(frames.manifest).payload.toString('utf8'));

/** Reconstruye el body concatenando los payloads de los frames de datos. */
const bodyOf = (frames) => Buffer.concat(frames.data.map((f) => parseFrame(f).payload));

test('total es ceil(bodyLength / chunkSize)', () => {
  for (const opts of [{ compress: false }, { compress: true }, { compress: false, chunkSize: 256 }]) {
    const { manifest, frames } = encodeDocument(FIXTURE, { name: 'doc.bin', ...opts });
    const esperado = Math.ceil(manifest.bodyLength / manifest.chunkSize);
    assert.equal(manifest.total, esperado);
    assert.equal(frames.data.length, esperado);
  }
});

test('el manifest parsea y trae todos los campos del contrato de wire', () => {
  const { frames } = encodeDocument(FIXTURE, { name: 'factura.bin', mime: 'application/pdf' });
  const m = manifestOf(frames);

  assert.deepEqual(Object.keys(m).sort(), [
    'bodyLength', 'chunkSize', 'compression', 'length', 'mime',
    'name', 'parityWindow', 'sha256', 'total', 'v',
  ]);
  assert.equal(m.v, 1);
  assert.equal(m.sha256, sha256(FIXTURE));
  assert.equal(m.length, FIXTURE.length);
  assert.equal(m.name, 'factura.bin');
  assert.equal(m.mime, 'application/pdf');
  assert.equal(m.chunkSize, 900);
  assert.equal(m.parityWindow, 8);
});

test('el frame de manifest es KIND.MANIFEST y lleva el total del documento', () => {
  const { frames, manifest } = encodeDocument(FIXTURE, { compress: false });
  const parsed = parseFrame(frames.manifest);
  assert.equal(parsed.kind, KIND.MANIFEST);
  assert.equal(parsed.index, 0);
  assert.equal(parsed.total, manifest.total);
});

test('un documento de ceros comprime (compression === 1)', () => {
  const ceros = Buffer.alloc(40960, 0);
  const { manifest, frames } = encodeDocument(ceros);
  assert.equal(manifest.compression, 1);
  assert.ok(manifest.bodyLength < manifest.length);
  assert.deepEqual(inflateRawSync(bodyOf(frames)), ceros);
});

test('un documento aleatorio no comprime (compression === 0)', () => {
  const azar = randomBytes(40960);
  const { manifest, frames } = encodeDocument(azar);
  assert.equal(manifest.compression, 0);
  assert.equal(manifest.bodyLength, manifest.length);
  assert.deepEqual(bodyOf(frames), azar);
});

test('compress:false fuerza compression 0 aunque el documento sea comprimible', () => {
  const { manifest } = encodeDocument(Buffer.alloc(4096, 0), { compress: false });
  assert.equal(manifest.compression, 0);
  assert.equal(manifest.bodyLength, 4096);
});

test('docId son los primeros 4 bytes del SHA-256 del documento EN CLARO', () => {
  const digest = createHash('sha256').update(FIXTURE).digest();
  const esperado = digest.readUInt32BE(0);

  const conComp = encodeDocument(FIXTURE, { compress: true });
  const sinComp = encodeDocument(FIXTURE, { compress: false });

  assert.equal(conComp.docId, esperado);
  assert.equal(sinComp.docId, esperado, 'comprimir no puede cambiar el docId');
});

test('invariante del contrato: sha256.slice(0,8) === docIdHex(docId)', () => {
  for (const compress of [false, true]) {
    const { docId, manifest } = encodeDocument(FIXTURE, { compress });
    assert.equal(manifest.sha256.slice(0, 8), docIdHex(docId));
  }
  const { docId, manifest } = encodeDocument(Buffer.from('otra cosa', 'utf8'));
  assert.equal(manifest.sha256.slice(0, 8), docIdHex(docId));
});

test('el manifest declara los formatos que fija la spec', () => {
  const { manifest } = encodeDocument(FIXTURE, { compress: false });
  assert.equal(manifest.v, 1);
  assert.match(manifest.sha256, /^[0-9a-f]{64}$/);
  assert.equal(manifest.sha256, manifest.sha256.toLowerCase());
  assert.ok([0, 1].includes(manifest.compression));
  assert.equal(manifest.length, FIXTURE.length);
});

test('todos los frames de datos parsean, con índice correlativo y docId del documento', () => {
  const { docId, manifest, frames } = encodeDocument(FIXTURE, { compress: false });

  frames.data.forEach((raw, i) => {
    const f = parseFrame(raw);
    assert.notEqual(f, null, `frame de datos ${i} no parsea`);
    assert.equal(f.kind, KIND.DATA);
    assert.equal(f.docId, docId);
    assert.equal(f.index, i);
    assert.equal(f.total, manifest.total);
    assert.ok(f.payload.length <= manifest.chunkSize);
  });

  const ultimo = parseFrame(frames.data.at(-1)).payload.length;
  const esperadoUltimo = manifest.bodyLength - (manifest.total - 1) * manifest.chunkSize;
  assert.equal(ultimo, esperadoUltimo, 'el último chunk no se rellena');
});

test('el body reconstruido coincide con el documento (sin compresión)', () => {
  const { manifest, frames } = encodeDocument(FIXTURE, { compress: false });
  const body = bodyOf(frames);
  assert.equal(body.length, manifest.bodyLength);
  assert.deepEqual(body, FIXTURE);
});

test('ningún frame supera el límite de payload de un u16', () => {
  const { frames } = encodeDocument(FIXTURE, { compress: false });
  for (const raw of [frames.manifest, ...frames.data, ...frames.parity]) {
    assert.ok(raw.length - HEADER_LEN <= 0xffff);
  }
});

test('documento vacío lanza', () => {
  assert.throws(() => encodeDocument(Buffer.alloc(0)), /vac/i);
  assert.throws(() => encodeDocument(new Uint8Array(0)), /vac/i);
});

test('total > 65535 lanza', () => {
  // 40960 bytes sin comprimir en chunks de 1 byte = 40960 frames: entra.
  assert.doesNotThrow(() => encodeDocument(FIXTURE, { compress: false, chunkSize: 1 }));
  // 70000 bytes incompresibles en chunks de 1 byte: no entra en u16.
  const grande = randomBytes(70000);
  assert.throws(() => encodeDocument(grande, { compress: false, chunkSize: 1 }), /65535|total/i);
});

test('chunkSize y parityWindow inválidos lanzan', () => {
  for (const chunkSize of [0, -1, 1.5, 0x10000, 'x']) {
    assert.throws(() => encodeDocument(FIXTURE, { chunkSize }), `chunkSize ${chunkSize}`);
  }
  for (const parityWindow of [0, -1, 2.5, 'x']) {
    assert.throws(() => encodeDocument(FIXTURE, { parityWindow }), `parityWindow ${parityWindow}`);
  }
});
