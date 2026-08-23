// Shim de `node:crypto` para el browser: solo SHA-256, y solo síncrono.
//
// `crypto.subtle.digest` existe en el browser pero es asíncrono, y volver
// asíncrono a `encodeDocument`/`assemble` cambiaría la superficie que ya está
// testeada en Node. SHA-256 en JS puro es corto y determinista, así que sale
// más barato implementarlo que propagar promesas por todo el protocolo.
//
// `test/t00-shim.test.js` lo compara contra `node:crypto` sobre entradas
// aleatorias de largo variable, incluidos los bordes de padding.

import { BufferShim } from './buffer.js';

/** Constantes de ronda: raíces cúbicas de los primeros 64 primos. */
const K = new Uint32Array([
  0x428a2f98, 0x71374491, 0xb5c0fbcf, 0xe9b5dba5, 0x3956c25b, 0x59f111f1, 0x923f82a4, 0xab1c5ed5,
  0xd807aa98, 0x12835b01, 0x243185be, 0x550c7dc3, 0x72be5d74, 0x80deb1fe, 0x9bdc06a7, 0xc19bf174,
  0xe49b69c1, 0xefbe4786, 0x0fc19dc6, 0x240ca1cc, 0x2de92c6f, 0x4a7484aa, 0x5cb0a9dc, 0x76f988da,
  0x983e5152, 0xa831c66d, 0xb00327c8, 0xbf597fc7, 0xc6e00bf3, 0xd5a79147, 0x06ca6351, 0x14292967,
  0x27b70a85, 0x2e1b2138, 0x4d2c6dfc, 0x53380d13, 0x650a7354, 0x766a0abb, 0x81c2c92e, 0x92722c85,
  0xa2bfe8a1, 0xa81a664b, 0xc24b8b70, 0xc76c51a3, 0xd192e819, 0xd6990624, 0xf40e3585, 0x106aa070,
  0x19a4c116, 0x1e376c08, 0x2748774c, 0x34b0bcb5, 0x391c0cb3, 0x4ed8aa4a, 0x5b9cca4f, 0x682e6ff3,
  0x748f82ee, 0x78a5636f, 0x84c87814, 0x8cc70208, 0x90befffa, 0xa4506ceb, 0xbef9a3f7, 0xc67178f2,
]);

const rotr = (x, n) => ((x >>> n) | (x << (32 - n))) >>> 0;

/**
 * SHA-256 de un bloque de bytes.
 *
 * @param {Uint8Array} bytes
 * @returns {Uint8Array} 32 bytes de digest
 */
export function sha256(bytes) {
  const largoBits = bytes.length * 8;

  // Padding: 0x80, ceros, y el largo en bits como u64 big-endian.
  const conPadding = new Uint8Array((((bytes.length + 8) >> 6) + 1) << 6);
  conPadding.set(bytes);
  conPadding[bytes.length] = 0x80;

  const vistaPadding = new DataView(conPadding.buffer);
  // El largo en bits puede pasar los 32 bits: se parte en alto y bajo.
  vistaPadding.setUint32(conPadding.length - 8, Math.floor(largoBits / 0x100000000), false);
  vistaPadding.setUint32(conPadding.length - 4, largoBits >>> 0, false);

  const h = new Uint32Array([
    0x6a09e667, 0xbb67ae85, 0x3c6ef372, 0xa54ff53a,
    0x510e527f, 0x9b05688c, 0x1f83d9ab, 0x5be0cd19,
  ]);
  const w = new Uint32Array(64);
  const vista = new DataView(conPadding.buffer);

  for (let bloque = 0; bloque < conPadding.length; bloque += 64) {
    for (let i = 0; i < 16; i++) w[i] = vista.getUint32(bloque + i * 4, false);
    for (let i = 16; i < 64; i++) {
      const s0 = rotr(w[i - 15], 7) ^ rotr(w[i - 15], 18) ^ (w[i - 15] >>> 3);
      const s1 = rotr(w[i - 2], 17) ^ rotr(w[i - 2], 19) ^ (w[i - 2] >>> 10);
      w[i] = (w[i - 16] + s0 + w[i - 7] + s1) >>> 0;
    }

    let [a, b, c, d, e, f, g, hh] = h;
    for (let i = 0; i < 64; i++) {
      const S1 = rotr(e, 6) ^ rotr(e, 11) ^ rotr(e, 25);
      const ch = (e & f) ^ (~e & g);
      const temp1 = (hh + S1 + ch + K[i] + w[i]) >>> 0;
      const S0 = rotr(a, 2) ^ rotr(a, 13) ^ rotr(a, 22);
      const maj = (a & b) ^ (a & c) ^ (b & c);
      const temp2 = (S0 + maj) >>> 0;

      hh = g; g = f; f = e;
      e = (d + temp1) >>> 0;
      d = c; c = b; b = a;
      a = (temp1 + temp2) >>> 0;
    }

    h[0] = (h[0] + a) >>> 0; h[1] = (h[1] + b) >>> 0;
    h[2] = (h[2] + c) >>> 0; h[3] = (h[3] + d) >>> 0;
    h[4] = (h[4] + e) >>> 0; h[5] = (h[5] + f) >>> 0;
    h[6] = (h[6] + g) >>> 0; h[7] = (h[7] + hh) >>> 0;
  }

  const salida = new Uint8Array(32);
  const salidaVista = new DataView(salida.buffer);
  for (let i = 0; i < 8; i++) salidaVista.setUint32(i * 4, h[i], false);
  return salida;
}

/**
 * `createHash('sha256')` con la superficie que usa el proyecto:
 * `.update(bytes).digest()` y `.digest('hex')`.
 *
 * @param {string} algorithm
 */
export function createHash(algorithm) {
  if (String(algorithm).toLowerCase() !== 'sha256') {
    throw new Error(`este shim solo implementa sha256, no ${algorithm}`);
  }
  /** @type {Uint8Array[]} */ const partes = [];

  return {
    update(bytes) {
      partes.push(typeof bytes === 'string' ? BufferShim.from(bytes) : bytes);
      return this;
    },
    digest(encoding) {
      const digest = sha256(BufferShim.concat(partes));
      return encoding === 'hex' ? BufferShim.from(digest).toString('hex') : BufferShim.from(digest);
    },
  };
}

export default { createHash };
