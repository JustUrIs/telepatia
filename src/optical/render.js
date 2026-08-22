// Adaptador de renderizado QR. ÚNICO archivo que importa `qrcode`.
// El protocolo es nuestro; el dibujo del cuadrado no.

import QRCode from 'qrcode';

export const QUIET_ZONE = 4;
const ECC_LEVELS = new Set(['L', 'M', 'Q', 'H']);

// Capacidad en modo byte por versión de QR, por nivel de ECC. Tabla del
// estándar ISO/IEC 18004; solo las versiones que nos interesan (un frame de
// 900+16 B necesita V23 o más a ECC L).
const BYTE_CAPACITY = {
  L: { 10: 271, 15: 523, 20: 858, 23: 1043, 25: 1273, 27: 1465, 30: 1732, 35: 2306, 40: 2953 },
  M: { 10: 213, 15: 412, 20: 669, 23: 809, 25: 1000, 27: 1150, 30: 1370, 35: 1812, 40: 2331 },
  Q: { 10: 151, 15: 292, 20: 480, 23: 580, 25: 715, 27: 818, 30: 985, 35: 1286, 40: 1663 },
  H: { 10: 119, 15: 220, 20: 365, 23: 442, 25: 542, 27: 625, 30: 745, 35: 976, 40: 1273 },
};

/** La versión de QR más chica que aguanta `frameBytes`, o null si ninguna. */
export function pickVersion(payloadBytes, ecc = 'L', headerLen = 16) {
  if (!ECC_LEVELS.has(ecc)) throw new RangeError(`ECC inválido: ${ecc}`);
  const need = payloadBytes + headerLen;
  if (!Number.isInteger(need) || need <= 0) throw new RangeError(`tamaño inválido: ${payloadBytes}`);
  const table = BYTE_CAPACITY[ecc];
  const versions = Object.keys(table).map(Number).sort((a, b) => a - b);
  for (const v of versions) if (table[v] >= need) return v;
  return null;
}

/** Capacidad byte de una versión/ECC, o null si no está tabulada. */
export const capacityOf = (version, ecc = 'L') => BYTE_CAPACITY[ecc]?.[version] ?? null;

/**
 * Bytes de un frame → matriz de módulos. Modo byte: los frames son binarios,
 * nada de base64 (que infla 33% y baja la densidad efectiva).
 * @returns {{size:number, data:Uint8Array, version:number}}
 */
export function frameToMatrix(frameBytes, { ecc = 'L', version } = {}) {
  if (!(frameBytes instanceof Uint8Array)) throw new TypeError('frameBytes debe ser Uint8Array/Buffer');
  if (frameBytes.length === 0) throw new RangeError('frame vacío');
  if (!ECC_LEVELS.has(ecc)) throw new RangeError(`ECC inválido: ${ecc}`);
  let qr;
  try {
    qr = QRCode.create([{ data: frameBytes, mode: 'byte' }], {
      errorCorrectionLevel: ecc,
      ...(version === undefined ? {} : { version }),
    });
  } catch (err) {
    throw new Error(`no se pudo generar el QR (${frameBytes.length} B, ECC ${ecc}${version ? `, V${version}` : ''}): ${err.message}`);
  }
  return { size: qr.modules.size, data: qr.modules.data, version: qr.version };
}

/** Matriz → RGBA con quiet zone y escala entera. Sin canvas: bytes crudos. */
export function matrixToRgba(matrix, scale = 1, quiet = QUIET_ZONE) {
  if (!Number.isInteger(scale) || scale < 1) throw new RangeError(`scale debe ser entero ≥1, recibí ${scale}`);
  const { size, data } = matrix;
  const side = (size + 2 * quiet) * scale;
  const rgba = new Uint8Array(side * side * 4).fill(0xff); // blanco opaco
  for (let y = 0; y < size; y++) {
    for (let x = 0; x < size; x++) {
      if (!data[y * size + x]) continue; // 0 = claro
      for (let dy = 0; dy < scale; dy++) {
        const py = (y + quiet) * scale + dy;
        for (let dx = 0; dx < scale; dx++) {
          const px = (x + quiet) * scale + dx;
          const o = (py * side + px) * 4;
          rgba[o] = 0; rgba[o + 1] = 0; rgba[o + 2] = 0;
        }
      }
    }
  }
  return { rgba, width: side, height: side };
}
