// Adaptador de escaneo QR. ÚNICO archivo que importa `jsqr`.
// Prohibido que este archivo conozca el layout del header: solo mueve bytes.

import jsQR from 'jsqr';

/**
 * Un frame RGBA → bytes crudos del QR, o null si no hay código legible.
 * Nunca lanza: una captura borrosa es lo normal, no una excepción.
 * @returns {Uint8Array|null}
 */
export function scanRgba(rgba, width, height) {
  // getImageData() devuelve Uint8ClampedArray: excluirlo hacía que el tipo
  // NATIVO del canvas fuera el único que no entraba, y en silencio ("no hay
  // código legible"). Se acepta cualquier vista de bytes.
  const isBytes = rgba instanceof Uint8Array || rgba instanceof Uint8ClampedArray || Array.isArray(rgba);
  if (!isBytes) return null;
  if (!Number.isInteger(width) || !Number.isInteger(height) || width < 1 || height < 1) return null;
  if (rgba.length < width * height * 4) return null;
  let result;
  try {
    result = jsQR(rgba, width, height, { inversionAttempts: 'dontInvert' });
  } catch {
    return null; // jsQR lanza en algunas entradas degeneradas
  }
  if (!result) return null;
  // `binaryData` son los bytes del modo byte, que es lo que emitimos.
  const bytes = result.binaryData;
  if (!Array.isArray(bytes) || bytes.length === 0) return null;
  return Uint8Array.from(bytes);
}

/**
 * Bucle de captura: pide frames a un proveedor y los empuja a un decoder.
 * El proveedor devuelve {rgba,width,height} o null (sin señal).
 */
export class ScanLoop {
  /**
   * @param {() => ({rgba:Uint8Array,width:number,height:number}|null)} provider
   * @param {{push:(b:Uint8Array)=>boolean, complete:boolean}} decoder
   */
  constructor(provider, decoder) {
    if (typeof provider !== 'function') throw new TypeError('provider debe ser función');
    if (!decoder || typeof decoder.push !== 'function') throw new TypeError('decoder inválido');
    this.provider = provider;
    this.decoder = decoder;
    this.stats = { frames: 0, hits: 0, misses: 0, novel: 0, providerErrors: 0 };
    this.stopped = false;
  }

  /** Un tick. Devuelve true si el decoder quedó completo. */
  tick() {
    if (this.stopped) return this.decoder.complete;
    let frame;
    try { frame = this.provider(); } catch { this.stats.providerErrors++; return this.decoder.complete; }
    if (!frame) { this.stats.misses++; return this.decoder.complete; }
    this.stats.frames++;
    const bytes = scanRgba(frame.rgba, frame.width, frame.height);
    if (!bytes) { this.stats.misses++; return this.decoder.complete; }
    this.stats.hits++;
    if (this.decoder.push(bytes)) this.stats.novel++;
    return this.decoder.complete;
  }

  /** Corre hasta completar o agotar `maxTicks`. Tolera pérdida total de señal. */
  run(maxTicks = 10_000) {
    for (let i = 0; i < maxTicks && !this.stopped; i++) {
      if (this.tick()) return true;
    }
    return this.decoder.complete;
  }

  stop() { this.stopped = true; }
}
