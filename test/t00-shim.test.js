// Equivalencia de los shims de browser contra los builtins de Node.
//
// No es una tarea del plan: es el seguro de los shims que hacen que el nucleo
// de Bloque A pueda correr en el browser (T-09, T-10). Si alguno se desvia del
// comportamiento real, falla aca y no en la camara del jurado.

import test from 'node:test';
import assert from 'node:assert/strict';
import { createHash as nodeCreateHash, randomBytes } from 'node:crypto';
import { deflateRawSync as nodeDeflate, inflateRawSync as nodeInflate } from 'node:zlib';
import { readFileSync } from 'node:fs';

import { BufferShim } from '../src/ui/shim/buffer.js';
import { createHash, sha256 } from '../src/ui/shim/node-crypto.js';
import { deflateRawSync, inflateRawSync } from '../src/ui/shim/node-zlib.js';

/** Largos que rodean los bordes de padding de SHA-256 (55/56/63/64 y 64k). */
const LARGOS = [0, 1, 3, 55, 56, 57, 63, 64, 65, 119, 120, 127, 128, 900, 916, 65535, 65536, 70000];

test('sha256 coincide con node:crypto en los bordes de padding', () => {
  for (const largo of LARGOS) {
    const datos = randomBytes(largo);
    const esperado = nodeCreateHash('sha256').update(datos).digest('hex');
    assert.equal(BufferShim.from(sha256(datos)).toString('hex'), esperado, `largo ${largo}`);
  }
});

test('sha256 coincide con node:crypto sobre entradas aleatorias', () => {
  for (let i = 0; i < 200; i++) {
    const datos = randomBytes(Math.floor(Math.random() * 2000));
    assert.equal(
      BufferShim.from(sha256(datos)).toString('hex'),
      nodeCreateHash('sha256').update(datos).digest('hex'),
    );
  }
});

test('createHash reproduce la superficie update().digest() que usa el proyecto', () => {
  const datos = randomBytes(500);
  assert.equal(
    createHash('sha256').update(datos).digest('hex'),
    nodeCreateHash('sha256').update(datos).digest('hex'),
  );
  assert.deepEqual(
    Buffer.from(createHash('sha256').update(datos).digest()),
    nodeCreateHash('sha256').update(datos).digest(),
  );
  assert.throws(() => createHash('md5'), /sha256/);
});

test('el deflate del shim lo descomprime Node', () => {
  for (const largo of LARGOS) {
    const datos = randomBytes(largo);
    assert.deepEqual(Buffer.from(nodeInflate(deflateRawSync(datos))), datos, `largo ${largo}`);
  }
});

test('el deflate real de Node lo descomprime el shim cuando es stored', () => {
  const datos = randomBytes(4000);
  // `level: 0` le pide a Node bloques sin comprimir: el caso que el shim soporta.
  const comprimido = nodeDeflate(datos, { level: 0 });
  assert.deepEqual(Buffer.from(inflateRawSync(comprimido)), datos);
});

test('el shim rechaza deflate real con un mensaje claro, no con basura', () => {
  const comprimible = Buffer.alloc(8000, 7);
  const comprimido = nodeDeflate(comprimible);
  assert.ok(comprimido.length < comprimible.length, 'este caso necesita compresion de verdad');
  assert.throws(() => inflateRawSync(comprimido), /stored|receptor de Node/i);
});

test('el shim de deflate nunca achica: el emisor browser elige compression 0 solo', () => {
  for (const datos of [Buffer.alloc(4000, 0), randomBytes(4000)]) {
    assert.ok(deflateRawSync(datos).length > datos.length);
  }
});

test('inflate del shim es la inversa exacta de su deflate', () => {
  for (const largo of LARGOS) {
    const datos = randomBytes(largo);
    assert.deepEqual(Buffer.from(inflateRawSync(deflateRawSync(datos))), datos, `largo ${largo}`);
  }
});

test('inflate detecta stream truncado y LEN/NLEN inconsistente', () => {
  const bueno = deflateRawSync(randomBytes(100));
  assert.throws(() => inflateRawSync(bueno.subarray(0, 3)), /truncado/i);
  assert.throws(() => inflateRawSync(bueno.subarray(0, bueno.length - 10)), /truncado/i);

  const roto = BufferShim.from(bueno);
  roto[3] ^= 0xff;
  assert.throws(() => inflateRawSync(roto), /LEN/i);
});

test('BufferShim: alloc, from, concat, isBuffer y compare igual que Node', () => {
  assert.deepEqual(Buffer.from(BufferShim.alloc(5)), Buffer.alloc(5));
  assert.deepEqual(Buffer.from(BufferShim.from([1, 2, 3])), Buffer.from([1, 2, 3]));
  assert.deepEqual(Buffer.from(BufferShim.from('holá', 'utf8')), Buffer.from('holá', 'utf8'));
  assert.deepEqual(Buffer.from(BufferShim.from('deadbeef', 'hex')), Buffer.from('deadbeef', 'hex'));

  const partes = [BufferShim.from([1, 2]), BufferShim.from([3, 4, 5])];
  assert.deepEqual(Buffer.from(BufferShim.concat(partes)), Buffer.concat([Buffer.from([1, 2]), Buffer.from([3, 4, 5])]));
  assert.deepEqual(Buffer.from(BufferShim.concat(partes, 3)), Buffer.from([1, 2, 3]));

  assert.equal(BufferShim.isBuffer(BufferShim.alloc(1)), true);
  assert.equal(BufferShim.isBuffer(new Uint8Array(1)), false);
  assert.equal(BufferShim.compare(BufferShim.from([1, 2]), BufferShim.from([1, 2])), 0);
  assert.equal(BufferShim.compare(BufferShim.from([1]), BufferShim.from([1, 2])), -1);
  assert.equal(BufferShim.compare(BufferShim.from([2]), BufferShim.from([1, 9])), 1);
});

test('BufferShim: lectura y escritura de enteros big-endian igual que Node', () => {
  for (let i = 0; i < 200; i++) {
    const nodeBuf = randomBytes(16);
    const shim = BufferShim.from(nodeBuf);
    assert.equal(shim.readUInt8(3), nodeBuf.readUInt8(3));
    assert.equal(shim.readUInt16BE(4), nodeBuf.readUInt16BE(4));
    assert.equal(shim.readUInt32BE(8), nodeBuf.readUInt32BE(8));
  }

  const a = BufferShim.alloc(16);
  const b = Buffer.alloc(16);
  a.writeUInt32BE(0xdeadbeef, 0); b.writeUInt32BE(0xdeadbeef, 0);
  a.writeUInt16BE(0x1234, 4); b.writeUInt16BE(0x1234, 4);
  a.writeUInt8(0x7f, 6); b.writeUInt8(0x7f, 6);
  assert.deepEqual(Buffer.from(a), b);
});

test('BufferShim: subarray comparte memoria y conserva los metodos', () => {
  const buf = BufferShim.from([0, 0, 0, 0, 1, 2, 3, 4]);
  const vista = buf.subarray(4);
  assert.ok(vista instanceof BufferShim, 'subarray perdio la clase');
  assert.equal(vista.readUInt32BE(0), 0x01020304);

  vista[0] = 9;
  assert.equal(buf[4], 9, 'subarray tiene que ser una vista, no una copia');
});

test('BufferShim: toString utf8 y hex igual que Node', () => {
  for (let i = 0; i < 100; i++) {
    const nodeBuf = randomBytes(40);
    assert.equal(BufferShim.from(nodeBuf).toString('hex'), nodeBuf.toString('hex'));
  }
  const texto = 'factura ñandú — 1.234,56 €';
  assert.equal(BufferShim.from(texto).toString('utf8'), texto);
  assert.equal(BufferShim.from(texto).toString(), texto);
  assert.throws(() => BufferShim.from('x').toString('base64'), /encoding/i);
});

test('BufferShim: fill devuelve el mismo buffer, como Node', () => {
  const buf = BufferShim.alloc(4);
  assert.equal(buf.fill(7), buf);
  assert.deepEqual(Buffer.from(buf), Buffer.alloc(4, 7));
});

// ---------------------------------------------------------------------------
// Integracion cruzada: el bundle de browser contra el camino Node.
// ---------------------------------------------------------------------------

const { planEmission: planBundle, nextFrame: nextBundle } = await import('../src/ui/dist/sender.bundle.js');
const { planEmission: planNode, nextFrame: nextNode } = await import('../src/ui/sender.js');
const { FrameDecoder: DecoderNode, encodeDocument: encodeNode } = await import('../src/optical/protocol.js');
const DOC = new Uint8Array(readFileSync('fixtures/document-small.bin'));

test('el bundle de browser y el camino Node producen el mismo documento', () => {
  const shim = planBundle(DOC, { chunkSize: 900, fps: 10 });
  const node = planNode(DOC, { chunkSize: 900, fps: 10 });

  assert.equal(shim.docIdHex, node.docIdHex);
  assert.equal(shim.manifest.sha256, node.manifest.sha256);
  assert.equal(shim.totalFrames, node.totalFrames);
  assert.equal(shim.cycleFrames, node.cycleFrames);
  assert.equal(shim.version, node.version);
  assert.equal(shim.manifest.compression, node.manifest.compression);
});

test('cada frame emitido por el bundle es byte a byte igual al de Node', () => {
  const shim = planBundle(DOC, { chunkSize: 900, fps: 10 });
  const node = planNode(DOC, { chunkSize: 900, fps: 10 });

  for (let i = 0; i < 60; i++) {
    const a = nextBundle(shim);
    const b = nextNode(node);
    assert.equal(a.kind, b.kind);
    assert.equal(a.index, b.index);
    assert.deepEqual(Buffer.from(a.bytes), Buffer.from(b.bytes), `frame ${i}`);
    assert.deepEqual(a.matrix.data, b.matrix.data, `matriz del frame ${i}`);
  }
});

test('un emisor browser emite sin comprimir, y Node lo arma igual', () => {
  // El shim de deflate solo hace bloques stored, que nunca achican: por la
  // propia regla de encodeDocument, el browser elige compression 0 solo.
  const comprimible = new Uint8Array(20000).fill(7);

  const shim = planBundle(comprimible, { chunkSize: 900, fps: 10 });
  assert.equal(shim.manifest.compression, 0, 'el browser no deberia comprimir');
  assert.equal(encodeNode(comprimible).manifest.compression, 1, 'Node si comprime');

  // Y el stream del browser lo reconstruye el receptor de Node sin enterarse.
  const decoder = new DecoderNode();
  for (let i = 0; i < shim.cycleFrames * 2 && !decoder.complete; i++) {
    decoder.push(nextBundle(shim).bytes);
  }
  assert.equal(decoder.complete, true);
  assert.deepEqual(Buffer.from(decoder.assemble().document), Buffer.from(comprimible));
});

test('un stream comprimido por Node lo rechaza el receptor browser con mensaje claro', () => {
  const comprimible = Buffer.alloc(20000, 7);
  const enc = encodeNode(comprimible);
  assert.equal(enc.manifest.compression, 1);

  // El decoder del bundle usa el inflate del shim, que no hace Huffman.
  assert.throws(() => inflateRawSync(nodeDeflate(comprimible)), /stored|receptor de Node/i);
});
