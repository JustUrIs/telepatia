// Adaptador de renderizado QR.
//
// Único archivo del proyecto que importa `qrcode`. El protocolo es nuestro; el
// dibujo del cuadrado no. Si mañana cambiamos de librería, se cambia acá y nada
// más se entera.
//
// Nota sobre API privada: `qrcode` no expone públicamente ni el render de una
// matriz ya construida ni la tabla de capacidades, así que los tres módulos de
// abajo son deep-imports. Su `package.json` no declara `exports`, con lo cual el
// acceso está permitido, pero no tiene garantía de semver. Que no salga de acá.

import QRCode from 'qrcode';
import Version from 'qrcode/lib/core/version.js';
import Mode from 'qrcode/lib/core/mode.js';
import ECLevel from 'qrcode/lib/core/error-correction-level.js';
import pngRenderer from 'qrcode/lib/renderer/png.js';

import { HEADER_LEN } from './protocol.js';

/** Quiet zone estándar, en módulos por lado. */
export const DEFAULT_MARGIN = 4;

/** Escala por defecto: píxeles por módulo. */
export const DEFAULT_SCALE = 4;

/** Versiones de QR existentes. */
const MAX_VERSION = 40;

/** Capacidad byte de V21 a ECC L. Es la que necesita un frame de 916 bytes. */
export const QR_CAPACITY_L21 = Version.getCapacity(21, ECLevel.L, Mode.BYTE);

const EC_LEVELS = { L: ECLevel.L, M: ECLevel.M, Q: ECLevel.Q, H: ECLevel.H };

/** @param {string} ecc */
function ecLevel(ecc) {
  const level = EC_LEVELS[String(ecc).toUpperCase()];
  if (level === undefined) {
    throw new RangeError(`ECC desconocido: ${ecc} (esperado L, M, Q o H)`);
  }
  return level;
}

/**
 * Versión mínima de QR que aguanta un frame de `chunkSize` bytes de payload.
 *
 * Existe para que el `chunkSize` de T-02 y la capacidad real del código no se
 * desincronicen: el frame que viaja son `chunkSize + HEADER_LEN` bytes, no
 * `chunkSize`, y ese detalle es el que hace que un QR falle recién en la cámara.
 *
 * @param {number} chunkSize Bytes de payload por frame.
 * @param {string} [ecc] Nivel de corrección de errores.
 * @returns {number} Versión de QR, 1..40.
 */
export function pickVersion(chunkSize, ecc = 'L') {
  if (!Number.isInteger(chunkSize) || chunkSize < 1) {
    throw new RangeError(`chunkSize inválido: ${chunkSize}`);
  }
  const level = ecLevel(ecc);
  const necesario = chunkSize + HEADER_LEN;

  for (let version = 1; version <= MAX_VERSION; version++) {
    if (Version.getCapacity(version, level, Mode.BYTE) >= necesario) return version;
  }
  throw new RangeError(
    `un frame de ${necesario} bytes no entra en ningún QR a ECC ${ecc}: `
    + `la capacidad máxima es ${Version.getCapacity(MAX_VERSION, level, Mode.BYTE)}`,
  );
}

/**
 * @typedef {{size: number, data: Uint8Array}} QrMatrix
 *   `size` es el lado en módulos; `data` tiene `size * size` valores 0/1.
 */

/**
 * Convierte los bytes de un frame en la matriz de módulos de su QR.
 *
 * Va en **modo byte**: los frames son binarios, no texto. Nada de base64, que
 * infla 33% y nos costaría una versión entera de QR.
 *
 * @param {Uint8Array} frameBytes
 * @param {{ecc?: string, version?: number}} [options]
 * @returns {QrMatrix}
 */
export function frameToMatrix(frameBytes, options = {}) {
  const { ecc = 'L', version } = options ?? {};
  if (!ArrayBuffer.isView(frameBytes)) {
    throw new TypeError('frameBytes debe ser Uint8Array o Buffer');
  }
  ecLevel(ecc);

  const data = Buffer.isBuffer(frameBytes) ? frameBytes : Buffer.from(frameBytes);
  const qr = QRCode.create([{ data, mode: 'byte' }], {
    errorCorrectionLevel: ecc,
    ...(version === undefined ? {} : { version }),
  });

  return { size: qr.modules.size, data: qr.modules.data };
}

/**
 * Rasteriza una matriz de módulos a un PNG.
 *
 * **Desvío consciente de la spec:** devuelve una `Promise<Buffer>`, no un
 * `Buffer`. El renderer de `qrcode` es callback-asíncrono (usa pngjs por
 * stream) y no existe una variante síncrona en su API. Envolverlo en una
 * promesa es la traducción más chica; la alternativa era escribir un encoder
 * PNG propio.
 *
 * @param {QrMatrix} matrix
 * @param {number} [scale] Píxeles por módulo.
 * @param {{margin?: number}} [options]
 * @returns {Promise<Buffer>}
 */
export function matrixToPng(matrix, scale = DEFAULT_SCALE, options = {}) {
  return new Promise((resolve, reject) => {
    const { margin = DEFAULT_MARGIN } = options ?? {};

    if (!matrix || !Number.isInteger(matrix.size) || !ArrayBuffer.isView(matrix.data)) {
      return reject(new TypeError('matriz inválida: se espera {size, data}'));
    }
    if (matrix.data.length !== matrix.size * matrix.size) {
      return reject(new TypeError(
        `matriz inconsistente: ${matrix.data.length} módulos para un lado de ${matrix.size}`,
      ));
    }
    if (!Number.isInteger(scale) || scale < 1) {
      return reject(new RangeError(`escala inválida: ${scale}`));
    }
    if (!Number.isInteger(margin) || margin < 0) {
      return reject(new RangeError(`margen inválido: ${margin}`));
    }

    // El renderer solo mira `modules`, así que le alcanza con la matriz.
    pngRenderer.renderToBuffer(
      { modules: { size: matrix.size, data: matrix.data } },
      { scale, margin },
      (err, buffer) => (err ? reject(err) : resolve(buffer)),
    );
  });
}
