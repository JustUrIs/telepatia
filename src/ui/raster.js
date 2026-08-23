// Rasterizado de una matriz de módulos a píxeles.
//
// La técnica importa más de lo que parece: se pinta **un módulo = un píxel** y
// después se escala con el suavizado apagado. Dibujar cada módulo con un
// `fillRect` ya escalado son size² llamadas al contexto por cuadro — a 40 fps y
// 177 módulos por lado son 1,25 millones de llamadas por segundo — y además
// cualquier escala fraccionaria reparte los bordes entre píxeles vecinos, que
// es la causa número uno de que la cámara no enganche.
//
// Puro y sin DOM: los píxeles son bytes RGBA vistos como un u32 little-endian
// por píxel, que es exactamente el buffer de un `ImageData`. El emisor lo
// envuelve con `new ImageData(new Uint8ClampedArray(pixels.buffer), lado, lado)`
// sin copiar nada.

/** Opaco, en little-endian: el alfa va en el byte alto. */
const BLANCO = 0xffffffff;
const NEGRO = 0xff000000;

/** Quiet zone estándar, en módulos por lado. */
export const MARGEN = 4;

/**
 * @typedef {{size: number, pixels: Uint32Array}} Raster
 *   `size` es el lado en píxeles: módulos + 2 × margen. Un módulo, un píxel.
 */

/**
 * Pinta una matriz de módulos, con su quiet zone.
 *
 * @param {{size: number, data: ArrayLike<number>}} matrix Fila por fila, distinto de cero = oscuro.
 * @param {number} [margen]
 * @returns {Raster}
 */
export function rasterizeMatrix(matrix, margen = MARGEN) {
  if (!matrix || !Number.isInteger(matrix.size) || matrix.size < 1) {
    throw new TypeError('matriz inválida: se espera {size, data}');
  }
  if (matrix.data?.length !== matrix.size * matrix.size) {
    throw new TypeError(
      `matriz inconsistente: ${matrix.data?.length} módulos para un lado de ${matrix.size}`,
    );
  }
  if (!Number.isInteger(margen) || margen < 0) {
    throw new RangeError(`margen inválido: ${margen}`);
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

/**
 * Escala entera máxima que entra en un lienzo.
 *
 * Entera y no fraccionaria: medio píxel de módulo es un borde gris, y un borde
 * gris es un módulo que la cámara puede leer de las dos formas.
 *
 * @param {number} ladoRaster @param {number} anchoLienzo @param {number} altoLienzo
 * @returns {number} al menos 1
 */
export function escalaEntera(ladoRaster, anchoLienzo, altoLienzo) {
  return Math.max(1, Math.floor(Math.min(anchoLienzo, altoLienzo) / ladoRaster));
}

/**
 * Cuánto conviene que mida el lienzo del emisor.
 *
 * Se acota al 90% del lado corto del viewport: un QR que se sale de la pantalla
 * no se puede encuadrar, y uno que ocupa el 100% no deja ver dónde termina.
 *
 * @param {number} anchoViewport @param {number} altoViewport @param {number} anchoContenedor
 * @returns {number}
 */
export function tamanoDisplay(anchoViewport, altoViewport, anchoContenedor) {
  const presupuestoViewport = 0.9 * Math.min(anchoViewport, altoViewport);
  return Math.max(1, Math.min(presupuestoViewport, Math.max(1, anchoContenedor)));
}
