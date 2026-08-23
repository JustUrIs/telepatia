// GENERADO por scripts/bundle-ui.mjs. NO EDITAR A MANO.
// Entrada: src/ui/sender.js
// node:crypto y node:zlib resueltos a los shims de src/ui/shim/,
// verificados contra los builtins de Node en test/t00-shim.test.js.
// src/ui/shim/buffer.js
var utf8Decoder = new TextDecoder("utf-8");
var utf8Encoder = new TextEncoder();
var HEX = Array.from({ length: 256 }, (_, i) => i.toString(16).padStart(2, "0"));
function toHex(bytes) {
  let salida = "";
  for (const byte of bytes) salida += HEX[byte];
  return salida;
}
function fromHex(hex) {
  const limpio = hex.length % 2 === 0 ? hex : hex.slice(0, -1);
  const salida = new Uint8Array(limpio.length / 2);
  for (let i = 0; i < salida.length; i++) {
    salida[i] = Number.parseInt(limpio.slice(i * 2, i * 2 + 2), 16);
  }
  return salida;
}
var BufferShim = class _BufferShim extends Uint8Array {
  /** @param {number} size */
  static alloc(size) {
    if (!Number.isInteger(size) || size < 0) throw new RangeError(`tama\xF1o inv\xE1lido: ${size}`);
    return new _BufferShim(size);
  }
  /**
   * @param {ArrayBuffer|ArrayBufferView|number[]|string} value
   * @param {number|string} [a] byteOffset, o el encoding si `value` es string
   * @param {number} [b] length
   */
  static from(value, a, b) {
    if (typeof value === "string") {
      const encoding = typeof a === "string" ? a.toLowerCase() : "utf8";
      if (encoding === "hex") return new _BufferShim(fromHex(value));
      return new _BufferShim(utf8Encoder.encode(value));
    }
    if (value instanceof ArrayBuffer) {
      const offset = a ?? 0;
      const length = b ?? value.byteLength - offset;
      return new _BufferShim(value, offset, length);
    }
    if (ArrayBuffer.isView(value)) {
      return new _BufferShim(new Uint8Array(value.buffer, value.byteOffset, value.byteLength));
    }
    if (Array.isArray(value)) return new _BufferShim(Uint8Array.from(value));
    throw new TypeError("Buffer.from: tipo no soportado por este shim");
  }
  /** @param {Uint8Array[]} list @param {number} [totalLength] */
  static concat(list, totalLength) {
    const total = totalLength ?? list.reduce((suma, parte) => suma + parte.length, 0);
    const salida = new _BufferShim(total);
    let cursor = 0;
    for (const parte of list) {
      if (cursor >= total) break;
      salida.set(parte.subarray(0, total - cursor), cursor);
      cursor += parte.length;
    }
    return salida;
  }
  /** @param {unknown} v */
  static isBuffer(v) {
    return v instanceof _BufferShim;
  }
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
  readUInt8(offset = 0) {
    return this.#view.getUint8(offset);
  }
  readUInt16BE(offset = 0) {
    return this.#view.getUint16(offset, false);
  }
  readUInt32BE(offset = 0) {
    return this.#view.getUint32(offset, false);
  }
  writeUInt8(value, offset = 0) {
    this.#view.setUint8(offset, value);
    return offset + 1;
  }
  writeUInt16BE(value, offset = 0) {
    this.#view.setUint16(offset, value, false);
    return offset + 2;
  }
  writeUInt32BE(value, offset = 0) {
    this.#view.setUint32(offset, value, false);
    return offset + 4;
  }
  /** @param {number} value @param {number} [start] @param {number} [end] */
  fill(value, start = 0, end = this.length) {
    super.fill(value, start, end);
    return this;
  }
  /** @param {'utf8'|'utf-8'|'hex'} [encoding] */
  toString(encoding = "utf8", start = 0, end = this.length) {
    const trozo = this.subarray(start, end);
    const enc = String(encoding).toLowerCase();
    if (enc === "hex") return toHex(trozo);
    if (enc === "utf8" || enc === "utf-8") return utf8Decoder.decode(trozo);
    throw new TypeError(`encoding no soportado por este shim: ${encoding}`);
  }
};

// src/shared/contract.js
var docIdHex = (docId) => {
  if (!Number.isInteger(docId) || docId < 0 || docId > 4294967295) {
    throw new TypeError(`docId inv\xE1lido: ${docId}`);
  }
  return docId.toString(16).padStart(8, "0");
};

// src/ui/shim/node-crypto.js
var K = new Uint32Array([
  1116352408,
  1899447441,
  3049323471,
  3921009573,
  961987163,
  1508970993,
  2453635748,
  2870763221,
  3624381080,
  310598401,
  607225278,
  1426881987,
  1925078388,
  2162078206,
  2614888103,
  3248222580,
  3835390401,
  4022224774,
  264347078,
  604807628,
  770255983,
  1249150122,
  1555081692,
  1996064986,
  2554220882,
  2821834349,
  2952996808,
  3210313671,
  3336571891,
  3584528711,
  113926993,
  338241895,
  666307205,
  773529912,
  1294757372,
  1396182291,
  1695183700,
  1986661051,
  2177026350,
  2456956037,
  2730485921,
  2820302411,
  3259730800,
  3345764771,
  3516065817,
  3600352804,
  4094571909,
  275423344,
  430227734,
  506948616,
  659060556,
  883997877,
  958139571,
  1322822218,
  1537002063,
  1747873779,
  1955562222,
  2024104815,
  2227730452,
  2361852424,
  2428436474,
  2756734187,
  3204031479,
  3329325298
]);
var rotr = (x, n) => (x >>> n | x << 32 - n) >>> 0;
function sha256(bytes) {
  const largoBits = bytes.length * 8;
  const conPadding = new Uint8Array((bytes.length + 8 >> 6) + 1 << 6);
  conPadding.set(bytes);
  conPadding[bytes.length] = 128;
  const vistaPadding = new DataView(conPadding.buffer);
  vistaPadding.setUint32(conPadding.length - 8, Math.floor(largoBits / 4294967296), false);
  vistaPadding.setUint32(conPadding.length - 4, largoBits >>> 0, false);
  const h = new Uint32Array([
    1779033703,
    3144134277,
    1013904242,
    2773480762,
    1359893119,
    2600822924,
    528734635,
    1541459225
  ]);
  const w = new Uint32Array(64);
  const vista = new DataView(conPadding.buffer);
  for (let bloque = 0; bloque < conPadding.length; bloque += 64) {
    for (let i = 0; i < 16; i++) w[i] = vista.getUint32(bloque + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ w[i - 15] >>> 3;
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ w[i - 2] >>> 10;
      w[i] = w[i - 16] + s0 + w[i - 7] + s1 >>> 0;
    }
    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = e & f ^ ~e & g;
      const temp1 = hh + S1 + ch + K[i] + w[i] >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = a & b ^ a & c ^ b & c;
      const temp2 = S0 + maj >>> 0;
      hh = g;
      g = f;
      f = e;
      e = d + temp1 >>> 0;
      d = c;
      c = b;
      b = a;
      a = temp1 + temp2 >>> 0;
    }
    h[0] = h[0] + a >>> 0;
    h[1] = h[1] + b >>> 0;
    h[2] = h[2] + c >>> 0;
    h[3] = h[3] + d >>> 0;
    h[4] = h[4] + e >>> 0;
    h[5] = h[5] + f >>> 0;
    h[6] = h[6] + g >>> 0;
    h[7] = h[7] + hh >>> 0;
  }
  const salida = new Uint8Array(32);
  const salidaVista = new DataView(salida.buffer);
  for (let i = 0; i < 8; i++) salidaVista.setUint32(i * 4, h[i], false);
  return salida;
}
function createHash(algorithm) {
  if (String(algorithm).toLowerCase() !== "sha256") {
    throw new Error(`este shim solo implementa sha256, no ${algorithm}`);
  }
  const partes = [];
  return {
    update(bytes) {
      partes.push(typeof bytes === "string" ? BufferShim.from(bytes) : bytes);
      return this;
    },
    digest(encoding) {
      const digest = sha256(BufferShim.concat(partes));
      return encoding === "hex" ? BufferShim.from(digest).toString("hex") : BufferShim.from(digest);
    }
  };
}

// src/ui/shim/node-zlib.js
var MAX_BLOQUE = 65535;
function deflateRawSync(data) {
  const entrada = data instanceof Uint8Array ? data : BufferShim.from(data);
  const bloques = Math.max(1, Math.ceil(entrada.length / MAX_BLOQUE));
  const salida = BufferShim.alloc(entrada.length + bloques * 5);
  let leido = 0;
  let escrito = 0;
  for (let i = 0; i < bloques; i++) {
    const largo = Math.min(MAX_BLOQUE, entrada.length - leido);
    const ultimo = i === bloques - 1;
    salida[escrito++] = ultimo ? 1 : 0;
    salida[escrito++] = largo & 255;
    salida[escrito++] = largo >>> 8 & 255;
    salida[escrito++] = ~largo & 255;
    salida[escrito++] = ~largo >>> 8 & 255;
    salida.set(entrada.subarray(leido, leido + largo), escrito);
    escrito += largo;
    leido += largo;
  }
  return salida.subarray(0, escrito);
}

// src/optical/protocol.js
var MAGIC = 1095192625;
var VERSION = 1;
var HEADER_LEN = 16;
var KIND = Object.freeze({ MANIFEST: 1, DATA: 2, PARITY: 3 });
var COMPRESSION = Object.freeze({ NONE: 0, DEFLATE_RAW: 1 });
var MANIFEST_EVERY = 12;
var KIND_VALUES = new Set(Object.values(KIND));
var U16_MAX = 65535;
var U32_MAX = 4294967295;
var DEFAULT_CHUNK_SIZE = 900;
var DEFAULT_PARITY_WINDOW = 8;
function assertUint(v, max, name) {
  if (!Number.isInteger(v) || v < 0 || v > max) {
    throw new RangeError(`${name} fuera de rango: ${v} (esperado entero 0..${max})`);
  }
}
function assertPositiveInt(v, max, name) {
  if (!Number.isInteger(v) || v < 1 || v > max) {
    throw new RangeError(`${name} inv\xE1lido: ${v} (esperado entero 1..${max})`);
  }
}
function asBuffer(bytes) {
  if (BufferShim.isBuffer(bytes)) return bytes;
  if (ArrayBuffer.isView(bytes)) return BufferShim.from(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return null;
}
function packHeader(kind, docId, index, total, payloadLen) {
  if (!KIND_VALUES.has(kind)) throw new RangeError(`kind desconocido: ${kind}`);
  assertUint(docId, U32_MAX, "docId");
  assertUint(index, U16_MAX, "index");
  assertUint(total, U16_MAX, "total");
  assertUint(payloadLen, U16_MAX, "payloadLen");
  const header = BufferShim.alloc(HEADER_LEN);
  header.writeUInt32BE(MAGIC, 0);
  header.writeUInt8(VERSION, 4);
  header.writeUInt8(kind, 5);
  header.writeUInt32BE(docId, 6);
  header.writeUInt16BE(index, 10);
  header.writeUInt16BE(total, 12);
  header.writeUInt16BE(payloadLen, 14);
  return header;
}
function packFrame(kind, docId, index, total, payload) {
  const body = BufferShim.isBuffer(payload) ? payload : BufferShim.from(payload ?? []);
  return BufferShim.concat([packHeader(kind, docId, index, total, body.length), body]);
}
function parseFrame(bytes) {
  try {
    const buf = asBuffer(bytes);
    if (buf === null || buf.length < HEADER_LEN) return null;
    if (buf.readUInt32BE(0) !== MAGIC) return null;
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
      payload: BufferShim.from(buf.subarray(HEADER_LEN))
    };
  } catch {
    return null;
  }
}
function xorWindow(chunks, chunkSize) {
  const parity = BufferShim.alloc(chunkSize);
  for (const chunk of chunks) {
    for (let i = 0; i < chunk.length; i++) parity[i] ^= chunk[i];
  }
  return parity;
}
function encodeDocument(document, options = {}) {
  const {
    name = "document.bin",
    mime = "application/octet-stream",
    chunkSize = DEFAULT_CHUNK_SIZE,
    parityWindow = DEFAULT_PARITY_WINDOW,
    compress = true
  } = options ?? {};
  const doc = asBuffer(document);
  if (doc === null) throw new TypeError("document debe ser Uint8Array o Buffer");
  if (doc.length === 0) throw new Error("documento vac\xEDo: no hay nada que transmitir");
  assertPositiveInt(chunkSize, U16_MAX, "chunkSize");
  assertPositiveInt(parityWindow, U16_MAX, "parityWindow");
  const digest = createHash("sha256").update(doc).digest();
  const docId = digest.readUInt32BE(0);
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
      `el documento necesita ${total} frames y el m\xE1ximo es ${U16_MAX}: sub\xED chunkSize`
    );
  }
  const manifest = {
    v: 1,
    sha256: digest.toString("hex"),
    length: doc.length,
    bodyLength: body.length,
    chunkSize,
    total,
    parityWindow,
    compression,
    name: String(name),
    mime: String(mime)
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
    KIND.MANIFEST,
    docId,
    0,
    total,
    BufferShim.from(JSON.stringify(manifest), "utf8")
  );
  return { docId, manifest, frames: { manifest: manifestFrame, data, parity } };
}
function readManifestFrame(frame) {
  const parsed = parseFrame(frame);
  if (parsed === null || parsed.kind !== KIND.MANIFEST) {
    throw new TypeError("el frame no es un MANIFEST AGP1 v\xE1lido");
  }
  const manifest = JSON.parse(parsed.payload.toString("utf8"));
  assertPositiveInt(manifest.chunkSize, U16_MAX, "manifest.chunkSize");
  assertPositiveInt(manifest.parityWindow, U16_MAX, "manifest.parityWindow");
  return manifest;
}
function cycleFrames(manifest) {
  const { total, parityWindow } = manifest;
  return 1 + total + Math.ceil(total / parityWindow);
}
function* carousel(source, options = {}) {
  const frames = source?.frames;
  if (!frames?.manifest || !Array.isArray(frames.data)) {
    throw new TypeError("carousel espera el resultado de encodeDocument");
  }
  const { manifestEvery = MANIFEST_EVERY } = options ?? {};
  assertPositiveInt(manifestEvery, U16_MAX, "manifestEvery");
  const manifest = source.manifest ?? readManifestFrame(frames.manifest);
  const { parityWindow } = manifest;
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

// src/ui/vendor/qrcode-core.js
var __create = Object.create;
var __defProp = Object.defineProperty;
var __getOwnPropDesc = Object.getOwnPropertyDescriptor;
var __getOwnPropNames = Object.getOwnPropertyNames;
var __getProtoOf = Object.getPrototypeOf;
var __hasOwnProp = Object.prototype.hasOwnProperty;
var __commonJS = (cb, mod) => function __require() {
  try {
    return mod || (0, cb[__getOwnPropNames(cb)[0]])((mod = { exports: {} }).exports, mod), mod.exports;
  } catch (e) {
    throw mod = 0, e;
  }
};
var __copyProps = (to, from, except, desc) => {
  if (from && typeof from === "object" || typeof from === "function") {
    for (let key of __getOwnPropNames(from))
      if (!__hasOwnProp.call(to, key) && key !== except)
        __defProp(to, key, { get: () => from[key], enumerable: !(desc = __getOwnPropDesc(from, key)) || desc.enumerable });
  }
  return to;
};
var __toESM = (mod, isNodeMode, target) => (target = mod != null ? __create(__getProtoOf(mod)) : {}, __copyProps(
  // If the importer is in node compatibility mode or this is not an ESM
  // file that has been converted to a CommonJS file using a Babel-
  // compatible transform (i.e. "__esModule" has not been set), then set
  // "default" to the CommonJS "module.exports" for node compatibility.
  isNodeMode || !mod || !mod.__esModule ? __defProp(target, "default", { value: mod, enumerable: true }) : target,
  mod
));
var require_utils = __commonJS({
  "node_modules/qrcode/lib/core/utils.js"(exports) {
    var toSJISFunction;
    var CODEWORDS_COUNT = [
      0,
      // Not used
      26,
      44,
      70,
      100,
      134,
      172,
      196,
      242,
      292,
      346,
      404,
      466,
      532,
      581,
      655,
      733,
      815,
      901,
      991,
      1085,
      1156,
      1258,
      1364,
      1474,
      1588,
      1706,
      1828,
      1921,
      2051,
      2185,
      2323,
      2465,
      2611,
      2761,
      2876,
      3034,
      3196,
      3362,
      3532,
      3706
    ];
    exports.getSymbolSize = function getSymbolSize(version) {
      if (!version) throw new Error('"version" cannot be null or undefined');
      if (version < 1 || version > 40) throw new Error('"version" should be in range from 1 to 40');
      return version * 4 + 17;
    };
    exports.getSymbolTotalCodewords = function getSymbolTotalCodewords(version) {
      return CODEWORDS_COUNT[version];
    };
    exports.getBCHDigit = function(data) {
      let digit = 0;
      while (data !== 0) {
        digit++;
        data >>>= 1;
      }
      return digit;
    };
    exports.setToSJISFunction = function setToSJISFunction(f) {
      if (typeof f !== "function") {
        throw new Error('"toSJISFunc" is not a valid function.');
      }
      toSJISFunction = f;
    };
    exports.isKanjiModeEnabled = function() {
      return typeof toSJISFunction !== "undefined";
    };
    exports.toSJIS = function toSJIS(kanji) {
      return toSJISFunction(kanji);
    };
  }
});
var require_error_correction_level = __commonJS({
  "node_modules/qrcode/lib/core/error-correction-level.js"(exports) {
    exports.L = { bit: 1 };
    exports.M = { bit: 0 };
    exports.Q = { bit: 3 };
    exports.H = { bit: 2 };
    function fromString(string) {
      if (typeof string !== "string") {
        throw new Error("Param is not a string");
      }
      const lcStr = string.toLowerCase();
      switch (lcStr) {
        case "l":
        case "low":
          return exports.L;
        case "m":
        case "medium":
          return exports.M;
        case "q":
        case "quartile":
          return exports.Q;
        case "h":
        case "high":
          return exports.H;
        default:
          throw new Error("Unknown EC Level: " + string);
      }
    }
    exports.isValid = function isValid(level) {
      return level && typeof level.bit !== "undefined" && level.bit >= 0 && level.bit < 4;
    };
    exports.from = function from(value, defaultValue) {
      if (exports.isValid(value)) {
        return value;
      }
      try {
        return fromString(value);
      } catch (e) {
        return defaultValue;
      }
    };
  }
});
var require_bit_buffer = __commonJS({
  "node_modules/qrcode/lib/core/bit-buffer.js"(exports, module) {
    function BitBuffer() {
      this.buffer = [];
      this.length = 0;
    }
    BitBuffer.prototype = {
      get: function(index) {
        const bufIndex = Math.floor(index / 8);
        return (this.buffer[bufIndex] >>> 7 - index % 8 & 1) === 1;
      },
      put: function(num, length) {
        for (let i = 0; i < length; i++) {
          this.putBit((num >>> length - i - 1 & 1) === 1);
        }
      },
      getLengthInBits: function() {
        return this.length;
      },
      putBit: function(bit) {
        const bufIndex = Math.floor(this.length / 8);
        if (this.buffer.length <= bufIndex) {
          this.buffer.push(0);
        }
        if (bit) {
          this.buffer[bufIndex] |= 128 >>> this.length % 8;
        }
        this.length++;
      }
    };
    module.exports = BitBuffer;
  }
});
var require_bit_matrix = __commonJS({
  "node_modules/qrcode/lib/core/bit-matrix.js"(exports, module) {
    function BitMatrix(size) {
      if (!size || size < 1) {
        throw new Error("BitMatrix size must be defined and greater than 0");
      }
      this.size = size;
      this.data = new Uint8Array(size * size);
      this.reservedBit = new Uint8Array(size * size);
    }
    BitMatrix.prototype.set = function(row, col, value, reserved) {
      const index = row * this.size + col;
      this.data[index] = value;
      if (reserved) this.reservedBit[index] = true;
    };
    BitMatrix.prototype.get = function(row, col) {
      return this.data[row * this.size + col];
    };
    BitMatrix.prototype.xor = function(row, col, value) {
      this.data[row * this.size + col] ^= value;
    };
    BitMatrix.prototype.isReserved = function(row, col) {
      return this.reservedBit[row * this.size + col];
    };
    module.exports = BitMatrix;
  }
});
var require_alignment_pattern = __commonJS({
  "node_modules/qrcode/lib/core/alignment-pattern.js"(exports) {
    var getSymbolSize = require_utils().getSymbolSize;
    exports.getRowColCoords = function getRowColCoords(version) {
      if (version === 1) return [];
      const posCount = Math.floor(version / 7) + 2;
      const size = getSymbolSize(version);
      const intervals = size === 145 ? 26 : Math.ceil((size - 13) / (2 * posCount - 2)) * 2;
      const positions = [size - 7];
      for (let i = 1; i < posCount - 1; i++) {
        positions[i] = positions[i - 1] - intervals;
      }
      positions.push(6);
      return positions.reverse();
    };
    exports.getPositions = function getPositions(version) {
      const coords = [];
      const pos = exports.getRowColCoords(version);
      const posLength = pos.length;
      for (let i = 0; i < posLength; i++) {
        for (let j = 0; j < posLength; j++) {
          if (i === 0 && j === 0 || // top-left
          i === 0 && j === posLength - 1 || // bottom-left
          i === posLength - 1 && j === 0) {
            continue;
          }
          coords.push([pos[i], pos[j]]);
        }
      }
      return coords;
    };
  }
});
var require_finder_pattern = __commonJS({
  "node_modules/qrcode/lib/core/finder-pattern.js"(exports) {
    var getSymbolSize = require_utils().getSymbolSize;
    var FINDER_PATTERN_SIZE = 7;
    exports.getPositions = function getPositions(version) {
      const size = getSymbolSize(version);
      return [
        // top-left
        [0, 0],
        // top-right
        [size - FINDER_PATTERN_SIZE, 0],
        // bottom-left
        [0, size - FINDER_PATTERN_SIZE]
      ];
    };
  }
});
var require_mask_pattern = __commonJS({
  "node_modules/qrcode/lib/core/mask-pattern.js"(exports) {
    exports.Patterns = {
      PATTERN000: 0,
      PATTERN001: 1,
      PATTERN010: 2,
      PATTERN011: 3,
      PATTERN100: 4,
      PATTERN101: 5,
      PATTERN110: 6,
      PATTERN111: 7
    };
    var PenaltyScores = {
      N1: 3,
      N2: 3,
      N3: 40,
      N4: 10
    };
    exports.isValid = function isValid(mask) {
      return mask != null && mask !== "" && !isNaN(mask) && mask >= 0 && mask <= 7;
    };
    exports.from = function from(value) {
      return exports.isValid(value) ? parseInt(value, 10) : void 0;
    };
    exports.getPenaltyN1 = function getPenaltyN1(data) {
      const size = data.size;
      let points = 0;
      let sameCountCol = 0;
      let sameCountRow = 0;
      let lastCol = null;
      let lastRow = null;
      for (let row = 0; row < size; row++) {
        sameCountCol = sameCountRow = 0;
        lastCol = lastRow = null;
        for (let col = 0; col < size; col++) {
          let module2 = data.get(row, col);
          if (module2 === lastCol) {
            sameCountCol++;
          } else {
            if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
            lastCol = module2;
            sameCountCol = 1;
          }
          module2 = data.get(col, row);
          if (module2 === lastRow) {
            sameCountRow++;
          } else {
            if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
            lastRow = module2;
            sameCountRow = 1;
          }
        }
        if (sameCountCol >= 5) points += PenaltyScores.N1 + (sameCountCol - 5);
        if (sameCountRow >= 5) points += PenaltyScores.N1 + (sameCountRow - 5);
      }
      return points;
    };
    exports.getPenaltyN2 = function getPenaltyN2(data) {
      const size = data.size;
      let points = 0;
      for (let row = 0; row < size - 1; row++) {
        for (let col = 0; col < size - 1; col++) {
          const last = data.get(row, col) + data.get(row, col + 1) + data.get(row + 1, col) + data.get(row + 1, col + 1);
          if (last === 4 || last === 0) points++;
        }
      }
      return points * PenaltyScores.N2;
    };
    exports.getPenaltyN3 = function getPenaltyN3(data) {
      const size = data.size;
      let points = 0;
      let bitsCol = 0;
      let bitsRow = 0;
      for (let row = 0; row < size; row++) {
        bitsCol = bitsRow = 0;
        for (let col = 0; col < size; col++) {
          bitsCol = bitsCol << 1 & 2047 | data.get(row, col);
          if (col >= 10 && (bitsCol === 1488 || bitsCol === 93)) points++;
          bitsRow = bitsRow << 1 & 2047 | data.get(col, row);
          if (col >= 10 && (bitsRow === 1488 || bitsRow === 93)) points++;
        }
      }
      return points * PenaltyScores.N3;
    };
    exports.getPenaltyN4 = function getPenaltyN4(data) {
      let darkCount = 0;
      const modulesCount = data.data.length;
      for (let i = 0; i < modulesCount; i++) darkCount += data.data[i];
      const k = Math.abs(Math.ceil(darkCount * 100 / modulesCount / 5) - 10);
      return k * PenaltyScores.N4;
    };
    function getMaskAt(maskPattern, i, j) {
      switch (maskPattern) {
        case exports.Patterns.PATTERN000:
          return (i + j) % 2 === 0;
        case exports.Patterns.PATTERN001:
          return i % 2 === 0;
        case exports.Patterns.PATTERN010:
          return j % 3 === 0;
        case exports.Patterns.PATTERN011:
          return (i + j) % 3 === 0;
        case exports.Patterns.PATTERN100:
          return (Math.floor(i / 2) + Math.floor(j / 3)) % 2 === 0;
        case exports.Patterns.PATTERN101:
          return i * j % 2 + i * j % 3 === 0;
        case exports.Patterns.PATTERN110:
          return (i * j % 2 + i * j % 3) % 2 === 0;
        case exports.Patterns.PATTERN111:
          return (i * j % 3 + (i + j) % 2) % 2 === 0;
        default:
          throw new Error("bad maskPattern:" + maskPattern);
      }
    }
    exports.applyMask = function applyMask(pattern, data) {
      const size = data.size;
      for (let col = 0; col < size; col++) {
        for (let row = 0; row < size; row++) {
          if (data.isReserved(row, col)) continue;
          data.xor(row, col, getMaskAt(pattern, row, col));
        }
      }
    };
    exports.getBestMask = function getBestMask(data, setupFormatFunc) {
      const numPatterns = Object.keys(exports.Patterns).length;
      let bestPattern = 0;
      let lowerPenalty = Infinity;
      for (let p = 0; p < numPatterns; p++) {
        setupFormatFunc(p);
        exports.applyMask(p, data);
        const penalty = exports.getPenaltyN1(data) + exports.getPenaltyN2(data) + exports.getPenaltyN3(data) + exports.getPenaltyN4(data);
        exports.applyMask(p, data);
        if (penalty < lowerPenalty) {
          lowerPenalty = penalty;
          bestPattern = p;
        }
      }
      return bestPattern;
    };
  }
});
var require_error_correction_code = __commonJS({
  "node_modules/qrcode/lib/core/error-correction-code.js"(exports) {
    var ECLevel = require_error_correction_level();
    var EC_BLOCKS_TABLE = [
      // L  M  Q  H
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      1,
      2,
      2,
      1,
      2,
      2,
      4,
      1,
      2,
      4,
      4,
      2,
      4,
      4,
      4,
      2,
      4,
      6,
      5,
      2,
      4,
      6,
      6,
      2,
      5,
      8,
      8,
      4,
      5,
      8,
      8,
      4,
      5,
      8,
      11,
      4,
      8,
      10,
      11,
      4,
      9,
      12,
      16,
      4,
      9,
      16,
      16,
      6,
      10,
      12,
      18,
      6,
      10,
      17,
      16,
      6,
      11,
      16,
      19,
      6,
      13,
      18,
      21,
      7,
      14,
      21,
      25,
      8,
      16,
      20,
      25,
      8,
      17,
      23,
      25,
      9,
      17,
      23,
      34,
      9,
      18,
      25,
      30,
      10,
      20,
      27,
      32,
      12,
      21,
      29,
      35,
      12,
      23,
      34,
      37,
      12,
      25,
      34,
      40,
      13,
      26,
      35,
      42,
      14,
      28,
      38,
      45,
      15,
      29,
      40,
      48,
      16,
      31,
      43,
      51,
      17,
      33,
      45,
      54,
      18,
      35,
      48,
      57,
      19,
      37,
      51,
      60,
      19,
      38,
      53,
      63,
      20,
      40,
      56,
      66,
      21,
      43,
      59,
      70,
      22,
      45,
      62,
      74,
      24,
      47,
      65,
      77,
      25,
      49,
      68,
      81
    ];
    var EC_CODEWORDS_TABLE = [
      // L  M  Q  H
      7,
      10,
      13,
      17,
      10,
      16,
      22,
      28,
      15,
      26,
      36,
      44,
      20,
      36,
      52,
      64,
      26,
      48,
      72,
      88,
      36,
      64,
      96,
      112,
      40,
      72,
      108,
      130,
      48,
      88,
      132,
      156,
      60,
      110,
      160,
      192,
      72,
      130,
      192,
      224,
      80,
      150,
      224,
      264,
      96,
      176,
      260,
      308,
      104,
      198,
      288,
      352,
      120,
      216,
      320,
      384,
      132,
      240,
      360,
      432,
      144,
      280,
      408,
      480,
      168,
      308,
      448,
      532,
      180,
      338,
      504,
      588,
      196,
      364,
      546,
      650,
      224,
      416,
      600,
      700,
      224,
      442,
      644,
      750,
      252,
      476,
      690,
      816,
      270,
      504,
      750,
      900,
      300,
      560,
      810,
      960,
      312,
      588,
      870,
      1050,
      336,
      644,
      952,
      1110,
      360,
      700,
      1020,
      1200,
      390,
      728,
      1050,
      1260,
      420,
      784,
      1140,
      1350,
      450,
      812,
      1200,
      1440,
      480,
      868,
      1290,
      1530,
      510,
      924,
      1350,
      1620,
      540,
      980,
      1440,
      1710,
      570,
      1036,
      1530,
      1800,
      570,
      1064,
      1590,
      1890,
      600,
      1120,
      1680,
      1980,
      630,
      1204,
      1770,
      2100,
      660,
      1260,
      1860,
      2220,
      720,
      1316,
      1950,
      2310,
      750,
      1372,
      2040,
      2430
    ];
    exports.getBlocksCount = function getBlocksCount(version, errorCorrectionLevel) {
      switch (errorCorrectionLevel) {
        case ECLevel.L:
          return EC_BLOCKS_TABLE[(version - 1) * 4 + 0];
        case ECLevel.M:
          return EC_BLOCKS_TABLE[(version - 1) * 4 + 1];
        case ECLevel.Q:
          return EC_BLOCKS_TABLE[(version - 1) * 4 + 2];
        case ECLevel.H:
          return EC_BLOCKS_TABLE[(version - 1) * 4 + 3];
        default:
          return void 0;
      }
    };
    exports.getTotalCodewordsCount = function getTotalCodewordsCount(version, errorCorrectionLevel) {
      switch (errorCorrectionLevel) {
        case ECLevel.L:
          return EC_CODEWORDS_TABLE[(version - 1) * 4 + 0];
        case ECLevel.M:
          return EC_CODEWORDS_TABLE[(version - 1) * 4 + 1];
        case ECLevel.Q:
          return EC_CODEWORDS_TABLE[(version - 1) * 4 + 2];
        case ECLevel.H:
          return EC_CODEWORDS_TABLE[(version - 1) * 4 + 3];
        default:
          return void 0;
      }
    };
  }
});
var require_galois_field = __commonJS({
  "node_modules/qrcode/lib/core/galois-field.js"(exports) {
    var EXP_TABLE = new Uint8Array(512);
    var LOG_TABLE = new Uint8Array(256);
    (function initTables() {
      let x = 1;
      for (let i = 0; i < 255; i++) {
        EXP_TABLE[i] = x;
        LOG_TABLE[x] = i;
        x <<= 1;
        if (x & 256) {
          x ^= 285;
        }
      }
      for (let i = 255; i < 512; i++) {
        EXP_TABLE[i] = EXP_TABLE[i - 255];
      }
    })();
    exports.log = function log(n) {
      if (n < 1) throw new Error("log(" + n + ")");
      return LOG_TABLE[n];
    };
    exports.exp = function exp(n) {
      return EXP_TABLE[n];
    };
    exports.mul = function mul(x, y) {
      if (x === 0 || y === 0) return 0;
      return EXP_TABLE[LOG_TABLE[x] + LOG_TABLE[y]];
    };
  }
});
var require_polynomial = __commonJS({
  "node_modules/qrcode/lib/core/polynomial.js"(exports) {
    var GF = require_galois_field();
    exports.mul = function mul(p1, p2) {
      const coeff = new Uint8Array(p1.length + p2.length - 1);
      for (let i = 0; i < p1.length; i++) {
        for (let j = 0; j < p2.length; j++) {
          coeff[i + j] ^= GF.mul(p1[i], p2[j]);
        }
      }
      return coeff;
    };
    exports.mod = function mod(divident, divisor) {
      let result = new Uint8Array(divident);
      while (result.length - divisor.length >= 0) {
        const coeff = result[0];
        for (let i = 0; i < divisor.length; i++) {
          result[i] ^= GF.mul(divisor[i], coeff);
        }
        let offset = 0;
        while (offset < result.length && result[offset] === 0) offset++;
        result = result.slice(offset);
      }
      return result;
    };
    exports.generateECPolynomial = function generateECPolynomial(degree) {
      let poly = new Uint8Array([1]);
      for (let i = 0; i < degree; i++) {
        poly = exports.mul(poly, new Uint8Array([1, GF.exp(i)]));
      }
      return poly;
    };
  }
});
var require_reed_solomon_encoder = __commonJS({
  "node_modules/qrcode/lib/core/reed-solomon-encoder.js"(exports, module) {
    var Polynomial = require_polynomial();
    function ReedSolomonEncoder(degree) {
      this.genPoly = void 0;
      this.degree = degree;
      if (this.degree) this.initialize(this.degree);
    }
    ReedSolomonEncoder.prototype.initialize = function initialize(degree) {
      this.degree = degree;
      this.genPoly = Polynomial.generateECPolynomial(this.degree);
    };
    ReedSolomonEncoder.prototype.encode = function encode(data) {
      if (!this.genPoly) {
        throw new Error("Encoder not initialized");
      }
      const paddedData = new Uint8Array(data.length + this.degree);
      paddedData.set(data);
      const remainder = Polynomial.mod(paddedData, this.genPoly);
      const start = this.degree - remainder.length;
      if (start > 0) {
        const buff = new Uint8Array(this.degree);
        buff.set(remainder, start);
        return buff;
      }
      return remainder;
    };
    module.exports = ReedSolomonEncoder;
  }
});
var require_version_check = __commonJS({
  "node_modules/qrcode/lib/core/version-check.js"(exports) {
    exports.isValid = function isValid(version) {
      return !isNaN(version) && version >= 1 && version <= 40;
    };
  }
});
var require_regex = __commonJS({
  "node_modules/qrcode/lib/core/regex.js"(exports) {
    var numeric = "[0-9]+";
    var alphanumeric = "[A-Z $%*+\\-./:]+";
    var kanji = "(?:[u3000-u303F]|[u3040-u309F]|[u30A0-u30FF]|[uFF00-uFFEF]|[u4E00-u9FAF]|[u2605-u2606]|[u2190-u2195]|u203B|[u2010u2015u2018u2019u2025u2026u201Cu201Du2225u2260]|[u0391-u0451]|[u00A7u00A8u00B1u00B4u00D7u00F7])+";
    kanji = kanji.replace(/u/g, "\\u");
    var byte = "(?:(?![A-Z0-9 $%*+\\-./:]|" + kanji + ")(?:.|[\r\n]))+";
    exports.KANJI = new RegExp(kanji, "g");
    exports.BYTE_KANJI = new RegExp("[^A-Z0-9 $%*+\\-./:]+", "g");
    exports.BYTE = new RegExp(byte, "g");
    exports.NUMERIC = new RegExp(numeric, "g");
    exports.ALPHANUMERIC = new RegExp(alphanumeric, "g");
    var TEST_KANJI = new RegExp("^" + kanji + "$");
    var TEST_NUMERIC = new RegExp("^" + numeric + "$");
    var TEST_ALPHANUMERIC = new RegExp("^[A-Z0-9 $%*+\\-./:]+$");
    exports.testKanji = function testKanji(str) {
      return TEST_KANJI.test(str);
    };
    exports.testNumeric = function testNumeric(str) {
      return TEST_NUMERIC.test(str);
    };
    exports.testAlphanumeric = function testAlphanumeric(str) {
      return TEST_ALPHANUMERIC.test(str);
    };
  }
});
var require_mode = __commonJS({
  "node_modules/qrcode/lib/core/mode.js"(exports) {
    var VersionCheck = require_version_check();
    var Regex = require_regex();
    exports.NUMERIC = {
      id: "Numeric",
      bit: 1 << 0,
      ccBits: [10, 12, 14]
    };
    exports.ALPHANUMERIC = {
      id: "Alphanumeric",
      bit: 1 << 1,
      ccBits: [9, 11, 13]
    };
    exports.BYTE = {
      id: "Byte",
      bit: 1 << 2,
      ccBits: [8, 16, 16]
    };
    exports.KANJI = {
      id: "Kanji",
      bit: 1 << 3,
      ccBits: [8, 10, 12]
    };
    exports.MIXED = {
      bit: -1
    };
    exports.getCharCountIndicator = function getCharCountIndicator(mode, version) {
      if (!mode.ccBits) throw new Error("Invalid mode: " + mode);
      if (!VersionCheck.isValid(version)) {
        throw new Error("Invalid version: " + version);
      }
      if (version >= 1 && version < 10) return mode.ccBits[0];
      else if (version < 27) return mode.ccBits[1];
      return mode.ccBits[2];
    };
    exports.getBestModeForData = function getBestModeForData(dataStr) {
      if (Regex.testNumeric(dataStr)) return exports.NUMERIC;
      else if (Regex.testAlphanumeric(dataStr)) return exports.ALPHANUMERIC;
      else if (Regex.testKanji(dataStr)) return exports.KANJI;
      else return exports.BYTE;
    };
    exports.toString = function toString(mode) {
      if (mode && mode.id) return mode.id;
      throw new Error("Invalid mode");
    };
    exports.isValid = function isValid(mode) {
      return mode && mode.bit && mode.ccBits;
    };
    function fromString(string) {
      if (typeof string !== "string") {
        throw new Error("Param is not a string");
      }
      const lcStr = string.toLowerCase();
      switch (lcStr) {
        case "numeric":
          return exports.NUMERIC;
        case "alphanumeric":
          return exports.ALPHANUMERIC;
        case "kanji":
          return exports.KANJI;
        case "byte":
          return exports.BYTE;
        default:
          throw new Error("Unknown mode: " + string);
      }
    }
    exports.from = function from(value, defaultValue) {
      if (exports.isValid(value)) {
        return value;
      }
      try {
        return fromString(value);
      } catch (e) {
        return defaultValue;
      }
    };
  }
});
var require_version = __commonJS({
  "node_modules/qrcode/lib/core/version.js"(exports) {
    var Utils = require_utils();
    var ECCode = require_error_correction_code();
    var ECLevel = require_error_correction_level();
    var Mode = require_mode();
    var VersionCheck = require_version_check();
    var G18 = 1 << 12 | 1 << 11 | 1 << 10 | 1 << 9 | 1 << 8 | 1 << 5 | 1 << 2 | 1 << 0;
    var G18_BCH = Utils.getBCHDigit(G18);
    function getBestVersionForDataLength(mode, length, errorCorrectionLevel) {
      for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
        if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, mode)) {
          return currentVersion;
        }
      }
      return void 0;
    }
    function getReservedBitsCount(mode, version) {
      return Mode.getCharCountIndicator(mode, version) + 4;
    }
    function getTotalBitsFromDataArray(segments, version) {
      let totalBits = 0;
      segments.forEach(function(data) {
        const reservedBits = getReservedBitsCount(data.mode, version);
        totalBits += reservedBits + data.getBitsLength();
      });
      return totalBits;
    }
    function getBestVersionForMixedData(segments, errorCorrectionLevel) {
      for (let currentVersion = 1; currentVersion <= 40; currentVersion++) {
        const length = getTotalBitsFromDataArray(segments, currentVersion);
        if (length <= exports.getCapacity(currentVersion, errorCorrectionLevel, Mode.MIXED)) {
          return currentVersion;
        }
      }
      return void 0;
    }
    exports.from = function from(value, defaultValue) {
      if (VersionCheck.isValid(value)) {
        return parseInt(value, 10);
      }
      return defaultValue;
    };
    exports.getCapacity = function getCapacity(version, errorCorrectionLevel, mode) {
      if (!VersionCheck.isValid(version)) {
        throw new Error("Invalid QR Code version");
      }
      if (typeof mode === "undefined") mode = Mode.BYTE;
      const totalCodewords = Utils.getSymbolTotalCodewords(version);
      const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
      const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
      if (mode === Mode.MIXED) return dataTotalCodewordsBits;
      const usableBits = dataTotalCodewordsBits - getReservedBitsCount(mode, version);
      switch (mode) {
        case Mode.NUMERIC:
          return Math.floor(usableBits / 10 * 3);
        case Mode.ALPHANUMERIC:
          return Math.floor(usableBits / 11 * 2);
        case Mode.KANJI:
          return Math.floor(usableBits / 13);
        case Mode.BYTE:
        default:
          return Math.floor(usableBits / 8);
      }
    };
    exports.getBestVersionForData = function getBestVersionForData(data, errorCorrectionLevel) {
      let seg;
      const ecl = ECLevel.from(errorCorrectionLevel, ECLevel.M);
      if (Array.isArray(data)) {
        if (data.length > 1) {
          return getBestVersionForMixedData(data, ecl);
        }
        if (data.length === 0) {
          return 1;
        }
        seg = data[0];
      } else {
        seg = data;
      }
      return getBestVersionForDataLength(seg.mode, seg.getLength(), ecl);
    };
    exports.getEncodedBits = function getEncodedBits(version) {
      if (!VersionCheck.isValid(version) || version < 7) {
        throw new Error("Invalid QR Code version");
      }
      let d = version << 12;
      while (Utils.getBCHDigit(d) - G18_BCH >= 0) {
        d ^= G18 << Utils.getBCHDigit(d) - G18_BCH;
      }
      return version << 12 | d;
    };
  }
});
var require_format_info = __commonJS({
  "node_modules/qrcode/lib/core/format-info.js"(exports) {
    var Utils = require_utils();
    var G15 = 1 << 10 | 1 << 8 | 1 << 5 | 1 << 4 | 1 << 2 | 1 << 1 | 1 << 0;
    var G15_MASK = 1 << 14 | 1 << 12 | 1 << 10 | 1 << 4 | 1 << 1;
    var G15_BCH = Utils.getBCHDigit(G15);
    exports.getEncodedBits = function getEncodedBits(errorCorrectionLevel, mask) {
      const data = errorCorrectionLevel.bit << 3 | mask;
      let d = data << 10;
      while (Utils.getBCHDigit(d) - G15_BCH >= 0) {
        d ^= G15 << Utils.getBCHDigit(d) - G15_BCH;
      }
      return (data << 10 | d) ^ G15_MASK;
    };
  }
});
var require_numeric_data = __commonJS({
  "node_modules/qrcode/lib/core/numeric-data.js"(exports, module) {
    var Mode = require_mode();
    function NumericData(data) {
      this.mode = Mode.NUMERIC;
      this.data = data.toString();
    }
    NumericData.getBitsLength = function getBitsLength(length) {
      return 10 * Math.floor(length / 3) + (length % 3 ? length % 3 * 3 + 1 : 0);
    };
    NumericData.prototype.getLength = function getLength() {
      return this.data.length;
    };
    NumericData.prototype.getBitsLength = function getBitsLength() {
      return NumericData.getBitsLength(this.data.length);
    };
    NumericData.prototype.write = function write(bitBuffer) {
      let i, group, value;
      for (i = 0; i + 3 <= this.data.length; i += 3) {
        group = this.data.substr(i, 3);
        value = parseInt(group, 10);
        bitBuffer.put(value, 10);
      }
      const remainingNum = this.data.length - i;
      if (remainingNum > 0) {
        group = this.data.substr(i);
        value = parseInt(group, 10);
        bitBuffer.put(value, remainingNum * 3 + 1);
      }
    };
    module.exports = NumericData;
  }
});
var require_alphanumeric_data = __commonJS({
  "node_modules/qrcode/lib/core/alphanumeric-data.js"(exports, module) {
    var Mode = require_mode();
    var ALPHA_NUM_CHARS = [
      "0",
      "1",
      "2",
      "3",
      "4",
      "5",
      "6",
      "7",
      "8",
      "9",
      "A",
      "B",
      "C",
      "D",
      "E",
      "F",
      "G",
      "H",
      "I",
      "J",
      "K",
      "L",
      "M",
      "N",
      "O",
      "P",
      "Q",
      "R",
      "S",
      "T",
      "U",
      "V",
      "W",
      "X",
      "Y",
      "Z",
      " ",
      "$",
      "%",
      "*",
      "+",
      "-",
      ".",
      "/",
      ":"
    ];
    function AlphanumericData(data) {
      this.mode = Mode.ALPHANUMERIC;
      this.data = data;
    }
    AlphanumericData.getBitsLength = function getBitsLength(length) {
      return 11 * Math.floor(length / 2) + 6 * (length % 2);
    };
    AlphanumericData.prototype.getLength = function getLength() {
      return this.data.length;
    };
    AlphanumericData.prototype.getBitsLength = function getBitsLength() {
      return AlphanumericData.getBitsLength(this.data.length);
    };
    AlphanumericData.prototype.write = function write(bitBuffer) {
      let i;
      for (i = 0; i + 2 <= this.data.length; i += 2) {
        let value = ALPHA_NUM_CHARS.indexOf(this.data[i]) * 45;
        value += ALPHA_NUM_CHARS.indexOf(this.data[i + 1]);
        bitBuffer.put(value, 11);
      }
      if (this.data.length % 2) {
        bitBuffer.put(ALPHA_NUM_CHARS.indexOf(this.data[i]), 6);
      }
    };
    module.exports = AlphanumericData;
  }
});
var require_byte_data = __commonJS({
  "node_modules/qrcode/lib/core/byte-data.js"(exports, module) {
    var Mode = require_mode();
    function ByteData(data) {
      this.mode = Mode.BYTE;
      if (typeof data === "string") {
        this.data = new TextEncoder().encode(data);
      } else {
        this.data = new Uint8Array(data);
      }
    }
    ByteData.getBitsLength = function getBitsLength(length) {
      return length * 8;
    };
    ByteData.prototype.getLength = function getLength() {
      return this.data.length;
    };
    ByteData.prototype.getBitsLength = function getBitsLength() {
      return ByteData.getBitsLength(this.data.length);
    };
    ByteData.prototype.write = function(bitBuffer) {
      for (let i = 0, l = this.data.length; i < l; i++) {
        bitBuffer.put(this.data[i], 8);
      }
    };
    module.exports = ByteData;
  }
});
var require_kanji_data = __commonJS({
  "node_modules/qrcode/lib/core/kanji-data.js"(exports, module) {
    var Mode = require_mode();
    var Utils = require_utils();
    function KanjiData(data) {
      this.mode = Mode.KANJI;
      this.data = data;
    }
    KanjiData.getBitsLength = function getBitsLength(length) {
      return length * 13;
    };
    KanjiData.prototype.getLength = function getLength() {
      return this.data.length;
    };
    KanjiData.prototype.getBitsLength = function getBitsLength() {
      return KanjiData.getBitsLength(this.data.length);
    };
    KanjiData.prototype.write = function(bitBuffer) {
      let i;
      for (i = 0; i < this.data.length; i++) {
        let value = Utils.toSJIS(this.data[i]);
        if (value >= 33088 && value <= 40956) {
          value -= 33088;
        } else if (value >= 57408 && value <= 60351) {
          value -= 49472;
        } else {
          throw new Error(
            "Invalid SJIS character: " + this.data[i] + "\nMake sure your charset is UTF-8"
          );
        }
        value = (value >>> 8 & 255) * 192 + (value & 255);
        bitBuffer.put(value, 13);
      }
    };
    module.exports = KanjiData;
  }
});
var require_dijkstra = __commonJS({
  "node_modules/dijkstrajs/dijkstra.js"(exports, module) {
    "use strict";
    var dijkstra = {
      single_source_shortest_paths: function(graph, s, d) {
        var predecessors = {};
        var costs = {};
        costs[s] = 0;
        var open = dijkstra.PriorityQueue.make();
        open.push(s, 0);
        var closest, u, v, cost_of_s_to_u, adjacent_nodes, cost_of_e, cost_of_s_to_u_plus_cost_of_e, cost_of_s_to_v, first_visit;
        while (!open.empty()) {
          closest = open.pop();
          u = closest.value;
          cost_of_s_to_u = closest.cost;
          adjacent_nodes = graph[u] || {};
          for (v in adjacent_nodes) {
            if (adjacent_nodes.hasOwnProperty(v)) {
              cost_of_e = adjacent_nodes[v];
              cost_of_s_to_u_plus_cost_of_e = cost_of_s_to_u + cost_of_e;
              cost_of_s_to_v = costs[v];
              first_visit = typeof costs[v] === "undefined";
              if (first_visit || cost_of_s_to_v > cost_of_s_to_u_plus_cost_of_e) {
                costs[v] = cost_of_s_to_u_plus_cost_of_e;
                open.push(v, cost_of_s_to_u_plus_cost_of_e);
                predecessors[v] = u;
              }
            }
          }
        }
        if (typeof d !== "undefined" && typeof costs[d] === "undefined") {
          var msg = ["Could not find a path from ", s, " to ", d, "."].join("");
          throw new Error(msg);
        }
        return predecessors;
      },
      extract_shortest_path_from_predecessor_list: function(predecessors, d) {
        var nodes = [];
        var u = d;
        var predecessor;
        while (u) {
          nodes.push(u);
          predecessor = predecessors[u];
          u = predecessors[u];
        }
        nodes.reverse();
        return nodes;
      },
      find_path: function(graph, s, d) {
        var predecessors = dijkstra.single_source_shortest_paths(graph, s, d);
        return dijkstra.extract_shortest_path_from_predecessor_list(
          predecessors,
          d
        );
      },
      /**
       * A very naive priority queue implementation.
       */
      PriorityQueue: {
        make: function(opts) {
          var T = dijkstra.PriorityQueue, t = {}, key;
          opts = opts || {};
          for (key in T) {
            if (T.hasOwnProperty(key)) {
              t[key] = T[key];
            }
          }
          t.queue = [];
          t.sorter = opts.sorter || T.default_sorter;
          return t;
        },
        default_sorter: function(a, b) {
          return a.cost - b.cost;
        },
        /**
         * Add a new item to the queue and ensure the highest priority element
         * is at the front of the queue.
         */
        push: function(value, cost) {
          var item = { value, cost };
          this.queue.push(item);
          this.queue.sort(this.sorter);
        },
        /**
         * Return the highest priority element in the queue.
         */
        pop: function() {
          return this.queue.shift();
        },
        empty: function() {
          return this.queue.length === 0;
        }
      }
    };
    if (typeof module !== "undefined") {
      module.exports = dijkstra;
    }
  }
});
var require_segments = __commonJS({
  "node_modules/qrcode/lib/core/segments.js"(exports) {
    var Mode = require_mode();
    var NumericData = require_numeric_data();
    var AlphanumericData = require_alphanumeric_data();
    var ByteData = require_byte_data();
    var KanjiData = require_kanji_data();
    var Regex = require_regex();
    var Utils = require_utils();
    var dijkstra = require_dijkstra();
    function getStringByteLength(str) {
      return unescape(encodeURIComponent(str)).length;
    }
    function getSegments(regex, mode, str) {
      const segments = [];
      let result;
      while ((result = regex.exec(str)) !== null) {
        segments.push({
          data: result[0],
          index: result.index,
          mode,
          length: result[0].length
        });
      }
      return segments;
    }
    function getSegmentsFromString(dataStr) {
      const numSegs = getSegments(Regex.NUMERIC, Mode.NUMERIC, dataStr);
      const alphaNumSegs = getSegments(Regex.ALPHANUMERIC, Mode.ALPHANUMERIC, dataStr);
      let byteSegs;
      let kanjiSegs;
      if (Utils.isKanjiModeEnabled()) {
        byteSegs = getSegments(Regex.BYTE, Mode.BYTE, dataStr);
        kanjiSegs = getSegments(Regex.KANJI, Mode.KANJI, dataStr);
      } else {
        byteSegs = getSegments(Regex.BYTE_KANJI, Mode.BYTE, dataStr);
        kanjiSegs = [];
      }
      const segs = numSegs.concat(alphaNumSegs, byteSegs, kanjiSegs);
      return segs.sort(function(s1, s2) {
        return s1.index - s2.index;
      }).map(function(obj) {
        return {
          data: obj.data,
          mode: obj.mode,
          length: obj.length
        };
      });
    }
    function getSegmentBitsLength(length, mode) {
      switch (mode) {
        case Mode.NUMERIC:
          return NumericData.getBitsLength(length);
        case Mode.ALPHANUMERIC:
          return AlphanumericData.getBitsLength(length);
        case Mode.KANJI:
          return KanjiData.getBitsLength(length);
        case Mode.BYTE:
          return ByteData.getBitsLength(length);
      }
    }
    function mergeSegments(segs) {
      return segs.reduce(function(acc, curr) {
        const prevSeg = acc.length - 1 >= 0 ? acc[acc.length - 1] : null;
        if (prevSeg && prevSeg.mode === curr.mode) {
          acc[acc.length - 1].data += curr.data;
          return acc;
        }
        acc.push(curr);
        return acc;
      }, []);
    }
    function buildNodes(segs) {
      const nodes = [];
      for (let i = 0; i < segs.length; i++) {
        const seg = segs[i];
        switch (seg.mode) {
          case Mode.NUMERIC:
            nodes.push([
              seg,
              { data: seg.data, mode: Mode.ALPHANUMERIC, length: seg.length },
              { data: seg.data, mode: Mode.BYTE, length: seg.length }
            ]);
            break;
          case Mode.ALPHANUMERIC:
            nodes.push([
              seg,
              { data: seg.data, mode: Mode.BYTE, length: seg.length }
            ]);
            break;
          case Mode.KANJI:
            nodes.push([
              seg,
              { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
            ]);
            break;
          case Mode.BYTE:
            nodes.push([
              { data: seg.data, mode: Mode.BYTE, length: getStringByteLength(seg.data) }
            ]);
        }
      }
      return nodes;
    }
    function buildGraph(nodes, version) {
      const table = {};
      const graph = { start: {} };
      let prevNodeIds = ["start"];
      for (let i = 0; i < nodes.length; i++) {
        const nodeGroup = nodes[i];
        const currentNodeIds = [];
        for (let j = 0; j < nodeGroup.length; j++) {
          const node = nodeGroup[j];
          const key = "" + i + j;
          currentNodeIds.push(key);
          table[key] = { node, lastCount: 0 };
          graph[key] = {};
          for (let n = 0; n < prevNodeIds.length; n++) {
            const prevNodeId = prevNodeIds[n];
            if (table[prevNodeId] && table[prevNodeId].node.mode === node.mode) {
              graph[prevNodeId][key] = getSegmentBitsLength(table[prevNodeId].lastCount + node.length, node.mode) - getSegmentBitsLength(table[prevNodeId].lastCount, node.mode);
              table[prevNodeId].lastCount += node.length;
            } else {
              if (table[prevNodeId]) table[prevNodeId].lastCount = node.length;
              graph[prevNodeId][key] = getSegmentBitsLength(node.length, node.mode) + 4 + Mode.getCharCountIndicator(node.mode, version);
            }
          }
        }
        prevNodeIds = currentNodeIds;
      }
      for (let n = 0; n < prevNodeIds.length; n++) {
        graph[prevNodeIds[n]].end = 0;
      }
      return { map: graph, table };
    }
    function buildSingleSegment(data, modesHint) {
      let mode;
      const bestMode = Mode.getBestModeForData(data);
      mode = Mode.from(modesHint, bestMode);
      if (mode !== Mode.BYTE && mode.bit < bestMode.bit) {
        throw new Error('"' + data + '" cannot be encoded with mode ' + Mode.toString(mode) + ".\n Suggested mode is: " + Mode.toString(bestMode));
      }
      if (mode === Mode.KANJI && !Utils.isKanjiModeEnabled()) {
        mode = Mode.BYTE;
      }
      switch (mode) {
        case Mode.NUMERIC:
          return new NumericData(data);
        case Mode.ALPHANUMERIC:
          return new AlphanumericData(data);
        case Mode.KANJI:
          return new KanjiData(data);
        case Mode.BYTE:
          return new ByteData(data);
      }
    }
    exports.fromArray = function fromArray(array) {
      return array.reduce(function(acc, seg) {
        if (typeof seg === "string") {
          acc.push(buildSingleSegment(seg, null));
        } else if (seg.data) {
          acc.push(buildSingleSegment(seg.data, seg.mode));
        }
        return acc;
      }, []);
    };
    exports.fromString = function fromString(data, version) {
      const segs = getSegmentsFromString(data, Utils.isKanjiModeEnabled());
      const nodes = buildNodes(segs);
      const graph = buildGraph(nodes, version);
      const path = dijkstra.find_path(graph.map, "start", "end");
      const optimizedSegs = [];
      for (let i = 1; i < path.length - 1; i++) {
        optimizedSegs.push(graph.table[path[i]].node);
      }
      return exports.fromArray(mergeSegments(optimizedSegs));
    };
    exports.rawSplit = function rawSplit(data) {
      return exports.fromArray(
        getSegmentsFromString(data, Utils.isKanjiModeEnabled())
      );
    };
  }
});
var require_qrcode = __commonJS({
  "node_modules/qrcode/lib/core/qrcode.js"(exports) {
    var Utils = require_utils();
    var ECLevel = require_error_correction_level();
    var BitBuffer = require_bit_buffer();
    var BitMatrix = require_bit_matrix();
    var AlignmentPattern = require_alignment_pattern();
    var FinderPattern = require_finder_pattern();
    var MaskPattern = require_mask_pattern();
    var ECCode = require_error_correction_code();
    var ReedSolomonEncoder = require_reed_solomon_encoder();
    var Version = require_version();
    var FormatInfo = require_format_info();
    var Mode = require_mode();
    var Segments = require_segments();
    function setupFinderPattern(matrix, version) {
      const size = matrix.size;
      const pos = FinderPattern.getPositions(version);
      for (let i = 0; i < pos.length; i++) {
        const row = pos[i][0];
        const col = pos[i][1];
        for (let r = -1; r <= 7; r++) {
          if (row + r <= -1 || size <= row + r) continue;
          for (let c = -1; c <= 7; c++) {
            if (col + c <= -1 || size <= col + c) continue;
            if (r >= 0 && r <= 6 && (c === 0 || c === 6) || c >= 0 && c <= 6 && (r === 0 || r === 6) || r >= 2 && r <= 4 && c >= 2 && c <= 4) {
              matrix.set(row + r, col + c, true, true);
            } else {
              matrix.set(row + r, col + c, false, true);
            }
          }
        }
      }
    }
    function setupTimingPattern(matrix) {
      const size = matrix.size;
      for (let r = 8; r < size - 8; r++) {
        const value = r % 2 === 0;
        matrix.set(r, 6, value, true);
        matrix.set(6, r, value, true);
      }
    }
    function setupAlignmentPattern(matrix, version) {
      const pos = AlignmentPattern.getPositions(version);
      for (let i = 0; i < pos.length; i++) {
        const row = pos[i][0];
        const col = pos[i][1];
        for (let r = -2; r <= 2; r++) {
          for (let c = -2; c <= 2; c++) {
            if (r === -2 || r === 2 || c === -2 || c === 2 || r === 0 && c === 0) {
              matrix.set(row + r, col + c, true, true);
            } else {
              matrix.set(row + r, col + c, false, true);
            }
          }
        }
      }
    }
    function setupVersionInfo(matrix, version) {
      const size = matrix.size;
      const bits = Version.getEncodedBits(version);
      let row, col, mod;
      for (let i = 0; i < 18; i++) {
        row = Math.floor(i / 3);
        col = i % 3 + size - 8 - 3;
        mod = (bits >> i & 1) === 1;
        matrix.set(row, col, mod, true);
        matrix.set(col, row, mod, true);
      }
    }
    function setupFormatInfo(matrix, errorCorrectionLevel, maskPattern) {
      const size = matrix.size;
      const bits = FormatInfo.getEncodedBits(errorCorrectionLevel, maskPattern);
      let i, mod;
      for (i = 0; i < 15; i++) {
        mod = (bits >> i & 1) === 1;
        if (i < 6) {
          matrix.set(i, 8, mod, true);
        } else if (i < 8) {
          matrix.set(i + 1, 8, mod, true);
        } else {
          matrix.set(size - 15 + i, 8, mod, true);
        }
        if (i < 8) {
          matrix.set(8, size - i - 1, mod, true);
        } else if (i < 9) {
          matrix.set(8, 15 - i - 1 + 1, mod, true);
        } else {
          matrix.set(8, 15 - i - 1, mod, true);
        }
      }
      matrix.set(size - 8, 8, 1, true);
    }
    function setupData(matrix, data) {
      const size = matrix.size;
      let inc = -1;
      let row = size - 1;
      let bitIndex = 7;
      let byteIndex = 0;
      for (let col = size - 1; col > 0; col -= 2) {
        if (col === 6) col--;
        while (true) {
          for (let c = 0; c < 2; c++) {
            if (!matrix.isReserved(row, col - c)) {
              let dark = false;
              if (byteIndex < data.length) {
                dark = (data[byteIndex] >>> bitIndex & 1) === 1;
              }
              matrix.set(row, col - c, dark);
              bitIndex--;
              if (bitIndex === -1) {
                byteIndex++;
                bitIndex = 7;
              }
            }
          }
          row += inc;
          if (row < 0 || size <= row) {
            row -= inc;
            inc = -inc;
            break;
          }
        }
      }
    }
    function createData(version, errorCorrectionLevel, segments) {
      const buffer = new BitBuffer();
      segments.forEach(function(data) {
        buffer.put(data.mode.bit, 4);
        buffer.put(data.getLength(), Mode.getCharCountIndicator(data.mode, version));
        data.write(buffer);
      });
      const totalCodewords = Utils.getSymbolTotalCodewords(version);
      const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
      const dataTotalCodewordsBits = (totalCodewords - ecTotalCodewords) * 8;
      if (buffer.getLengthInBits() + 4 <= dataTotalCodewordsBits) {
        buffer.put(0, 4);
      }
      while (buffer.getLengthInBits() % 8 !== 0) {
        buffer.putBit(0);
      }
      const remainingByte = (dataTotalCodewordsBits - buffer.getLengthInBits()) / 8;
      for (let i = 0; i < remainingByte; i++) {
        buffer.put(i % 2 ? 17 : 236, 8);
      }
      return createCodewords(buffer, version, errorCorrectionLevel);
    }
    function createCodewords(bitBuffer, version, errorCorrectionLevel) {
      const totalCodewords = Utils.getSymbolTotalCodewords(version);
      const ecTotalCodewords = ECCode.getTotalCodewordsCount(version, errorCorrectionLevel);
      const dataTotalCodewords = totalCodewords - ecTotalCodewords;
      const ecTotalBlocks = ECCode.getBlocksCount(version, errorCorrectionLevel);
      const blocksInGroup2 = totalCodewords % ecTotalBlocks;
      const blocksInGroup1 = ecTotalBlocks - blocksInGroup2;
      const totalCodewordsInGroup1 = Math.floor(totalCodewords / ecTotalBlocks);
      const dataCodewordsInGroup1 = Math.floor(dataTotalCodewords / ecTotalBlocks);
      const dataCodewordsInGroup2 = dataCodewordsInGroup1 + 1;
      const ecCount = totalCodewordsInGroup1 - dataCodewordsInGroup1;
      const rs = new ReedSolomonEncoder(ecCount);
      let offset = 0;
      const dcData = new Array(ecTotalBlocks);
      const ecData = new Array(ecTotalBlocks);
      let maxDataSize = 0;
      const buffer = new Uint8Array(bitBuffer.buffer);
      for (let b = 0; b < ecTotalBlocks; b++) {
        const dataSize = b < blocksInGroup1 ? dataCodewordsInGroup1 : dataCodewordsInGroup2;
        dcData[b] = buffer.slice(offset, offset + dataSize);
        ecData[b] = rs.encode(dcData[b]);
        offset += dataSize;
        maxDataSize = Math.max(maxDataSize, dataSize);
      }
      const data = new Uint8Array(totalCodewords);
      let index = 0;
      let i, r;
      for (i = 0; i < maxDataSize; i++) {
        for (r = 0; r < ecTotalBlocks; r++) {
          if (i < dcData[r].length) {
            data[index++] = dcData[r][i];
          }
        }
      }
      for (i = 0; i < ecCount; i++) {
        for (r = 0; r < ecTotalBlocks; r++) {
          data[index++] = ecData[r][i];
        }
      }
      return data;
    }
    function createSymbol(data, version, errorCorrectionLevel, maskPattern) {
      let segments;
      if (Array.isArray(data)) {
        segments = Segments.fromArray(data);
      } else if (typeof data === "string") {
        let estimatedVersion = version;
        if (!estimatedVersion) {
          const rawSegments = Segments.rawSplit(data);
          estimatedVersion = Version.getBestVersionForData(rawSegments, errorCorrectionLevel);
        }
        segments = Segments.fromString(data, estimatedVersion || 40);
      } else {
        throw new Error("Invalid data");
      }
      const bestVersion = Version.getBestVersionForData(segments, errorCorrectionLevel);
      if (!bestVersion) {
        throw new Error("The amount of data is too big to be stored in a QR Code");
      }
      if (!version) {
        version = bestVersion;
      } else if (version < bestVersion) {
        throw new Error(
          "\nThe chosen QR Code version cannot contain this amount of data.\nMinimum version required to store current data is: " + bestVersion + ".\n"
        );
      }
      const dataBits = createData(version, errorCorrectionLevel, segments);
      const moduleCount = Utils.getSymbolSize(version);
      const modules = new BitMatrix(moduleCount);
      setupFinderPattern(modules, version);
      setupTimingPattern(modules);
      setupAlignmentPattern(modules, version);
      setupFormatInfo(modules, errorCorrectionLevel, 0);
      if (version >= 7) {
        setupVersionInfo(modules, version);
      }
      setupData(modules, dataBits);
      if (isNaN(maskPattern)) {
        maskPattern = MaskPattern.getBestMask(
          modules,
          setupFormatInfo.bind(null, modules, errorCorrectionLevel)
        );
      }
      MaskPattern.applyMask(maskPattern, modules);
      setupFormatInfo(modules, errorCorrectionLevel, maskPattern);
      return {
        modules,
        version,
        errorCorrectionLevel,
        maskPattern,
        segments
      };
    }
    exports.create = function create2(data, options) {
      if (typeof data === "undefined" || data === "") {
        throw new Error("No input text");
      }
      let errorCorrectionLevel = ECLevel.M;
      let version;
      let mask;
      if (typeof options !== "undefined") {
        errorCorrectionLevel = ECLevel.from(options.errorCorrectionLevel, ECLevel.M);
        version = Version.from(options.version);
        mask = MaskPattern.from(options.maskPattern);
        if (options.toSJISFunc) {
          Utils.setToSJISFunction(options.toSJISFunc);
        }
      }
      return createSymbol(data, version, errorCorrectionLevel, mask);
    };
  }
});
var import_qrcode = __toESM(require_qrcode(), 1);
var create = import_qrcode.default.create;

// src/ui/environment.js
function describeEnvironment(entorno) {
  const nav = entorno?.navigator;
  const loc = entorno?.location;
  const host = loc?.host ?? (loc?.hostname ? `${loc.hostname}${loc.port ? `:${loc.port}` : ""}` : "?");
  const partes = [
    `origen ${loc?.protocol ?? "http:"}//${host}`,
    `seguro:${entorno?.isSecureContext ? "si" : "NO"}`,
    `camara:${nav?.mediaDevices?.getUserMedia ? "si" : "NO"}`,
    `red:${nav?.onLine === false ? "no" : "si"}`,
    `sw:${nav?.serviceWorker?.controller ? "activo" : "no"}`
  ];
  const modo = entorno?.matchMedia?.("(display-mode: standalone)")?.matches;
  if (modo) partes.push("modo:app");
  return partes.join(" \xB7 ");
}

// src/ui/raster.js
var BLANCO = 4294967295;
var NEGRO = 4278190080;
var MARGEN = 4;
function rasterizeMatrix(matrix, margen = MARGEN) {
  if (!matrix || !Number.isInteger(matrix.size) || matrix.size < 1) {
    throw new TypeError("matriz inv\xE1lida: se espera {size, data}");
  }
  if (matrix.data?.length !== matrix.size * matrix.size) {
    throw new TypeError(
      `matriz inconsistente: ${matrix.data?.length} m\xF3dulos para un lado de ${matrix.size}`
    );
  }
  if (!Number.isInteger(margen) || margen < 0) {
    throw new RangeError(`margen inv\xE1lido: ${margen}`);
  }
  const size = matrix.size + 2 * margen;
  const pixels = new Uint32Array(size * size);
  pixels.fill(BLANCO);
  for (let y = 0; y < matrix.size; y++) {
    const destino = (y + margen) * size + margen;
    const origen = y * matrix.size;
    for (let x = 0; x < matrix.size; x++) {
      if (matrix.data[origen + x]) pixels[destino + x] = NEGRO;
    }
  }
  return { size, pixels };
}
function escalaEntera(ladoRaster, anchoLienzo, altoLienzo) {
  return Math.max(1, Math.floor(Math.min(anchoLienzo, altoLienzo) / ladoRaster));
}
function tamanoDisplay(anchoViewport, altoViewport, anchoContenedor) {
  const presupuestoViewport = 0.9 * Math.min(anchoViewport, altoViewport);
  return Math.max(1, Math.min(presupuestoViewport, Math.max(1, anchoContenedor)));
}

// src/cnc/approval.js
var VEREDICTOS = ["approve", "review", "block"];
function sourceHash(datos) {
  const bytes = typeof datos === "string" ? BufferShim.from(datos, "utf8") : datos;
  return createHash("sha256").update(bytes).digest("hex");
}
function formaValida(informe) {
  return !!informe && typeof informe === "object" && !Array.isArray(informe) && typeof informe.veredicto === "string" && VEREDICTOS.includes(informe.veredicto) && typeof informe.contexto === "object" && informe.contexto !== null && typeof informe.contexto.sourceSha256 === "string" && /^[0-9a-f]{64}$/.test(informe.contexto.sourceSha256);
}
function validateApproval(informe, bytes) {
  if (!ArrayBuffer.isView(bytes) || bytes.length === 0) {
    return { ok: false, reason: "no hay archivo seleccionado", resumen: null };
  }
  if (!formaValida(informe)) {
    return {
      ok: false,
      reason: "Ese JSON no fue creado por Telepat\xEDa: le falta el resultado o la huella del archivo.",
      resumen: null
    };
  }
  const job = informe.job ?? {};
  const resumen = {
    veredicto: informe.veredicto,
    workOrder: job.workOrder ?? null,
    partNumber: job.partNumber ?? null,
    revision: job.revision ?? null,
    programa: informe.contexto?.programa ?? null,
    esperado: informe.contexto.sourceSha256,
    real: sourceHash(bytes),
    motivos: Array.isArray(informe.motivos) ? informe.motivos : []
  };
  if (informe.veredicto !== "approve") {
    const detalle = resumen.motivos[0] ? `: ${resumen.motivos[0]}` : "";
    return {
      ok: false,
      reason: informe.veredicto === "block" ? `Telepat\xEDa bloque\xF3 este trabajo${detalle}` : `Telepat\xEDa pidi\xF3 que una persona lo revise${detalle}`,
      resumen
    };
  }
  if (resumen.esperado !== resumen.real) {
    return {
      ok: false,
      reason: "Este no es el archivo que fue aprobado. Aunque el nombre se parezca, su contenido cambi\xF3.",
      resumen
    };
  }
  return { ok: true, reason: "El programa coincide exactamente con el que Telepat\xEDa revis\xF3.", resumen };
}
var hashCorto = (h) => typeof h === "string" && h.length >= 16 ? `${h.slice(0, 8)}\u2026${h.slice(-8)}` : "\u2014";

// src/ui/sender.js
var FPS_MAX = 120;
var FPS_DEFAULT = 10;
var MAX_BYTES = 4 * 1024 * 1024;
var AVISO_BYTES = 256 * 1024;
function esProgramaDeMaquina(nombre) {
  return /\.(?:nc|gcode|tap|cnc)$/i.test(String(nombre ?? "").trim());
}
var DEMOS = Object.freeze({
  aprobado: Object.freeze({
    programa: "../../fixtures/programs/part-1837-revC.nc",
    informe: "../../fixtures/programs/part-1837-revC.preflight.json",
    nombre: "part-1837-revC.nc",
    etiqueta: "Caso aprobado cargado: revisi\xF3n C y su informe de control."
  }),
  bloqueado: Object.freeze({
    programa: "../../fixtures/programs/part-1837-revB.nc",
    informe: "../../fixtures/programs/part-1837-revB.preflight.json",
    nombre: "part-1837-revB.nc",
    etiqueta: "Caso bloqueado cargado: revisi\xF3n B y su informe de control."
  })
});
function planEmission(fileBytes, opts = {}) {
  const {
    chunkSize,
    fps = FPS_DEFAULT,
    ecc = "L",
    name,
    mime,
    compress
  } = opts ?? {};
  if (!Number.isInteger(fps) || fps < 1 || fps > FPS_MAX) {
    throw new RangeError(`fps inv\xE1lido: ${fps} (esperado entero 1..${FPS_MAX})`);
  }
  const largo = fileBytes?.length ?? 0;
  if (largo > MAX_BYTES) {
    throw new RangeError(
      `el archivo pesa ${formatBytes(largo)} y el m\xE1ximo es ${formatBytes(MAX_BYTES)}. El canal \xF3ptico mueve del orden de kB/s: algo as\xED no tarda, no termina.`
    );
  }
  const encoded = encodeDocument(fileBytes, {
    ...chunkSize === void 0 ? {} : { chunkSize },
    ...name === void 0 ? {} : { name },
    ...mime === void 0 ? {} : { mime },
    ...compress === void 0 ? {} : { compress }
  });
  const { manifest, frames, docId } = encoded;
  const matrixCache = /* @__PURE__ */ new Map();
  const masGrande = frames.data.reduce((a, b) => b.length > a.length ? b : a, frames.data[0]);
  let version;
  try {
    version = encodeMatrix(matrixCache, masGrande, ecc).version;
  } catch (err) {
    throw new RangeError(
      `un frame de ${masGrande.length} bytes no entra en ning\xFAn QR a ECC ${ecc}: baj\xE1 chunkSize (${manifest.chunkSize}) o us\xE1 un ECC m\xE1s permisivo. Causa original: ${err.message}`
    );
  }
  const vueltaTotal = cycleFrames(manifest);
  return {
    docId,
    docIdHex: docIdHex(docId),
    totalFrames: manifest.total,
    cycleFrames: vueltaTotal,
    secondsPerCycle: vueltaTotal / fps,
    version,
    fps,
    ecc,
    manifest,
    frames,
    emitted: 0,
    lap: 0,
    matrixCache,
    emitter: carousel(encoded),
    pending: new Set(Array.from({ length: manifest.total }, (_, i) => i))
  };
}
function encodeMatrix(cache, bytes, ecc) {
  const guardado = cache.get(bytes);
  if (guardado) return guardado;
  const qr = create([{ data: bytes, mode: "byte" }], { errorCorrectionLevel: ecc });
  const matriz = {
    size: qr.modules.size,
    data: Uint8Array.from(qr.modules.data),
    version: qr.version
  };
  cache.set(bytes, matriz);
  return matriz;
}
function nextFrame(plan) {
  if (!plan || typeof plan.emitter?.next !== "function") {
    throw new TypeError("nextFrame espera el plan devuelto por planEmission");
  }
  const bytes = plan.emitter.next().value;
  const parsed = parseFrame(bytes);
  const matrix = encodeMatrix(plan.matrixCache, bytes, plan.ecc);
  plan.emitted++;
  if (parsed.kind === KIND.DATA) {
    plan.pending.delete(parsed.index);
    if (plan.pending.size === 0) {
      plan.lap++;
      for (let i = 0; i < plan.totalFrames; i++) plan.pending.add(i);
    }
  }
  return {
    bytes,
    matrix,
    kind: parsed.kind,
    index: parsed.index,
    lap: plan.lap,
    emitted: plan.emitted
  };
}
var KIND_LABEL = {
  [KIND.MANIFEST]: "MANIFEST",
  [KIND.DATA]: "DATA",
  [KIND.PARITY]: "PARITY"
};
function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}
function mount(doc = globalThis.document) {
  const $ = (id) => doc.getElementById(id);
  const fileInput = $("archivo");
  const chunkInput = $("chunk");
  const fpsInput = $("fps");
  const canvas = $("lienzo");
  const ctx = canvas.getContext("2d", { alpha: false });
  const botonEmitir = $("emitir");
  const estado = $("estado");
  const informeInput = $("informe");
  const recibo = $("recibo");
  const seleccionDemo = $("seleccion-demo");
  const botonDemoAprobado = $("demo-aprobado");
  const botonDemoBloqueado = $("demo-bloqueado");
  const lecturas = {
    doc: $("r-doc"),
    total: $("r-total"),
    vuelta: $("r-vuelta"),
    version: $("r-version"),
    ciclo: $("r-ciclo"),
    frame: $("r-frame"),
    lap: $("r-lap"),
    emitidos: $("r-emitidos")
  };
  let plan = null;
  let archivo = null;
  let matrizUltima = null;
  let nombreArchivo = "";
  let tipoArchivo = "";
  let corriendo = false;
  let ultimoPintado = 0;
  let wakeLock = null;
  let informePre = null;
  const setEstado = (texto, tono = "idle") => {
    estado.textContent = texto;
    estado.dataset.tono = tono;
  };
  const auxiliar = doc.createElement("canvas");
  const auxCtx = auxiliar.getContext("2d", { alpha: false });
  const rasterCache = /* @__PURE__ */ new WeakMap();
  function rasterDe(matrix) {
    const guardado = rasterCache.get(matrix);
    if (guardado) return guardado;
    const raster = rasterizeMatrix(matrix, MARGEN);
    rasterCache.set(matrix, raster);
    return raster;
  }
  function pintar(matrix) {
    const raster = rasterDe(matrix);
    if (auxiliar.width !== raster.size) {
      auxiliar.width = raster.size;
      auxiliar.height = raster.size;
    }
    const imagen = auxCtx.createImageData(raster.size, raster.size);
    new Uint32Array(imagen.data.buffer).set(raster.pixels);
    auxCtx.putImageData(imagen, 0, 0);
    const escala = escalaEntera(raster.size, canvas.width, canvas.height);
    const pintado = raster.size * escala;
    const ox = Math.floor((canvas.width - pintado) / 2);
    const oy = Math.floor((canvas.height - pintado) / 2);
    ctx.fillStyle = "#ffffff";
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(auxiliar, 0, 0, raster.size, raster.size, ox, oy, pintado, pintado);
  }
  function ajustarLienzo() {
    const lado = Math.round(tamanoDisplay(
      globalThis.innerWidth ?? 720,
      globalThis.innerHeight ?? 720,
      canvas.parentElement?.clientWidth ?? 720
    ));
    if (canvas.width === lado) return;
    canvas.width = lado;
    canvas.height = lado;
    if (matrizUltima) pintar(matrizUltima);
    else {
      ctx.fillStyle = "#ffffff";
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }
  function tick(ahora) {
    if (!corriendo || !plan) return;
    const intervalo = 1e3 / plan.fps;
    if (ahora - ultimoPintado >= intervalo) {
      ultimoPintado = ahora;
      const frame = nextFrame(plan);
      matrizUltima = frame.matrix;
      pintar(frame.matrix);
      lecturas.frame.textContent = `${KIND_LABEL[frame.kind]} ${frame.index}`;
      lecturas.lap.textContent = String(frame.lap);
      lecturas.emitidos.textContent = String(frame.emitted);
    }
    globalThis.requestAnimationFrame(tick);
  }
  async function pedirWakeLock() {
    try {
      wakeLock = await globalThis.navigator?.wakeLock?.request("screen") ?? null;
    } catch {
      wakeLock = null;
    }
  }
  fileInput.addEventListener("change", async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    if (!esProgramaDeMaquina(file.name)) {
      archivo = null;
      informePre = null;
      botonEmitir.disabled = true;
      recibo.hidden = true;
      fileInput.value = "";
      if (seleccionDemo) seleccionDemo.textContent = "Ese archivo no es un programa de m\xE1quina.";
      setEstado(
        "Una foto o un JSON no se pueden ejecutar. Eleg\xED un archivo .nc, .gcode, .tap o .cnc.",
        "error"
      );
      return;
    }
    if (file.size > MAX_BYTES) {
      archivo = null;
      botonEmitir.disabled = true;
      setEstado(
        `${file.name} pesa ${formatBytes(file.size)}; el m\xE1ximo es ${formatBytes(MAX_BYTES)}`,
        "error"
      );
      return;
    }
    archivo = new Uint8Array(await file.arrayBuffer());
    nombreArchivo = file.name;
    tipoArchivo = file.type || "application/octet-stream";
    if (seleccionDemo) seleccionDemo.textContent = `Programa propio: ${nombreArchivo}. Falta su informe de control.`;
    botonDemoAprobado?.setAttribute("aria-pressed", "false");
    botonDemoBloqueado?.setAttribute("aria-pressed", "false");
    invalidarPermiso();
    if (archivo.length > AVISO_BYTES) {
      const vuelta = Math.ceil(archivo.length / Number(chunkInput.value)) / Number(fpsInput.value);
      setEstado(
        `${nombreArchivo} \xB7 ${formatBytes(archivo.length)} \xB7 ~${Math.round(vuelta)} s por vuelta`,
        "listo"
      );
    } else {
      setEstado(`${nombreArchivo} \xB7 ${formatBytes(archivo.length)} listo`, "listo");
    }
  });
  botonEmitir.addEventListener("click", async () => {
    if (corriendo) {
      corriendo = false;
      botonEmitir.textContent = "Emitir por luz";
      wakeLock?.release?.();
      setEstado("emisi\xF3n detenida", "idle");
      return;
    }
    let payload = archivo;
    if (modoTexto()) {
      const texto = textoInput.value;
      if (texto.trim() === "") {
        setEstado("escrib\xED algo para emitir", "error");
        return;
      }
      payload = new TextEncoder().encode(texto);
      nombreArchivo = "texto.txt";
      tipoArchivo = "text/plain";
    }
    if (!payload) return;
    try {
      plan = planEmission(payload, {
        chunkSize: Number(chunkInput.value),
        fps: Number(fpsInput.value),
        name: nombreArchivo,
        mime: tipoArchivo
      });
    } catch (err) {
      setEstado(err.message, "error");
      return;
    }
    lecturas.doc.textContent = plan.docIdHex;
    lecturas.total.textContent = String(plan.totalFrames);
    lecturas.version.textContent = `V${plan.version}`;
    lecturas.ciclo.textContent = `${plan.cycleFrames} fr \xB7 ${plan.secondsPerCycle.toFixed(1)} s`;
    lecturas.vuelta.textContent = plan.manifest.compression === 1 ? "deflate" : "sin comprimir";
    corriendo = true;
    ultimoPintado = 0;
    botonEmitir.textContent = "Detener";
    setEstado("emitiendo \xB7 apunt\xE1 la c\xE1mara al c\xF3digo", "emitiendo");
    pedirWakeLock();
    globalThis.requestAnimationFrame(tick);
  });
  const pestanas = [...doc.querySelectorAll("[data-modo]")];
  const panelArchivo = $("panel-archivo");
  const panelTexto = $("panel-texto");
  const textoInput = $("texto");
  const modoTexto = () => pestanas.find((p) => p.getAttribute("aria-selected") === "true")?.dataset.modo === "texto";
  function cambiarModo(modo) {
    for (const p of pestanas) {
      p.setAttribute("aria-selected", String(p.dataset.modo === modo));
    }
    panelArchivo.hidden = modo !== "archivo";
    panelTexto.hidden = modo !== "texto";
    if (modo === "texto") {
      botonEmitir.disabled = textoInput.value.trim() === "";
      setEstado("escrib\xED o peg\xE1 el texto a emitir");
    } else {
      recibo.hidden = archivo === null;
      revisarPermiso();
      if (archivo === null) setEstado("eleg\xED el programa y su informe de pre-flight");
    }
  }
  for (const p of pestanas) {
    p.addEventListener("click", () => cambiarModo(p.dataset.modo));
  }
  textoInput?.addEventListener("input", () => {
    if (!modoTexto()) return;
    const bytes = new TextEncoder().encode(textoInput.value).length;
    botonEmitir.disabled = bytes === 0;
    setEstado(
      bytes === 0 ? "escrib\xED o peg\xE1 el texto a emitir" : `${formatBytes(bytes)} listo`,
      bytes === 0 ? "idle" : "listo"
    );
  });
  ajustarLienzo();
  globalThis.addEventListener?.("resize", ajustarLienzo);
  function revisarPermiso() {
    if (modoTexto()) return;
    if (archivo === null || informePre === null) {
      botonEmitir.disabled = true;
      recibo.hidden = true;
      if (archivo !== null && informePre === null) {
        setEstado("Falta el informe de control creado para este programa.", "idle");
      }
      return;
    }
    const { ok, reason, resumen } = validateApproval(informePre, archivo);
    botonEmitir.disabled = !ok;
    recibo.hidden = false;
    recibo.dataset.tono = ok ? "ok" : "error";
    recibo.innerHTML = "";
    const titulo = doc.createElement("h3");
    titulo.textContent = ok ? "APROBADO \xB7 ES EL ARCHIVO CORRECTO" : { approve: "NO COINCIDE", review: "NECESITA REVISI\xD3N", block: "BLOQUEADO" }[resumen?.veredicto] ?? "ESE JSON NO ES UN INFORME";
    const detalle = doc.createElement("p");
    detalle.textContent = reason;
    recibo.append(titulo, detalle);
    if (resumen) {
      const meta = doc.createElement("dl");
      meta.className = "recibo-meta";
      const filas = [
        ["Trabajo", resumen.workOrder ?? "\u2014"],
        ["Pieza / rev", `${resumen.partNumber ?? "\u2014"} \xB7 ${resumen.revision ?? "\u2014"}`],
        ["Archivo", nombreArchivo],
        ["Bytes esperados", hashCorto(resumen.esperado)],
        ["Bytes reales", hashCorto(resumen.real)]
      ];
      for (const [k, v] of filas) {
        const dt = doc.createElement("dt");
        dt.textContent = k;
        const dd = doc.createElement("dd");
        dd.textContent = v;
        meta.append(dt, dd);
      }
      recibo.append(meta);
      if (!ok && resumen.motivos.length > 0) {
        const ul = doc.createElement("ul");
        ul.className = "recibo-motivos";
        for (const m of resumen.motivos.slice(0, 6)) {
          const li = doc.createElement("li");
          li.textContent = m;
          ul.append(li);
        }
        recibo.append(ul);
      }
    }
    setEstado(
      ok ? `${nombreArchivo} aprobado \xB7 listo para emitir` : reason,
      ok ? "listo" : "error"
    );
  }
  function invalidarPermiso() {
    if (corriendo) {
      corriendo = false;
      botonEmitir.textContent = "Emitir por luz";
      wakeLock?.release?.();
    }
    revisarPermiso();
  }
  informeInput?.addEventListener("change", async () => {
    const file = informeInput.files?.[0];
    if (!file) {
      informePre = null;
      invalidarPermiso();
      return;
    }
    try {
      informePre = JSON.parse(await file.text());
    } catch {
      informePre = null;
      setEstado("el informe no es JSON v\xE1lido", "error");
    }
    invalidarPermiso();
  });
  async function cargarDemo(tipo) {
    const demo = DEMOS[tipo];
    if (!demo) return;
    setEstado("Cargando el caso de prueba\u2026");
    botonEmitir.disabled = true;
    try {
      const [respuestaPrograma, respuestaInforme] = await Promise.all([
        fetch(new URL(demo.programa, globalThis.location.href)),
        fetch(new URL(demo.informe, globalThis.location.href))
      ]);
      if (!respuestaPrograma.ok || !respuestaInforme.ok) {
        throw new Error("no se pudieron abrir los archivos de ejemplo");
      }
      const textoPrograma = await respuestaPrograma.text();
      archivo = new TextEncoder().encode(textoPrograma.replace(/\r\n/g, "\n"));
      informePre = await respuestaInforme.json();
      nombreArchivo = demo.nombre;
      tipoArchivo = "text/plain";
      fileInput.value = "";
      informeInput.value = "";
      cambiarModo("archivo");
      if (seleccionDemo) seleccionDemo.textContent = demo.etiqueta;
      botonDemoAprobado?.setAttribute("aria-pressed", String(tipo === "aprobado"));
      botonDemoBloqueado?.setAttribute("aria-pressed", String(tipo === "bloqueado"));
      invalidarPermiso();
    } catch (err) {
      archivo = null;
      informePre = null;
      recibo.hidden = true;
      setEstado(`No pude cargar el ejemplo: ${err.message}`, "error");
    }
  }
  botonDemoAprobado?.addEventListener("click", () => cargarDemo("aprobado"));
  botonDemoBloqueado?.addEventListener("click", () => cargarDemo("bloqueado"));
  const diag = $("diagnostico");
  if (diag) diag.textContent = describeEnvironment(globalThis);
  setEstado("Eleg\xED un caso para empezar.");
}
export {
  AVISO_BYTES,
  DEMOS,
  KIND_LABEL,
  MAX_BYTES,
  esProgramaDeMaquina,
  formatBytes,
  mount,
  nextFrame,
  planEmission
};
