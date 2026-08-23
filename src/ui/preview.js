// Qué mostrar cuando el documento termina de llegar.
//
// Un archivo reconstruido que se anuncia como "listo" y no se puede ver es una
// promesa a medias: el usuario no tiene forma de saber si llegó lo que mandó.
// Este módulo decide qué es el payload y arma la descripción de la vista.
//
// El `mime` del manifest lo declara el emisor y puede venir vacío o mentido
// (los browsers no le ponen tipo a un `.bin`, y un `.json` renombrado a `.txt`
// llega como `text/plain`). Por eso el sniffing de bytes manda sobre el mime
// declarado, no al revés.
//
// Todo acá es puro: se testea en Node, sin DOM.

/** Firmas de archivo, en offset 0 salvo que se indique otra cosa. */
const FIRMAS = [
  { kind: 'image', mime: 'image/png', magic: [0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a] },
  { kind: 'image', mime: 'image/jpeg', magic: [0xff, 0xd8, 0xff] },
  { kind: 'image', mime: 'image/gif', magic: [0x47, 0x49, 0x46, 0x38] },
  { kind: 'image', mime: 'image/bmp', magic: [0x42, 0x4d] },
  { kind: 'zip', mime: 'application/zip', magic: [0x50, 0x4b, 0x03, 0x04] },
  { kind: 'zip', mime: 'application/zip', magic: [0x50, 0x4b, 0x05, 0x06] },
  { kind: 'pdf', mime: 'application/pdf', magic: [0x25, 0x50, 0x44, 0x46] },
  { kind: 'archive', mime: 'application/gzip', magic: [0x1f, 0x8b] },
  { kind: 'audio', mime: 'audio/mpeg', magic: [0x49, 0x44, 0x33] },
];

/** Los que necesitan mirar más allá del offset 0. */
const FIRMAS_CON_OFFSET = [
  { kind: 'image', mime: 'image/webp', offset: 8, magic: [0x57, 0x45, 0x42, 0x50] },
  { kind: 'video', mime: 'video/mp4', offset: 4, magic: [0x66, 0x74, 0x79, 0x70] },
];

/** Máximo de texto que se vuelca a pantalla antes de recortar. */
export const LIMITE_TEXTO = 8000;

/** Bytes que muestra el volcado hexadecimal de un binario desconocido. */
export const BYTES_HEX = 256;

const empiezaCon = (bytes, magic, offset = 0) =>
  bytes.length >= offset + magic.length
  && magic.every((b, i) => bytes[offset + i] === b);

/**
 * Qué es este payload, mirando los bytes antes que el mime declarado.
 *
 * @param {Uint8Array} bytes
 * @param {string} [mime] El que declaró el emisor.
 * @returns {{kind: string, mime: string, sniffed: boolean}}
 */
export function sniffKind(bytes, mime = '') {
  for (const firma of FIRMAS) {
    if (empiezaCon(bytes, firma.magic)) {
      return { kind: firma.kind, mime: firma.mime, sniffed: true };
    }
  }
  for (const firma of FIRMAS_CON_OFFSET) {
    if (empiezaCon(bytes, firma.magic, firma.offset)) {
      return { kind: firma.kind, mime: firma.mime, sniffed: true };
    }
  }

  // Sin firma: el texto se decide decodificando, no por el mime — un `.csv`
  // guardado como octet-stream sigue siendo texto y hay que poder leerlo.
  if (asText(bytes) !== null) {
    const declarado = String(mime).toLowerCase();
    const mimeTexto = declarado.startsWith('text/')
      || declarado.includes('json')
      || declarado.includes('xml')
      || declarado.includes('csv');
    return { kind: 'text', mime: mimeTexto ? mime : 'text/plain', sniffed: !mimeTexto };
  }

  const declarado = String(mime || 'application/octet-stream');
  const familia = declarado.split('/')[0];
  const kind = ['image', 'audio', 'video'].includes(familia) ? familia : 'binary';
  return { kind, mime: declarado, sniffed: false };
}

/**
 * Decodifica como UTF-8, o `null` si no es texto legible.
 *
 * No alcanza con que decodifique: hay binarios que son UTF-8 válido por
 * casualidad. Se pide además que la proporción de caracteres de control sea
 * baja, que es lo que separa un `.csv` de un `.wav`.
 *
 * @param {Uint8Array} bytes
 * @returns {string|null}
 */
export function asText(bytes) {
  if (bytes.length === 0) return '';
  let texto;
  try {
    texto = new TextDecoder('utf-8', { fatal: true }).decode(bytes);
  } catch {
    return null;
  }

  const muestra = texto.slice(0, 4096);
  let control = 0;
  for (const char of muestra) {
    const code = char.codePointAt(0);
    // Tab, LF y CR son texto; el resto del rango de control, no.
    if (code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d) control++;
    if (code === 0x7f) control++;
  }
  return control / Math.max(1, muestra.length) > 0.02 ? null : texto;
}

/**
 * Lee el directorio central de un ZIP y lista lo que hay adentro.
 *
 * Solo el directorio central: no descomprime nada. Alcanza para mostrar la
 * estructura de la carpeta, que es lo que quiere ver alguien que acaba de
 * recibir un ZIP por la cámara.
 *
 * @param {Uint8Array} bytes
 * @returns {{name: string, size: number, compressedSize: number, directory: boolean}[]}
 */
export function listZipEntries(bytes) {
  const vista = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);

  // El EOCD está al final, pero puede haber hasta 64 kB de comentario detrás:
  // se busca la firma hacia atrás en vez de asumir que son los últimos 22 bytes.
  const EOCD = 0x06054b50;
  let eocd = -1;
  const minimo = Math.max(0, bytes.length - (0xffff + 22));
  for (let i = bytes.length - 22; i >= minimo; i--) {
    if (vista.getUint32(i, true) === EOCD) {
      eocd = i;
      break;
    }
  }
  if (eocd === -1) throw new Error('no es un ZIP: falta el end of central directory');

  const cantidad = vista.getUint16(eocd + 10, true);
  let cursor = vista.getUint32(eocd + 16, true);

  const entradas = [];
  for (let i = 0; i < cantidad; i++) {
    if (cursor + 46 > bytes.length) break;
    if (vista.getUint32(cursor, true) !== 0x02014b50) break;

    const comprimido = vista.getUint32(cursor + 20, true);
    const tamano = vista.getUint32(cursor + 24, true);
    const largoNombre = vista.getUint16(cursor + 28, true);
    const largoExtra = vista.getUint16(cursor + 30, true);
    const largoComentario = vista.getUint16(cursor + 32, true);

    const nombre = new TextDecoder('utf-8')
      .decode(bytes.subarray(cursor + 46, cursor + 46 + largoNombre));

    entradas.push({
      name: nombre,
      size: tamano,
      compressedSize: comprimido,
      directory: nombre.endsWith('/'),
    });

    cursor += 46 + largoNombre + largoExtra + largoComentario;
  }
  return entradas;
}

/**
 * Volcado hexadecimal con la columna ASCII al costado, estilo `hexdump -C`.
 *
 * @param {Uint8Array} bytes @param {number} [limite]
 */
export function hexDump(bytes, limite = BYTES_HEX) {
  const trozo = bytes.subarray(0, limite);
  const lineas = [];

  for (let i = 0; i < trozo.length; i += 16) {
    const fila = trozo.subarray(i, i + 16);
    const hex = [...fila].map((b) => b.toString(16).padStart(2, '0')).join(' ');
    const ascii = [...fila]
      .map((b) => (b >= 0x20 && b < 0x7f ? String.fromCharCode(b) : '.'))
      .join('');
    lineas.push(`${i.toString(16).padStart(8, '0')}  ${hex.padEnd(47)}  |${ascii}|`);
  }
  return lineas.join('\n');
}

/** Bytes a una unidad legible. */
export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

/**
 * Descripción completa de lo que se recibió, lista para pintar.
 *
 * @param {Uint8Array} bytes
 * @param {{name?: string, mime?: string}} [manifest]
 * @returns {object}
 */
export function describePayload(bytes, manifest = {}) {
  if (!ArrayBuffer.isView(bytes)) {
    throw new TypeError('describePayload espera los bytes del documento');
  }

  const name = String(manifest.name ?? 'document.bin');
  const { kind, mime, sniffed } = sniffKind(bytes, manifest.mime ?? '');

  const base = {
    kind,
    mime,
    sniffed,
    name,
    size: bytes.length,
    sizeLabel: formatBytes(bytes.length),
  };

  if (kind === 'text') {
    const texto = asText(bytes) ?? '';
    return {
      ...base,
      text: texto.slice(0, LIMITE_TEXTO),
      truncated: texto.length > LIMITE_TEXTO,
      lines: texto === '' ? 0 : texto.split('\n').length,
      label: 'Texto',
    };
  }

  if (kind === 'zip') {
    try {
      const entries = listZipEntries(bytes);
      const archivos = entries.filter((e) => !e.directory);
      return {
        ...base,
        entries,
        fileCount: archivos.length,
        dirCount: entries.length - archivos.length,
        uncompressedSize: archivos.reduce((suma, e) => suma + e.size, 0),
        label: 'Archivo comprimido',
      };
    } catch (err) {
      // El ZIP llegó entero según el SHA-256, pero el directorio no se puede
      // leer: se degrada a binario en vez de romper la pantalla de resultado.
      return { ...base, kind: 'binary', hex: hexDump(bytes), label: 'Binario', zipError: err.message };
    }
  }

  if (kind === 'image' || kind === 'video' || kind === 'audio' || kind === 'pdf') {
    const etiquetas = {
      image: 'Imagen', video: 'Video', audio: 'Audio', pdf: 'Documento PDF',
    };
    return { ...base, label: etiquetas[kind] };
  }

  return { ...base, hex: hexDump(bytes), label: 'Binario' };
}
