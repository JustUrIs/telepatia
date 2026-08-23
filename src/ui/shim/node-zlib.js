// Shim de `node:zlib` para el browser: deflate raw en **bloques stored**.
//
// Lo que hace y lo que no, dicho en voz alta:
//
// - `deflateRawSync` emite deflate válido usando solo bloques sin comprimir
//   (BTYPE=00). El resultado es siempre un poco más grande que la entrada, lo
//   cual es exactamente lo que necesitamos: `encodeDocument` solo se queda con
//   el comprimido si achica, así que un emisor en el browser elige
//   `compression = 0` por su propia regla, sin ninguna rama especial.
//   Node puede descomprimirlo con `inflateRawSync` sin enterarse.
//
// - `inflateRawSync` **solo** descomprime bloques stored. Un stream que venga
//   de un emisor Node con deflate real lanza con un mensaje claro en vez de
//   devolver basura. Implementar Huffman + LZ77 acá sería reescribir zlib.
//
// El límite es del receptor en browser, no del protocolo: el mismo stream se
// arma perfecto con el receptor de Node.

import { BufferShim } from './buffer.js';

/** Un bloque stored no puede declarar más de 65535 bytes. */
const MAX_BLOQUE = 0xffff;

/**
 * @param {Uint8Array} data
 * @returns {BufferShim} deflate raw, todo en bloques stored
 */
export function deflateRawSync(data) {
  const entrada = data instanceof Uint8Array ? data : BufferShim.from(data);
  const bloques = Math.max(1, Math.ceil(entrada.length / MAX_BLOQUE));
  const salida = BufferShim.alloc(entrada.length + bloques * 5);

  let leido = 0;
  let escrito = 0;
  for (let i = 0; i < bloques; i++) {
    const largo = Math.min(MAX_BLOQUE, entrada.length - leido);
    const ultimo = i === bloques - 1;

    // Cabecera de bloque stored: BFINAL en el bit 0, BTYPE=00, y el resto del
    // byte en cero para alinear. Después LEN y su complemento, little-endian.
    salida[escrito++] = ultimo ? 1 : 0;
    salida[escrito++] = largo & 0xff;
    salida[escrito++] = (largo >>> 8) & 0xff;
    salida[escrito++] = ~largo & 0xff;
    salida[escrito++] = (~largo >>> 8) & 0xff;

    salida.set(entrada.subarray(leido, leido + largo), escrito);
    escrito += largo;
    leido += largo;
  }
  return salida.subarray(0, escrito);
}

/**
 * @param {Uint8Array} data deflate raw hecho de bloques stored
 * @returns {BufferShim}
 */
export function inflateRawSync(data) {
  const entrada = data instanceof Uint8Array ? data : BufferShim.from(data);
  /** @type {Uint8Array[]} */ const partes = [];

  let cursor = 0;
  for (;;) {
    if (cursor + 5 > entrada.length) throw new Error('deflate truncado');

    const cabecera = entrada[cursor];
    const ultimo = (cabecera & 1) === 1;
    const tipo = (cabecera >>> 1) & 0b11;
    if (tipo !== 0) {
      throw new Error(
        'este shim solo descomprime bloques stored: el stream trae deflate real '
        + '(BTYPE=' + tipo + '). Armalo con el receptor de Node.',
      );
    }

    const largo = entrada[cursor + 1] | (entrada[cursor + 2] << 8);
    const complemento = entrada[cursor + 3] | (entrada[cursor + 4] << 8);
    if ((largo ^ 0xffff) !== complemento) throw new Error('LEN y NLEN no se corresponden');

    cursor += 5;
    if (cursor + largo > entrada.length) throw new Error('deflate truncado');
    partes.push(entrada.subarray(cursor, cursor + largo));
    cursor += largo;

    if (ultimo) break;
  }
  return BufferShim.concat(partes);
}

export default { deflateRawSync, inflateRawSync };
