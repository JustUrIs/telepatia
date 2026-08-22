// Protocolo óptico AGP1 — empaquetado, carrusel y reensamblado de documentos
// transportados como secuencia de códigos QR.
//
// El receptor ve cualquier QR que caiga en cuadro, incluido el de una vidriera:
// por eso `parseFrame` nunca lanza y devuelve `null` ante cualquier cosa que no
// sea un frame nuestro y bien formado.

import { createHash } from 'node:crypto';
import { deflateRawSync, inflateRawSync } from 'node:zlib';

import { FAILURE_CODES } from '../shared/contract.js';

/** Magia del protocolo: los bytes ASCII de "AGP1" leídos como u32 big-endian. */
export const MAGIC = 0x41475031;

/** Versión de wire soportada por esta implementación. */
export const VERSION = 1;

/** Largo fijo del header, en bytes. */
export const HEADER_LEN = 16;

/** Tipos de frame que viajan en el carrusel. */
export const KIND = Object.freeze({ MANIFEST: 1, DATA: 2, PARITY: 3 });

/** Valores de `manifest.compression`. */
export const COMPRESSION = Object.freeze({ NONE: 0, DEFLATE_RAW: 1 });

/** Cada cuántas emisiones se reinyecta el manifest en el carrusel. */
export const MANIFEST_EVERY = 12;

const KIND_VALUES = new Set(Object.values(KIND));

const U16_MAX = 0xffff;
const U32_MAX = 0xffffffff;

const DEFAULT_CHUNK_SIZE = 900;
const DEFAULT_PARITY_WINDOW = 8;

/**
 * Layout del header (16 bytes, todo big-endian):
 *
 *   offset  size  campo
 *   ------  ----  ---------------------------------
 *        0     4  MAGIC
 *        4     1  VERSION
 *        5     1  KIND
 *        6     4  docId
 *       10     2  index
 *       12     2  total
 *       14     2  payloadLen
 */

/** @param {unknown} v @param {number} max @param {string} name */
function assertUint(v, max, name) {
  if (!Number.isInteger(v) || v < 0 || v > max) {
    throw new RangeError(`${name} fuera de rango: ${v} (esperado entero 0..${max})`);
  }
}

/** @param {unknown} v @param {number} max @param {string} name */
function assertPositiveInt(v, max, name) {
  if (!Number.isInteger(v) || v < 1 || v > max) {
    throw new RangeError(`${name} inválido: ${v} (esperado entero 1..${max})`);
  }
}

/** Vista Buffer sobre cualquier TypedArray/DataView, sin copiar. `null` si no es binario. */
function asBuffer(bytes) {
  if (Buffer.isBuffer(bytes)) return bytes;
  if (ArrayBuffer.isView(bytes)) return Buffer.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return null;
}

/** @param {string} code @param {string} message */
function failure(code, message) {
  const err = new Error(message);
  err.code = code;
  return err;
}

// ---------------------------------------------------------------------------
// Wire: header y frames
// ---------------------------------------------------------------------------

/**
 * Arma el header de un frame.
 *
 * @internal Lo usan `encodeDocument` y los tests; no es superficie de aplicación.
 * @param {number} kind Uno de `KIND`.
 * @param {number} docId Identificador del documento (u32).
 * @param {number} index Índice del frame dentro de su tipo (u16).
 * @param {number} total Cantidad total de frames de datos del documento (u16).
 * @param {number} payloadLen Largo del payload que sigue al header (u16).
 * @returns {Buffer} Header de `HEADER_LEN` bytes.
 */
export function packHeader(kind, docId, index, total, payloadLen) {
  if (!KIND_VALUES.has(kind)) throw new RangeError(`kind desconocido: ${kind}`);
  assertUint(docId, U32_MAX, 'docId');
  assertUint(index, U16_MAX, 'index');
  assertUint(total, U16_MAX, 'total');
  assertUint(payloadLen, U16_MAX, 'payloadLen');

  const header = Buffer.alloc(HEADER_LEN);
  header.writeUInt32BE(MAGIC, 0);
  header.writeUInt8(VERSION, 4);
  header.writeUInt8(kind, 5);
  header.writeUInt32BE(docId, 6);
  header.writeUInt16BE(index, 10);
  header.writeUInt16BE(total, 12);
  header.writeUInt16BE(payloadLen, 14);
  return header;
}

/**
 * Arma un frame completo: header + payload.
 *
 * @internal
 * @param {number} kind @param {number} docId @param {number} index @param {number} total
 * @param {Uint8Array} payload
 * @returns {Buffer}
 */
export function packFrame(kind, docId, index, total, payload) {
  const body = Buffer.isBuffer(payload) ? payload : Buffer.from(payload ?? []);
  return Buffer.concat([packHeader(kind, docId, index, total, body.length), body]);
}

/**
 * @typedef {{ kind: number, docId: number, index: number, total: number, payload: Buffer }} Frame
 */

/**
 * Interpreta los bytes crudos de un QR.
 *
 * Nunca lanza. Devuelve:
 * - `Frame` si es un frame AGP1 v1 bien formado;
 * - `{unsupportedVersion}` si es AGP1 pero de una versión que no entendemos
 *   (el emisor es más nuevo: informable al usuario, no es basura);
 * - `null` para todo lo demás — QR ajeno, truncado, kind desconocido o largo
 *   declarado que no coincide con el real.
 *
 * @param {unknown} bytes
 * @returns {Frame | { unsupportedVersion: number } | null}
 */
export function parseFrame(bytes) {
  try {
    const buf = asBuffer(bytes);
    if (buf === null || buf.length < HEADER_LEN) return null;
    if (buf.readUInt32BE(0) !== MAGIC) return null;

    // La versión se chequea antes que el largo: si el emisor es más nuevo, el
    // resto del header puede tener otro layout y no tiene sentido validarlo.
    const version = buf.readUInt8(4);
    if (version !== VERSION) return { unsupportedVersion: version };

    const kind = buf.readUInt8(5);
    if (!KIND_VALUES.has(kind)) return null;

    const payloadLen = buf.readUInt16BE(14);
    if (buf.length !== HEADER_LEN + payloadLen) return null;

    return {
      kind,
      docId: buf.readUInt32BE(6),
      index: buf.readUInt16BE(10),
      total: buf.readUInt16BE(12),
      // Copia deliberada: el buffer de entrada suele ser un scratch reutilizado
      // por el loop de escaneo, y el decoder guarda estos payloads.
      payload: Buffer.from(buf.subarray(HEADER_LEN)),
    };
  } catch {
    return null;
  }
}

// ---------------------------------------------------------------------------
// Emisor: empaquetado del documento
// ---------------------------------------------------------------------------

/**
 * XOR de los chunks de una ventana, todos rellenados a `chunkSize`.
 * Con la paridad, al receptor le alcanza con perder un chunk por ventana.
 *
 * @param {Buffer[]} chunks @param {number} chunkSize
 * @returns {Buffer} bloque de `chunkSize` bytes
 */
function xorWindow(chunks, chunkSize) {
  const parity = Buffer.alloc(chunkSize);
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) parity[i] ^= chunk[i];
  }
  return parity;
}

/**
 * @typedef {object} Manifest
 * @property {number} v            Versión del manifest.
 * @property {string} sha256       Hash del documento EN CLARO, hex.
 * @property {number} length       Largo del documento en claro.
 * @property {number} bodyLength   Largo del body transmitido (comprimido o no).
 * @property {number} chunkSize    Bytes de payload por frame de datos.
 * @property {number} total        Cantidad de frames de datos.
 * @property {number} parityWindow Chunks por ventana de paridad.
 * @property {number} compression  Uno de `COMPRESSION`.
 * @property {string} name         Nombre original del archivo.
 * @property {string} mime         Tipo MIME declarado.
 */

/**
 * Convierte un documento en el juego completo de frames listos para el carrusel.
 *
 * El `docId` sale del hash del contenido en claro: dos documentos distintos
 * nunca colisionan en el receptor, y comprimir o no comprimir no lo cambia.
 *
 * @param {Uint8Array} document
 * @param {{name?: string, mime?: string, chunkSize?: number, parityWindow?: number, compress?: boolean}} [options]
 * @returns {{docId: number, manifest: Manifest, frames: {manifest: Buffer, data: Buffer[], parity: Buffer[]}}}
 */
export function encodeDocument(document, options = {}) {
  const {
    name = 'document.bin',
    mime = 'application/octet-stream',
    chunkSize = DEFAULT_CHUNK_SIZE,
    parityWindow = DEFAULT_PARITY_WINDOW,
    compress = true,
  } = options ?? {};

  const doc = asBuffer(document);
  if (doc === null) throw new TypeError('document debe ser Uint8Array o Buffer');
  if (doc.length === 0) throw new Error('documento vacío: no hay nada que transmitir');

  assertPositiveInt(chunkSize, U16_MAX, 'chunkSize');
  assertPositiveInt(parityWindow, U16_MAX, 'parityWindow');

  const digest = createHash('sha256').update(doc).digest();
  const docId = digest.readUInt32BE(0);

  // Comprimir solo si sirve: con datos ya comprimidos deflate agrega bytes.
  let body = doc;
  let compression = COMPRESSION.NONE;
  if (compress) {
    const deflated = deflateRawSync(doc);
    if (deflated.length < doc.length) {
      body = deflated;
      compression = COMPRESSION.DEFLATE_RAW;
    }
  }

  const total = Math.ceil(body.length / chunkSize);
  if (total > U16_MAX) {
    throw new RangeError(
      `el documento necesita ${total} frames y el máximo es ${U16_MAX}: subí chunkSize`,
    );
  }

  /** @type {Manifest} */
  const manifest = {
    v: 1,
    sha256: digest.toString('hex'),
    length: doc.length,
    bodyLength: body.length,
    chunkSize,
    total,
    parityWindow,
    compression,
    name: String(name),
    mime: String(mime),
  };

  const chunks = [];
  for (let i = 0; i < total; i++) {
    chunks.push(body.subarray(i * chunkSize, Math.min((i + 1) * chunkSize, body.length)));
  }

  const data = chunks.map((chunk, i) => packFrame(KIND.DATA, docId, i, total, chunk));

  const parity = [];
  for (let w = 0; w * parityWindow < total; w++) {
    const ventana = chunks.slice(w * parityWindow, (w + 1) * parityWindow);
    parity.push(packFrame(KIND.PARITY, docId, w, total, xorWindow(ventana, chunkSize)));
  }

  const manifestFrame = packFrame(
    KIND.MANIFEST, docId, 0, total, Buffer.from(JSON.stringify(manifest), 'utf8'),
  );

  return { docId, manifest, frames: { manifest: manifestFrame, data, parity } };
}

// ---------------------------------------------------------------------------
// Emisor: carrusel
// ---------------------------------------------------------------------------

/**
 * Lee y valida el manifest embebido en su frame.
 *
 * @param {Uint8Array} frame
 * @returns {Manifest}
 */
export function readManifestFrame(frame) {
  const parsed = parseFrame(frame);
  if (parsed === null || parsed.kind !== KIND.MANIFEST) {
    throw new TypeError('el frame no es un MANIFEST AGP1 válido');
  }
  const manifest = JSON.parse(parsed.payload.toString('utf8'));
  assertPositiveInt(manifest.chunkSize, U16_MAX, 'manifest.chunkSize');
  assertPositiveInt(manifest.parityWindow, U16_MAX, 'manifest.parityWindow');
  return manifest;
}

/**
 * Orden de emisión infinito.
 *
 * El manifest va primero y se reinyecta cada `MANIFEST_EVERY` frames: un
 * receptor que apunta la cámara a mitad del ciclo engancha en menos de un
 * segundo en vez de esperar a que termine la vuelta.
 *
 * La paridad de cada ventana se emite pegada a los datos de esa ventana, no
 * junta al final: así un receptor que pierde un frame lo recupera en el acto y
 * no tiene que esperar una vuelta entera.
 *
 * @param {{manifest?: Manifest, frames: {manifest: Buffer, data: Buffer[], parity: Buffer[]}}} source
 *   El resultado de `encodeDocument`, o `{frames}` pelado: el `parityWindow` se
 *   lee del propio frame de manifest cuando no viene dado.
 * @param {{manifestEvery?: number}} [options]
 * @returns {Generator<Buffer, never, void>} generador infinito
 */
export function* carousel(source, options = {}) {
  const frames = source?.frames;
  if (!frames?.manifest || !Array.isArray(frames.data)) {
    throw new TypeError('carousel espera el resultado de encodeDocument');
  }
  const { manifestEvery = MANIFEST_EVERY } = options ?? {};
  assertPositiveInt(manifestEvery, U16_MAX, 'manifestEvery');

  const manifest = source.manifest ?? readManifestFrame(frames.manifest);
  const { parityWindow } = manifest;

  // Ciclo base: los datos de cada ventana seguidos por su paridad.
  const cycle = [];
  for (let w = 0; w * parityWindow < frames.data.length; w++) {
    cycle.push(...frames.data.slice(w * parityWindow, (w + 1) * parityWindow));
    if (frames.parity[w]) cycle.push(frames.parity[w]);
  }

  for (let emitted = 0, i = 0; ; emitted++) {
    if (emitted % manifestEvery === 0) {
      yield frames.manifest;
      continue;
    }
    yield cycle[i++ % cycle.length];
  }
}

// ---------------------------------------------------------------------------
// Receptor: reensamblado
// ---------------------------------------------------------------------------

/**
 * Acumula frames sueltos hasta poder reconstruir el documento.
 *
 * Lo alimenta el loop de escaneo, que le tira todo lo que la cámara ve. Tolera
 * duplicados, desorden, QR ajenos, y la pérdida de hasta un chunk por ventana
 * de paridad.
 */
export class FrameDecoder {
  /** @type {number|null} */ #docId = null;
  /** @type {Manifest|null} */ #manifest = null;
  /** @type {Map<number, Buffer>} */ #chunks = new Map();
  /** @type {Map<number, Buffer>} */ #parity = new Map();
  /** @type {number|null} */ #unsupportedVersion = null;
  #stats = { accepted: 0, duplicate: 0, foreign: 0, recovered: 0 };

  /** Documento que se está recibiendo, o `null` si todavía no llegó nada nuestro. */
  get docId() { return this.#docId; }

  /** Manifest recibido, o `null`. Sin él no se puede armar ni medir progreso. */
  get manifest() { return this.#manifest; }

  /** Versión de un emisor más nuevo que este receptor, si se vio alguna. */
  get unsupportedVersion() { return this.#unsupportedVersion; }

  /** Copia de los contadores: mutarla no toca el estado interno. */
  get stats() { return { ...this.#stats }; }

  /** `true` cuando están todos los chunks y se conoce el manifest. */
  get complete() {
    return this.#manifest !== null && this.#chunks.size >= this.#manifest.total;
  }

  /** Fracción recibida, 0..1. Sin manifest es 0: no se sabe cuánto falta. */
  get progress() {
    if (this.#manifest === null) return 0;
    return Math.min(1, this.#chunks.size / this.#manifest.total);
  }

  /** Vuelve al estado inicial, contadores incluidos. */
  reset() {
    this.#docId = null;
    this.#manifest = null;
    this.#chunks = new Map();
    this.#parity = new Map();
    this.#unsupportedVersion = null;
    this.#stats = { accepted: 0, duplicate: 0, foreign: 0, recovered: 0 };
  }

  /**
   * Ofrece al decoder los bytes crudos de un QR.
   *
   * @param {unknown} bytes
   * @returns {boolean} `true` si el frame aportó información nueva.
   */
  push(bytes) {
    const frame = parseFrame(bytes);

    if (frame === null) {
      this.#stats.foreign++;
      return false;
    }
    if (frame.unsupportedVersion !== undefined) {
      this.#unsupportedVersion = frame.unsupportedVersion;
      this.#stats.foreign++;
      return false;
    }

    // El docId sale del hash del contenido: uno distinto es otro documento, y
    // mezclar dos daría un archivo corrupto que igual pasa el chequeo de largo.
    if (this.#docId === null) {
      this.#docId = frame.docId;
    } else if (frame.docId !== this.#docId) {
      this.reset();
      this.#docId = frame.docId;
    }

    switch (frame.kind) {
      case KIND.MANIFEST: return this.#pushManifest(frame);
      case KIND.DATA: return this.#pushData(frame);
      case KIND.PARITY: return this.#pushParity(frame);
      default:
        this.#stats.foreign++;
        return false;
    }
  }

  /** @param {Frame} frame */
  #pushManifest(frame) {
    if (this.#manifest !== null) {
      this.#stats.duplicate++;
      return false;
    }

    let manifest;
    try {
      manifest = JSON.parse(frame.payload.toString('utf8'));
      assertPositiveInt(manifest.total, U16_MAX, 'manifest.total');
      assertPositiveInt(manifest.chunkSize, U16_MAX, 'manifest.chunkSize');
      assertPositiveInt(manifest.parityWindow, U16_MAX, 'manifest.parityWindow');
      assertPositiveInt(manifest.bodyLength, Number.MAX_SAFE_INTEGER, 'manifest.bodyLength');
      assertPositiveInt(manifest.length, Number.MAX_SAFE_INTEGER, 'manifest.length');
      if (typeof manifest.sha256 !== 'string' || !/^[0-9a-f]{64}$/.test(manifest.sha256)) {
        throw new TypeError('manifest.sha256 inválido');
      }
    } catch {
      this.#stats.foreign++;
      return false;
    }

    this.#manifest = manifest;
    // Un chunk guardado antes del manifest puede caer fuera del total real.
    for (const index of [...this.#chunks.keys()]) {
      if (index >= manifest.total) this.#chunks.delete(index);
    }
    this.#stats.accepted++;
    this.#recover();
    return true;
  }

  /** @param {Frame} frame */
  #pushData(frame) {
    const limite = this.#manifest?.total ?? frame.total;
    if (frame.index >= limite) {
      this.#stats.foreign++;
      return false;
    }
    if (this.#chunks.has(frame.index)) {
      this.#stats.duplicate++;
      return false;
    }
    this.#chunks.set(frame.index, frame.payload);
    this.#stats.accepted++;
    this.#recover();
    return true;
  }

  /** @param {Frame} frame */
  #pushParity(frame) {
    if (this.#parity.has(frame.index)) {
      this.#stats.duplicate++;
      return false;
    }
    this.#parity.set(frame.index, frame.payload);
    this.#stats.accepted++;
    this.#recover();
    return true;
  }

  /**
   * Rellena los huecos que la paridad alcanza a cubrir.
   *
   * Corre en bucle porque recuperar un chunk puede dejar a otra ventana con un
   * único faltante. Hoy las ventanas no se solapan, pero el bucle hace que el
   * invariante no dependa de eso.
   */
  #recover() {
    if (this.#manifest === null) return;
    const { total, chunkSize, parityWindow, bodyLength } = this.#manifest;

    let cambio = true;
    while (cambio) {
      cambio = false;
      for (const [w, paridad] of this.#parity) {
        const inicio = w * parityWindow;
        if (inicio >= total || paridad.length !== chunkSize) continue;
        const fin = Math.min(inicio + parityWindow, total);

        let faltante = -1;
        let cuantos = 0;
        for (let i = inicio; i < fin && cuantos < 2; i++) {
          if (!this.#chunks.has(i)) {
            faltante = i;
            cuantos++;
          }
        }
        if (cuantos !== 1) continue;

        const recuperado = Buffer.from(paridad);
        for (let i = inicio; i < fin; i++) {
          const chunk = this.#chunks.get(i);
          if (chunk === undefined) continue;
          for (let j = 0; j < chunk.length; j++) recuperado[j] ^= chunk[j];
        }

        // El último chunk es más corto: la paridad viaja rellenada a chunkSize.
        const largoReal = faltante === total - 1
          ? bodyLength - faltante * chunkSize
          : chunkSize;

        this.#chunks.set(faltante, recuperado.subarray(0, largoReal));
        this.#stats.recovered++;
        cambio = true;
      }
    }
  }

  /**
   * Reconstruye el documento y verifica su integridad.
   *
   * @returns {{document: Buffer, manifest: Manifest}}
   * @throws si falta el manifest, faltan chunks, o el contenido no coincide con
   *   el largo y el SHA-256 declarados.
   */
  assemble() {
    // Estos dos no llevan `code`: no son fallos del documento sino de secuencia.
    // La UI consulta `complete` antes de armar; si igual llama, el mensaje alcanza.
    if (this.#manifest === null) {
      throw new Error('todavía no llegó el manifest del documento');
    }
    const manifest = this.#manifest;

    if (!this.complete) {
      const faltan = manifest.total - this.#chunks.size;
      throw new Error(`documento incompleto: faltan ${faltan} de ${manifest.total} frames`);
    }

    const partes = [];
    for (let i = 0; i < manifest.total; i++) partes.push(this.#chunks.get(i));
    const body = Buffer.concat(partes);

    if (body.length !== manifest.bodyLength) {
      throw failure(
        FAILURE_CODES.digestMismatch,
        `largo del body ${body.length}, declarado ${manifest.bodyLength}`,
      );
    }

    let document;
    if (manifest.compression === COMPRESSION.DEFLATE_RAW) {
      try {
        document = inflateRawSync(body);
      } catch {
        throw failure(FAILURE_CODES.digestMismatch, 'el body no descomprime: llegó corrupto');
      }
    } else {
      document = body;
    }

    if (document.length !== manifest.length) {
      throw failure(
        FAILURE_CODES.digestMismatch,
        `largo del documento ${document.length}, declarado ${manifest.length}`,
      );
    }

    const sha256 = createHash('sha256').update(document).digest('hex');
    if (sha256 !== manifest.sha256) {
      throw failure(FAILURE_CODES.digestMismatch, 'el SHA-256 no coincide con el declarado');
    }

    return { document, manifest };
  }
}
