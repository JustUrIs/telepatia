// Subconjunto de `Buffer` para el browser.
//
// `protocol.js` corre en Node y usa `Buffer` como global. Un browser no lo
// tiene, así que el bundle de la UI lo inyecta desde acá. Solo implementa lo
// que el codigo del proyecto realmente usa — no es un polyfill general, y no
// pretende serlo.
//
// `test/t00-shim.test.js` corre cada método contra el `Buffer` real de Node
// sobre entradas aleatorias: si esta implementación se desvía, falla ahí.

const utf8Decoder = new TextDecoder('utf-8');
const utf8Encoder = new TextEncoder();

const HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, '0'));

/** @param {Uint8Array} bytes */
function toHex(bytes) {
  let salida = '';
  for (const byte of bytes) salida += HEX[byte];
  return salida;
}

/** @param {string} hex */
function fromHex(hex) {
  const limpio = hex.length % 2 === 0 ? hex : hex.slice(0, -1);
  const salida = new Uint8Array(limpio.length / 2);
  for (let i = 0; i < salida.length; i++) {
    salida[i] = Number.parseInt(limpio.slice(i * 2, i * 2 + 2), 16);
  }
  return salida;
}

/**
 * `Buffer` mínimo sobre `Uint8Array`.
 *
 * Hereda de `Uint8Array`, así que `subarray` devuelve otro `BufferShim` por
 * species y las vistas siguen funcionando sin copiar.
 */
export class BufferShim extends Uint8Array {
  /** @param {number} size */
  static alloc(size) {
    if (!Number.isInteger(size) || size < 0) throw new RangeError(`tamaño inválido: ${size}`);
    return new BufferShim(size);
  }

  /**
   * @param {ArrayBuffer|ArrayBufferView|number[]|string} value
   * @param {number|string} [a] byteOffset, o el encoding si `value` es string
   * @param {number} [b] length
   */
  static from(value, a, b) {
    if (typeof value === 'string') {
      const encoding = typeof a === 'string' ? a.toLowerCase() : 'utf8';
      if (encoding === 'hex') return new BufferShim(fromHex(value));
      return new BufferShim(utf8Encoder.encode(value));
    }
    if (value instanceof ArrayBuffer) {
      const offset = a ?? 0;
      const length = b ?? value.byteLength - offset;
      return new BufferShim(value, offset, length);
    }
    if (ArrayBuffer.isView(value)) {
      // Copia, como hace `Buffer.from(typedArray)` en Node.
      return new BufferShim(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    }
    if (Array.isArray(value)) return new BufferShim(Uint8Array.from(value));
    throw new TypeError('Buffer.from: tipo no soportado por este shim');
  }

  /** @param {Uint8Array[]} list @param {number} [totalLength] */
  static concat(list, totalLength) {
    const total = totalLength ?? list.reduce((suma, parte) => suma + parte.length, 0);
    const salida = new BufferShim(total);
    let cursor = 0;
    for (const parte of list) {
      if (cursor >= total) break;
      salida.set(parte.subarray(0, total - cursor), cursor);
      cursor += parte.length;
    }
    return salida;
  }

  /** @param {unknown} v */
  static isBuffer(v) { return v instanceof BufferShim; }

  /** @param {Uint8Array} a @param {Uint8Array} b */
  static compare(a, b) {
    const min = Math.min(a.length, b.length);
    for (let i = 0; i < min; i++) {
      if (a[i] !== b[i]) return a[i] < b[i] ? -1 : 1;
    }
    if (a.length === b.length) return 0;
    return a.length < b.length ? -1 : 1;
  }

  /** Vista sobre los mismos bytes, para leer y escribir enteros. */
  get #view() {
    return new DataView(this.buffer, this.byteOffset, this.byteLength);
  }

  readUInt8(offset = 0) { return this.#view.getUint8(offset); }
  readUInt16BE(offset = 0) { return this.#view.getUint16(offset, false); }
  readUInt32BE(offset = 0) { return this.#view.getUint32(offset, false); }

  writeUInt8(value, offset = 0) { this.#view.setUint8(offset, value); return offset + 1; }
  writeUInt16BE(value, offset = 0) { this.#view.setUint16(offset, value, false); return offset + 2; }
  writeUInt32BE(value, offset = 0) { this.#view.setUint32(offset, value, false); return offset + 4; }

  /** @param {number} value @param {number} [start] @param {number} [end] */
  fill(value, start = 0, end = this.length) {
    super.fill(value, start, end);
    return this;
  }

  /** @param {'utf8'|'utf-8'|'hex'} [encoding] */
  toString(encoding = 'utf8', start = 0, end = this.length) {
    const trozo = this.subarray(start, end);
    const enc = String(encoding).toLowerCase();
    if (enc === 'hex') return toHex(trozo);
    if (enc === 'utf8' || enc === 'utf-8') return utf8Decoder.decode(trozo);
    throw new TypeError(`encoding no soportado por este shim: ${encoding}`);
  }
}

export const Buffer = BufferShim;
export default BufferShim;
