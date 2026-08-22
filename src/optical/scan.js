// Adaptador de escaneo QR.
//
// Único archivo del proyecto que importa `jsqr`. Este módulo **no conoce el
// layout del header**: recibe píxeles, devuelve bytes, y se los pasa al decoder.
// Quién interpreta esos bytes es problema de `protocol.js`.

import jsQRModule from 'jsqr';

// `jsqr` es CJS con `exports.default`: bajo ESM el default import trae el
// namespace, no la función.
const jsQR = jsQRModule.default ?? jsQRModule;

/**
 * Busca un QR en un cuadro RGBA y devuelve sus bytes crudos.
 *
 * Acepta `Uint8ClampedArray` — el tipo nativo de `getImageData` — además de
 * `Uint8Array`. Excluir el clamped hace que el camino real del navegador falle
 * en silencio.
 *
 * @param {Uint8Array|Uint8ClampedArray} data Píxeles RGBA, 4 bytes por píxel.
 * @param {number} width @param {number} height
 * @returns {Uint8Array|null} Bytes del QR, o `null` si no hay ninguno en cuadro.
 */
export function scanRgba(data, width, height) {
  if (!ArrayBuffer.isView(data)) {
    throw new TypeError('rgba debe ser Uint8ClampedArray o Uint8Array');
  }
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) {
    throw new RangeError(`dimensiones inválidas: ${width}x${height}`);
  }
  if (data.length !== width * height * 4) {
    throw new RangeError(
      `dimensiones inconsistentes: ${width}x${height} pide ${width * height * 4} bytes `
      + `y el buffer trae ${data.length}`,
    );
  }

  const pixels = data instanceof Uint8ClampedArray
    ? data
    : new Uint8ClampedArray(data.buffer, data.byteOffset, data.byteLength);

  // `dontInvert`: el emisor siempre pinta oscuro sobre claro, y probar la
  // inversión duplicaría el costo de cada cuadro para nada.
  const result = jsQR(pixels, width, height, { inversionAttempts: 'dontInvert' });
  if (!result) return null;

  return Uint8Array.from(result.binaryData);
}

/**
 * @typedef {() => ({rgba: Uint8Array|Uint8ClampedArray, width: number, height: number} | null)} FrameProvider
 *   Devuelve el cuadro actual, o `null` si todavía no hay señal.
 */

/**
 * Bombea cuadros del proveedor al decoder hasta que el documento esté completo.
 *
 * No sabe qué son los bytes que mueve: cualquier objeto con `push(bytes)` y
 * `complete` sirve como decoder, lo que hace testeable el loop sin el protocolo.
 */
export class ScanLoop {
  /** @type {FrameProvider} */ #provider;
  #decoder;
  #stopped = false;
  #stats = { frames: 0, hits: 0, misses: 0, novel: 0, providerErrors: 0 };

  /**
   * @param {FrameProvider} provider
   * @param {{push: (bytes: Uint8Array) => boolean, complete: boolean}} decoder
   */
  constructor(provider, decoder) {
    if (typeof provider !== 'function') {
      throw new TypeError('provider debe ser una función que devuelva {rgba, width, height} o null');
    }
    if (!decoder || typeof decoder.push !== 'function' || typeof decoder.complete !== 'boolean') {
      throw new TypeError('decoder debe exponer push(bytes) y complete');
    }
    this.#provider = provider;
    this.#decoder = decoder;
  }

  /** Copia de los contadores del canal. */
  get stats() { return { ...this.#stats }; }

  /** `true` si `stop()` cortó el loop. */
  get stopped() { return this.#stopped; }

  /** Pide que `run()` corte en el próximo tick. */
  stop() { this.#stopped = true; }

  /**
   * Procesa un cuadro.
   *
   * @returns {boolean} `true` si el decoder ya tiene el documento completo.
   */
  tick() {
    if (this.#decoder.complete) return true;

    let cuadro;
    try {
      cuadro = this.#provider();
    } catch {
      // Una cámara que se desconecta un instante no puede matar el escaneo.
      this.#stats.providerErrors++;
      return this.#decoder.complete;
    }

    // Sin señal todavía: no es un cuadro fallado, es que no hubo cuadro.
    if (!cuadro) return this.#decoder.complete;

    this.#stats.frames++;
    const bytes = scanRgba(cuadro.rgba, cuadro.width, cuadro.height);
    if (bytes === null) {
      this.#stats.misses++;
      return this.#decoder.complete;
    }

    this.#stats.hits++;
    if (this.#decoder.push(bytes)) this.#stats.novel++;
    return this.#decoder.complete;
  }

  /**
   * Repite `tick()` hasta completar el documento, agotar `maxTicks` o recibir
   * un `stop()`.
   *
   * @param {number} maxTicks
   * @returns {boolean} `true` si el decoder quedó completo.
   */
  run(maxTicks) {
    if (!Number.isInteger(maxTicks) || maxTicks < 1) {
      throw new RangeError(`maxTicks inválido: ${maxTicks}`);
    }
    this.#stopped = false;
    for (let i = 0; i < maxTicks; i++) {
      if (this.tick()) return true;
      if (this.#stopped) return false;
    }
    return this.#decoder.complete;
  }
}
