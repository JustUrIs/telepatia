// Preview del documento recibido.
//
// No es una tarea del plan: sale de que un archivo reconstruido que no se
// puede ver deja al usuario sin forma de saber si llego lo que mando.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { deflateRawSync, crc32 } from 'node:zlib';

import {
  sniffKind, asText, listZipEntries, hexDump, describePayload, LIMITE_TEXTO,
} from '../src/ui/preview.js';

const FIXTURE = readFileSync('fixtures/document-small.bin');

const bytes = (...v) => Uint8Array.from(v);
const texto = (s) => new TextEncoder().encode(s);

/** ZIP minimo, armado a mano: es mas honesto que traer una dependencia. */
function armarZip(archivos) {
  const enc = new TextEncoder();
  const locales = [];
  const centrales = [];
  let offset = 0;

  for (const { name, content } of archivos) {
    const nombre = enc.encode(name);
    const datos = enc.encode(content);
    const comprimido = deflateRawSync(datos);
    const suma = crc32(datos);

    const local = Buffer.alloc(30 + nombre.length + comprimido.length);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(8, 8);          // deflate
    local.writeUInt32LE(suma, 14);
    local.writeUInt32LE(comprimido.length, 18);
    local.writeUInt32LE(datos.length, 22);
    local.writeUInt16LE(nombre.length, 26);
    Buffer.from(nombre).copy(local, 30);
    Buffer.from(comprimido).copy(local, 30 + nombre.length);
    locales.push(local);

    const central = Buffer.alloc(46 + nombre.length);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(8, 10);
    central.writeUInt32LE(suma, 16);
    central.writeUInt32LE(comprimido.length, 20);
    central.writeUInt32LE(datos.length, 24);
    central.writeUInt16LE(nombre.length, 28);
    central.writeUInt32LE(offset, 42);
    Buffer.from(nombre).copy(central, 46);
    centrales.push(central);

    offset += local.length;
  }

  const cd = Buffer.concat(centrales);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(archivos.length, 8);
  eocd.writeUInt16LE(archivos.length, 10);
  eocd.writeUInt32LE(cd.length, 12);
  eocd.writeUInt32LE(offset, 16);

  return new Uint8Array(Buffer.concat([...locales, cd, eocd]));
}

test('reconoce imagenes por firma, no por el mime declarado', () => {
  const png = bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a, 0, 0, 0, 0);
  const jpeg = bytes(0xff, 0xd8, 0xff, 0xe0, 0, 0, 0, 0);
  const gif = bytes(0x47, 0x49, 0x46, 0x38, 0x39, 0x61, 0, 0);

  for (const img of [png, jpeg, gif]) {
    assert.equal(sniffKind(img, '').kind, 'image');
    // Aunque el emisor mienta el tipo, los bytes mandan.
    assert.equal(sniffKind(img, 'application/octet-stream').kind, 'image');
  }
  assert.equal(sniffKind(png).mime, 'image/png');
  assert.equal(sniffKind(jpeg).mime, 'image/jpeg');
});

test('reconoce firmas que no estan en el offset 0', () => {
  const webp = new Uint8Array(16);
  webp.set(texto('RIFF'), 0);
  webp.set(texto('WEBP'), 8);
  assert.equal(sniffKind(webp).kind, 'image');
  assert.equal(sniffKind(webp).mime, 'image/webp');

  const mp4 = new Uint8Array(16);
  mp4.set(texto('ftyp'), 4);
  assert.equal(sniffKind(mp4).kind, 'video');
});

test('reconoce zip, pdf y gzip', () => {
  assert.equal(sniffKind(bytes(0x50, 0x4b, 0x03, 0x04, 0, 0)).kind, 'zip');
  assert.equal(sniffKind(texto('%PDF-1.7\n')).kind, 'pdf');
  assert.equal(sniffKind(bytes(0x1f, 0x8b, 0x08, 0)).kind, 'archive');
});

test('un binario sin firma cae en binary, no en text', () => {
  assert.equal(sniffKind(new Uint8Array(FIXTURE)).kind, 'binary');
});

test('asText acepta texto real y rechaza binario', () => {
  assert.equal(asText(texto('hola, ñandú — 1.234,56 €')), 'hola, ñandú — 1.234,56 €');
  assert.equal(asText(texto('a,b,c\n1,2,3\r\n')), 'a,b,c\n1,2,3\r\n');
  assert.equal(asText(new Uint8Array(0)), '');

  assert.equal(asText(new Uint8Array(FIXTURE)), null);
  assert.equal(asText(bytes(0xff, 0xfe, 0xfd, 0xfc)), null, 'UTF-8 invalido');
});

test('un binario que es UTF-8 valido por casualidad igual se rechaza', () => {
  // Todos los bytes < 0x20: decodifica sin error, pero no es texto.
  const control = new Uint8Array(500).fill(0x01);
  assert.equal(asText(control), null);
  assert.equal(sniffKind(control).kind, 'binary');
});

test('el texto se detecta aunque el emisor no declare mime', () => {
  const csv = texto('Fecha;Concepto;Importe\n02/09/2026;Pago;421.820,52\n');
  assert.equal(sniffKind(csv, '').kind, 'text');
  assert.equal(sniffKind(csv, 'application/octet-stream').kind, 'text');
  assert.equal(sniffKind(csv, 'text/csv').mime, 'text/csv', 'respeta el mime cuando sirve');
});

test('listZipEntries lee el directorio central', () => {
  const zip = armarZip([
    { name: 'facturas/', content: '' },
    { name: 'facturas/a-0001.json', content: '{"total":421820.52}' },
    { name: 'leeme.txt', content: 'contenido de prueba mas largo que el anterior' },
  ]);

  const entradas = listZipEntries(zip);
  assert.equal(entradas.length, 3);
  assert.deepEqual(entradas.map((e) => e.name), [
    'facturas/', 'facturas/a-0001.json', 'leeme.txt',
  ]);
  assert.equal(entradas[0].directory, true);
  assert.equal(entradas[1].directory, false);
  assert.equal(entradas[2].size, 45);
});

test('listZipEntries encuentra el EOCD aunque haya comentario detras', () => {
  const zip = armarZip([{ name: 'x.txt', content: 'hola' }]);
  const conComentario = new Uint8Array(zip.length + 300);
  conComentario.set(zip);
  new DataView(conComentario.buffer).setUint16(zip.length - 2, 300, true);
  conComentario.fill(0x41, zip.length);

  assert.equal(listZipEntries(conComentario)[0].name, 'x.txt');
});

test('listZipEntries lanza si no es un ZIP', () => {
  assert.throws(() => listZipEntries(new Uint8Array(FIXTURE)), /ZIP|central/i);
  assert.throws(() => listZipEntries(new Uint8Array(10)), /ZIP|central/i);
});

test('describePayload de una imagen no vuelca bytes a pantalla', () => {
  const png = new Uint8Array(3000);
  png.set(bytes(0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a));

  const vista = describePayload(png, { name: 'foto.png', mime: 'image/png' });
  assert.equal(vista.kind, 'image');
  assert.equal(vista.label, 'Imagen');
  assert.equal(vista.name, 'foto.png');
  assert.equal(vista.sizeLabel, '2.9 kB');
  assert.equal(vista.hex, undefined, 'una imagen no se muestra en hexadecimal');
  assert.equal(vista.text, undefined);
});

test('describePayload de texto trae el texto y cuenta lineas', () => {
  const vista = describePayload(texto('uno\ndos\ntres'), { name: 'notas.txt' });
  assert.equal(vista.kind, 'text');
  assert.equal(vista.text, 'uno\ndos\ntres');
  assert.equal(vista.lines, 3);
  assert.equal(vista.truncated, false);
});

test('un texto enorme se recorta y lo avisa', () => {
  const largo = 'a'.repeat(LIMITE_TEXTO + 500);
  const vista = describePayload(texto(largo));
  assert.equal(vista.text.length, LIMITE_TEXTO);
  assert.equal(vista.truncated, true);
});

test('describePayload de un ZIP lista el contenido, con conteos', () => {
  const zip = armarZip([
    { name: 'carpeta/', content: '' },
    { name: 'carpeta/uno.txt', content: '12345' },
    { name: 'carpeta/dos.txt', content: '1234567890' },
  ]);

  const vista = describePayload(zip, { name: 'lote.zip', mime: 'application/zip' });
  assert.equal(vista.kind, 'zip');
  assert.equal(vista.fileCount, 2);
  assert.equal(vista.dirCount, 1);
  assert.equal(vista.uncompressedSize, 15);
  assert.equal(vista.entries.length, 3);
});

test('un ZIP con el directorio ilegible se degrada a binario en vez de romper', () => {
  const roto = new Uint8Array(200);
  roto.set(bytes(0x50, 0x4b, 0x03, 0x04));

  const vista = describePayload(roto, { name: 'roto.zip' });
  assert.equal(vista.kind, 'binary');
  assert.ok(vista.hex.length > 0);
  assert.ok(vista.zipError.length > 0);
});

test('describePayload de un binario da un volcado hexadecimal legible', () => {
  const vista = describePayload(new Uint8Array(FIXTURE), { name: 'blob.bin' });
  assert.equal(vista.kind, 'binary');
  assert.equal(vista.label, 'Binario');

  const primeraLinea = vista.hex.split('\n')[0];
  assert.match(primeraLinea, /^00000000 {2}([0-9a-f]{2} ){15}[0-9a-f]{2} {2}\|.{16}\|$/);
  assert.equal(vista.hex.split('\n').length, 16, '256 bytes en filas de 16');
});

test('hexDump marca los no imprimibles con punto', () => {
  const volcado = hexDump(bytes(0x48, 0x6f, 0x6c, 0x61, 0x00, 0x01, 0xff));
  assert.match(volcado, /\|Hola\.\.\.\|/);
});

test('describePayload valida su entrada', () => {
  assert.throws(() => describePayload(null), /bytes/i);
  assert.throws(() => describePayload('texto'), /bytes/i);
});

test('sin nombre en el manifest usa el de la convencion del Bloque B', () => {
  assert.equal(describePayload(texto('x')).name, 'document.bin');
});
