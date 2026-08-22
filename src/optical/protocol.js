// Air-Gap Protocol v1 (AGP1) — códec de payload visual para transporte óptico.
//
// Diseño propio. Solo stdlib de Node (node:zlib, node:crypto).
//
// Modelo del canal: una pantalla emite un carrusel infinito de frames; una
// cámara los lee sin canal de retorno. No hay handshake ni retransmisión: el
// emisor no sabe si alguien está mirando. Un frame perdido cuesta tiempo,
// nunca corrección.
//
// Layout del frame (big-endian, 16 bytes de header + payload):
//   0..3   u32  magia 0x41475031 = "AGP1"  (ASCII, visible en un hexdump)
//   4      u8   versión = 1
//   5      u8   tipo: 1=MANIFEST 2=DATA 3=PARITY
//   6..9   u32  docId = primeros 4 bytes de SHA-256(documento en claro)
//   10..11 u16  índice (nº de chunk, o nº de ventana si es PARITY)
//   12..13 u16  total de frames DATA
//   14..15 u16  longitud del payload
//
// No hay checksum por frame a propósito: la ECC Reed-Solomon del QR entrega el
// frame entero y correcto, o no lo entrega. Un CRC acá solo duplicaría eso. La
// integridad real es el SHA-256 del documento completo, en el manifest.

import { deflateRawSync, inflateRawSync } from 'node:zlib';
import { createHash } from 'node:crypto';

const MAGIC = 0x41475031; // "AGP1"
export const VERSION = 1;
export const HEADER_LEN = 16;
export const KIND = { MANIFEST: 1, DATA: 2, PARITY: 3 };

const MAX_CHUNKS = 0xffff;
const MAX_PAYLOAD = 0xffff;
const DEFAULT_PARITY_WINDOW = 8;
const MANIFEST_EVERY = 12;

const sha256Hex = (bytes) => createHash('sha256').update(bytes).digest('hex');

function asBuffer(bytes, label) {
  if (Buffer.isBuffer(bytes)) return bytes;
  if (bytes instanceof Uint8Array) return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  throw new TypeError(`${label} debe ser Buffer o Uint8Array, recibí ${typeof bytes}`);
}

function packHeader(kind, docId, index, total, payloadLen) {
  const h = Buffer.allocUnsafe(HEADER_LEN);
  h.writeUInt32BE(MAGIC, 0);
  h.writeUInt8(VERSION, 4);
  h.writeUInt8(kind, 5);
  h.writeUInt32BE(docId, 6);
  h.writeUInt16BE(index, 10);
  h.writeUInt16BE(total, 12);
  h.writeUInt16BE(payloadLen, 14);
  return h;
}

/**
 * Parsea un frame. Nunca lanza: el receptor ve cualquier QR que caiga en
 * cuadro, incluido el de una vidriera, y narrar eso sería ruido.
 * @returns {null | {unsupportedVersion:number} | {kind,docId,index,total,payload}}
 */
export function parseFrame(bytes) {
  let b;
  try { b = asBuffer(bytes, 'frame'); } catch { return null; }
  if (b.length < HEADER_LEN) return null;
  if (b.readUInt32BE(0) !== MAGIC) return null;
  const version = b.readUInt8(4);
  if (version !== VERSION) return { unsupportedVersion: version };
  const kind = b.readUInt8(5);
  if (kind !== KIND.MANIFEST && kind !== KIND.DATA && kind !== KIND.PARITY) return null;
  const payloadLen = b.readUInt16BE(14);
  if (b.length !== HEADER_LEN + payloadLen) return null; // truncado o mal leído
  const total = b.readUInt16BE(12);
  const index = b.readUInt16BE(10);
  if (kind === KIND.DATA && index >= total) return null; // índice fuera de rango
  return { kind, docId: b.readUInt32BE(6), index, total, payload: b.subarray(HEADER_LEN) };
}

/**
 * Prepara un documento para emisión.
 * @param {Buffer|Uint8Array} document
 * @returns {{docId:number, manifest:object, frames:{manifest:Buffer,data:Buffer[],parity:Buffer[]}}}
 */
export function encodeDocument(document, opts = {}) {
  const doc = asBuffer(document, 'document');
  if (doc.length === 0) throw new RangeError('documento vacío: nada que emitir');

  const {
    name = 'document.bin',
    mime = 'application/octet-stream',
    chunkSize = 900,
    parityWindow = DEFAULT_PARITY_WINDOW,
    compress = true,
  } = opts;

  if (!Number.isInteger(chunkSize) || chunkSize < 1 || chunkSize > MAX_PAYLOAD - HEADER_LEN) {
    throw new RangeError(`chunkSize fuera de rango: ${chunkSize}`);
  }
  if (!Number.isInteger(parityWindow) || parityWindow < 0) {
    throw new RangeError(`parityWindow inválido: ${parityWindow}`);
  }

  const digest = sha256Hex(doc);
  const docId = Buffer.from(digest.slice(0, 8), 'hex').readUInt32BE(0);

  // Se comprime solo si realmente ayuda: un PDF o un JPEG ya vienen
  // entropy-coded y deflate los deja más grandes.
  let body = doc;
  let compression = 0;
  if (compress) {
    try {
      const deflated = deflateRawSync(doc);
      if (deflated.length < doc.length) { body = deflated; compression = 1; }
    } catch {
      // Un deflate que falla no es fatal: se emite sin comprimir.
    }
  }

  const total = Math.ceil(body.length / chunkSize);
  if (total > MAX_CHUNKS) {
    throw new RangeError(`documento necesita ${total} chunks a ${chunkSize} B/frame; el máximo es ${MAX_CHUNKS}. Subí chunkSize.`);
  }

  const chunks = [];
  for (let i = 0; i < total; i++) {
    chunks.push(body.subarray(i * chunkSize, Math.min((i + 1) * chunkSize, body.length)));
  }

  const manifest = {
    v: VERSION, sha256: digest,
    length: doc.length,          // longitud EN CLARO, post-descompresión
    bodyLength: body.length,
    chunkSize, total, parityWindow, compression,
    name: String(name).slice(0, 255),
    mime: String(mime).slice(0, 127),
  };
  const manifestBytes = Buffer.from(JSON.stringify(manifest), 'utf8');
  if (manifestBytes.length > MAX_PAYLOAD) throw new RangeError('manifest demasiado grande');
  if (manifestBytes.length + HEADER_LEN > chunkSize + HEADER_LEN) {
    // No es fatal, pero el manifest tiene que caber en el mismo QR que los datos.
    if (manifestBytes.length > chunkSize) {
      throw new RangeError(`manifest de ${manifestBytes.length} B no cabe en chunkSize ${chunkSize}. Acortá el nombre o subí chunkSize.`);
    }
  }

  const frames = {
    manifest: Buffer.concat([packHeader(KIND.MANIFEST, docId, 0, total, manifestBytes.length), manifestBytes]),
    data: chunks.map((chunk, i) => Buffer.concat([packHeader(KIND.DATA, docId, i, total, chunk.length), chunk])),
    parity: [],
  };

  // Paridad XOR por ventana: recupera cualquier chunk único perdido dentro de
  // su ventana sin esperar otra vuelta del carrusel.
  if (parityWindow > 0) {
    for (let w = 0; w * parityWindow < total; w++) {
      const acc = Buffer.alloc(chunkSize);
      for (let i = w * parityWindow; i < Math.min((w + 1) * parityWindow, total); i++) {
        const c = chunks[i];
        for (let j = 0; j < c.length; j++) acc[j] ^= c[j];
      }
      frames.parity.push(Buffer.concat([packHeader(KIND.PARITY, docId, w, total, chunkSize), acc]));
    }
  }

  return { docId, manifest, frames };
}

/**
 * Orden de emisión: manifest primero, data intercalada con la paridad de su
 * ventana, y el manifest reinyectado cada MANIFEST_EVERY frames para que un
 * receptor que entra tarde engancha rápido. Generador infinito: el emisor no
 * sabe cuándo alguien terminó de leer.
 */
export function* carousel(encoded) {
  if (!encoded?.frames?.manifest) throw new TypeError('carousel() espera la salida de encodeDocument()');
  const { frames, manifest } = encoded;
  const pw = manifest.parityWindow;
  const cycle = [frames.manifest];
  for (let i = 0; i < frames.data.length; i++) {
    cycle.push(frames.data[i]);
    if (pw > 0 && (i + 1) % pw === 0) {
      const p = frames.parity[Math.floor(i / pw)];
      if (p) cycle.push(p);
    }
  }
  // La última ventana puede quedar incompleta y su paridad sin emitir.
  if (pw > 0 && frames.data.length % pw !== 0) {
    const last = frames.parity[Math.floor((frames.data.length - 1) / pw)];
    if (last) cycle.push(last);
  }
  let n = 0;
  for (;;) {
    for (const frame of cycle) {
      if (n > 0 && n % MANIFEST_EVERY === 0) yield frames.manifest;
      yield frame;
      n++;
    }
  }
}

/**
 * Receptor con estado. Se le dan frames en cualquier orden; cuando `complete`
 * da true, `assemble()` devuelve el documento verificado.
 *
 * Un docId distinto reinicia todo: dos documentos nunca se fusionan, porque el
 * docId sale del hash del contenido.
 */
export class FrameDecoder {
  constructor() { this.reset(); }

  reset() {
    // Los contadores de diagnóstico son ACUMULATIVOS por sesión de escaneo: si
    // se borraran en cada reset, un stream que cambia de documento reportaría
    // resets=1 sin importar cuántas veces cambió, y las métricas de campo
    // (¿cuánta basura entró? ¿cuántas versiones ajenas?) serían inútiles.
    const carried = this.stats ?? { accepted: 0, duplicate: 0, foreign: 0, recovered: 0, resets: 0, badVersion: 0, rejected: 0 };
    this.docId = null;
    this.manifest = null;
    this.chunks = new Map();
    this.parity = new Map();
    this.stats = { ...carried };
  }

  get complete() {
    return this.manifest !== null && this.chunks.size === this.manifest.total;
  }

  get progress() {
    if (!this.manifest || this.manifest.total === 0) return 0;
    return Math.min(1, this.chunks.size / this.manifest.total);
  }

  /** @returns {boolean} true si el frame aportó algo nuevo. */
  push(bytes) {
    const f = parseFrame(bytes);
    if (f === null) { this.stats.foreign++; return false; }
    if (f.unsupportedVersion !== undefined) { this.stats.badVersion++; return false; }

    if (this.docId !== null && f.docId !== this.docId) {
      this.reset();
      this.stats.resets++;
    }
    this.docId = f.docId;

    if (f.kind === KIND.MANIFEST) {
      if (this.manifest) { this.stats.duplicate++; return false; }
      let parsed;
      try { parsed = JSON.parse(f.payload.toString('utf8')); } catch { this.stats.foreign++; return false; }
      if (!this.#validManifest(parsed)) { this.stats.foreign++; return false; }
      // El docId SALE del sha256 del claro, así que un manifest legítimo
      // siempre empieza con el docId que lo transporta. Chequearlo es gratis y
      // cierra el caso "manifest forjado que llega primero y gana": sin esto,
      // el manifest verdadero que viene después se descarta como duplicado.
      if (parsed.sha256.slice(0, 8) !== f.docId.toString(16).padStart(8, '0')) {
        this.stats.rejected = (this.stats.rejected ?? 0) + 1;
        return false;
      }
      this.manifest = parsed;
      this.stats.accepted++;
      this.#recover();
      return true;
    }

    // Un frame trae SU PROPIO `total`, así que `parseFrame` solo puede validar
    // el índice contra ese número — que el emisor de un frame espurio elige.
    // Una vez que hay manifest, la autoridad es el manifest: sin este cruce, un
    // único frame con index=7/total=8 entra en un stream de 3 chunks, deja
    // `complete` en true con un chunk ausente, y (por el stop() del receptor)
    // mata el escaneo mostrando un error de integridad.
    if (this.manifest) {
      if (f.total !== this.manifest.total) { this.stats.rejected = (this.stats.rejected ?? 0) + 1; return false; }
      if (f.kind === KIND.DATA) {
        if (f.index >= this.manifest.total) { this.stats.rejected = (this.stats.rejected ?? 0) + 1; return false; }
        const expected = f.index === this.manifest.total - 1
          ? this.manifest.bodyLength - f.index * this.manifest.chunkSize
          : this.manifest.chunkSize;
        if (f.payload.length !== expected) { this.stats.rejected = (this.stats.rejected ?? 0) + 1; return false; }
      }
      if (f.kind === KIND.PARITY && f.payload.length !== this.manifest.chunkSize) {
        this.stats.rejected = (this.stats.rejected ?? 0) + 1; return false;
      }
    }

    if (f.kind === KIND.PARITY) {
      if (this.parity.has(f.index)) { this.stats.duplicate++; return false; }
      this.parity.set(f.index, Buffer.from(f.payload));
      this.stats.accepted++;
      this.#recover();
      return true;
    }

    if (this.chunks.has(f.index)) { this.stats.duplicate++; return false; }
    this.chunks.set(f.index, Buffer.from(f.payload));
    this.stats.accepted++;
    this.#recover();
    return true;
  }

  /** Un manifest llega por el canal óptico: es dato hostil, no fuente de verdad. */
  #validManifest(m) {
    return !!m && m.v === VERSION
      && typeof m.sha256 === 'string' && /^[0-9a-f]{64}$/.test(m.sha256)
      && Number.isInteger(m.length) && m.length > 0
      && Number.isInteger(m.bodyLength) && m.bodyLength > 0
      && Number.isInteger(m.chunkSize) && m.chunkSize > 0 && m.chunkSize <= MAX_PAYLOAD
      && Number.isInteger(m.total) && m.total > 0 && m.total <= MAX_CHUNKS
      && Number.isInteger(m.parityWindow) && m.parityWindow >= 0
      && (m.compression === 0 || m.compression === 1)
      // Consistencia: los chunks declarados tienen que poder contener el cuerpo.
      && m.bodyLength <= m.total * m.chunkSize
      && m.bodyLength > (m.total - 1) * m.chunkSize;
  }

  /** Si a una ventana le falta exactamente un chunk y tenemos su paridad, el
   *  faltante es el XOR de la paridad con los presentes. En bucle, porque un
   *  chunk recuperado puede habilitar la recuperación de otra ventana. */
  #recover() {
    if (!this.manifest || !this.manifest.parityWindow) return;
    const { parityWindow: pw, total, chunkSize, bodyLength } = this.manifest;
    let progressed = true;
    while (progressed) {
      progressed = false;
      for (const [w, par] of this.parity) {
        const from = w * pw;
        const to = Math.min(from + pw, total);
        if (from >= total) continue;
        const missing = [];
        for (let i = from; i < to && missing.length < 2; i++) if (!this.chunks.has(i)) missing.push(i);
        if (missing.length !== 1) continue;
        const target = missing[0];
        const acc = Buffer.from(par);
        for (let i = from; i < to; i++) {
          if (i === target) continue;
          const c = this.chunks.get(i);
          for (let j = 0; j < c.length; j++) acc[j] ^= c[j];
        }
        const len = target === total - 1 ? bodyLength - target * chunkSize : chunkSize;
        if (len <= 0 || len > acc.length) continue; // manifest incoherente: no inventamos
        this.chunks.set(target, acc.subarray(0, len));
        this.stats.recovered++;
        progressed = true;
      }
    }
  }

  /** @returns {{document:Buffer, manifest:object}} Lanza si la integridad falla. */
  assemble() {
    if (!this.complete) throw new Error('todavía incompleto: faltan chunks');
    const { total, compression, length, sha256: expected } = this.manifest;
    const parts = [];
    for (let i = 0; i < total; i++) {
      const c = this.chunks.get(i);
      if (!c) throw new Error(`inconsistencia interna: falta el chunk ${i}`);
      parts.push(c);
    }
    const body = Buffer.concat(parts);
    let document;
    if (compression === 1) {
      try { document = inflateRawSync(body); }
      catch (err) { throw new Error(`descompresión falló: ${err.message}`); }
    } else {
      document = body;
    }
    if (document.length !== length) {
      throw new Error(`longitud no coincide con el manifest: ${document.length} vs ${length}`);
    }
    const actual = sha256Hex(document);
    if (actual !== expected) throw new Error('SHA-256 no coincide: documento corrupto');
    return { document, manifest: this.manifest };
  }
}
