// UI del emisor: convierte un archivo en un carrusel de QR y lo pinta.
//
// Todo lo testeable vive arriba y no toca el DOM: `planEmission` y `nextFrame`
// corren igual en Node que en el browser. El acceso al DOM está encerrado en
// `mount()`, que los tests no llaman nunca.

import { docIdHex } from '../shared/contract.js';
import { encodeDocument, carousel, cycleFrames, parseFrame, KIND } from '../optical/protocol.js';
import { create } from './vendor/qrcode-core.js';
import { describeEnvironment } from './environment.js';

/** Más de esto no lo sigue ni una cámara de celular, y quema batería al pedo. */
const FPS_MAX = 120;
const FPS_DEFAULT = 10;

/**
 * Techo duro de tamaño.
 *
 * El canal óptico mueve del orden de kB/s: un archivo de 200 MB no es "lento",
 * es imposible — y antes de fallar por el límite de 65535 frames, el deflate y
 * la construcción de los frames congelan la pestaña varios minutos. Vale más
 * rechazarlo en el acto y decir por qué.
 */
export const MAX_BYTES = 4 * 1024 * 1024;

/** A partir de acá se avisa que va a tardar, pero se deja hacer. */
export const AVISO_BYTES = 256 * 1024;

/**
 * @typedef {object} EmissionPlan
 * @property {number} docId
 * @property {string} docIdHex
 * @property {number} totalFrames  Frames de datos del documento.
 * @property {number} cycleFrames  Frames de una vuelta completa.
 * @property {number} secondsPerCycle
 * @property {number} version      Versión de QR que va a usar el emisor.
 * @property {number} fps
 * @property {import('../optical/protocol.js').Manifest} manifest
 * @property {number} emitted      Frames emitidos hasta ahora.
 * @property {number} lap          Vueltas completas al documento.
 */

/**
 * Prepara la emisión de un archivo.
 *
 * @param {Uint8Array} fileBytes
 * @param {{chunkSize?: number, fps?: number, ecc?: string, name?: string, mime?: string, compress?: boolean}} [opts]
 * @returns {EmissionPlan}
 */
export function planEmission(fileBytes, opts = {}) {
  const {
    chunkSize, fps = FPS_DEFAULT, ecc = 'L', name, mime, compress,
  } = opts ?? {};

  if (!Number.isInteger(fps) || fps < 1 || fps > FPS_MAX) {
    throw new RangeError(`fps inválido: ${fps} (esperado entero 1..${FPS_MAX})`);
  }

  // Antes de tocar los bytes: comprimir y framear 200 MB cuelga la pestaña
  // minutos enteros, y el error real (65535 frames) llegaría demasiado tarde.
  const largo = fileBytes?.length ?? 0;
  if (largo > MAX_BYTES) {
    throw new RangeError(
      `el archivo pesa ${formatBytes(largo)} y el máximo es ${formatBytes(MAX_BYTES)}. `
      + 'El canal óptico mueve del orden de kB/s: algo así no tarda, no termina.',
    );
  }

  const encoded = encodeDocument(fileBytes, {
    ...(chunkSize === undefined ? {} : { chunkSize }),
    ...(name === undefined ? {} : { name }),
    ...(mime === undefined ? {} : { mime }),
    ...(compress === undefined ? {} : { compress }),
  });

  const { manifest, frames, docId } = encoded;
  const matrixCache = new Map();

  // Encodear el frame más grande ahora sirve para dos cosas: saber qué versión
  // de QR va a usar la emisión, y que un chunkSize imposible falle acá y no a
  // mitad de la animación.
  const masGrande = frames.data.reduce((a, b) => (b.length > a.length ? b : a), frames.data[0]);
  let version;
  try {
    version = encodeMatrix(matrixCache, masGrande, ecc).version;
  } catch (err) {
    // El mensaje de la librería viene en inglés y no dice qué hacer.
    throw new RangeError(
      `un frame de ${masGrande.length} bytes no entra en ningún QR a ECC ${ecc}: `
      + `bajá chunkSize (${manifest.chunkSize}) o usá un ECC más permisivo. `
      + `Causa original: ${err.message}`,
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
    pending: new Set(Array.from({ length: manifest.total }, (_, i) => i)),
  };
}

/**
 * Encodea un frame a matriz de módulos, con caché.
 *
 * El carrusel devuelve las mismas instancias de Buffer vuelta tras vuelta, así
 * que la caché por identidad alcanza y evita reencodear 40 QR por segundo.
 */
function encodeMatrix(cache, bytes, ecc) {
  const guardado = cache.get(bytes);
  if (guardado) return guardado;

  const qr = create([{ data: bytes, mode: 'byte' }], { errorCorrectionLevel: ecc });
  const matriz = {
    size: qr.modules.size,
    data: Uint8Array.from(qr.modules.data),
    version: qr.version,
  };
  cache.set(bytes, matriz);
  return matriz;
}

/**
 * Avanza la emisión un frame.
 *
 * @param {EmissionPlan} plan
 * @returns {{bytes: Uint8Array, matrix: {size: number, data: Uint8Array}, kind: number, index: number, lap: number, emitted: number}}
 */
export function nextFrame(plan) {
  if (!plan || typeof plan.emitter?.next !== 'function') {
    throw new TypeError('nextFrame espera el plan devuelto por planEmission');
  }

  const bytes = plan.emitter.next().value;
  const parsed = parseFrame(bytes);
  const matrix = encodeMatrix(plan.matrixCache, bytes, plan.ecc);

  plan.emitted++;

  // Una vuelta se cuenta cuando el documento entero pasó por pantalla, no cada
  // `cycleFrames` frames: la reinyección del manifest desalinea ese conteo.
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
    emitted: plan.emitted,
  };
}

/** Nombres legibles de cada tipo de frame, para el panel de estado. */
export const KIND_LABEL = {
  [KIND.MANIFEST]: 'MANIFEST',
  [KIND.DATA]: 'DATA',
  [KIND.PARITY]: 'PARITY',
};

/** Bytes a una unidad legible, sin decimales de más. */
export function formatBytes(n) {
  if (n < 1024) return `${n} B`;
  if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} kB`;
  return `${(n / (1024 * 1024)).toFixed(2)} MB`;
}

// ---------------------------------------------------------------------------
// A partir de acá empieza el DOM. Los tests no entran.
// ---------------------------------------------------------------------------

/**
 * Engancha la página del emisor.
 *
 * @param {Document} doc
 */
export function mount(doc = globalThis.document) {
  const $ = (id) => doc.getElementById(id);

  const fileInput = $('archivo');
  const chunkInput = $('chunk');
  const fpsInput = $('fps');
  const canvas = $('lienzo');
  const ctx = canvas.getContext('2d', { alpha: false });
  const botonEmitir = $('emitir');
  const estado = $('estado');

  const lecturas = {
    doc: $('r-doc'), total: $('r-total'), vuelta: $('r-vuelta'), version: $('r-version'),
    ciclo: $('r-ciclo'), frame: $('r-frame'), lap: $('r-lap'), emitidos: $('r-emitidos'),
  };

  /** @type {EmissionPlan|null} */ let plan = null;
  /** @type {Uint8Array|null} */ let archivo = null;
  let nombreArchivo = '';
  let tipoArchivo = '';
  let corriendo = false;
  let ultimoPintado = 0;
  let wakeLock = null;

  const setEstado = (texto, tono = 'idle') => {
    estado.textContent = texto;
    estado.dataset.tono = tono;
  };

  function pintar(matrix) {
    const lado = matrix.size;
    const margen = 4;
    const total = lado + margen * 2;
    // Escala entera: un módulo partido en píxeles fraccionarios es la causa
    // número uno de que la cámara no enganche.
    const escala = Math.max(1, Math.floor(Math.min(canvas.width, canvas.height) / total));
    const pintado = total * escala;
    const offset = Math.floor((canvas.width - pintado) / 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.fillStyle = '#000000';
    for (let y = 0; y < lado; y++) {
      for (let x = 0; x < lado; x++) {
        if (!matrix.data[y * lado + x]) continue;
        ctx.fillRect(
          offset + (x + margen) * escala,
          offset + (y + margen) * escala,
          escala, escala,
        );
      }
    }
  }

  function tick(ahora) {
    if (!corriendo || !plan) return;
    const intervalo = 1000 / plan.fps;

    if (ahora - ultimoPintado >= intervalo) {
      ultimoPintado = ahora;
      const frame = nextFrame(plan);
      pintar(frame.matrix);
      lecturas.frame.textContent = `${KIND_LABEL[frame.kind]} ${frame.index}`;
      lecturas.lap.textContent = String(frame.lap);
      lecturas.emitidos.textContent = String(frame.emitted);
    }
    globalThis.requestAnimationFrame(tick);
  }

  async function pedirWakeLock() {
    // No existe en todos los browsers, y no es motivo para no emitir.
    try {
      wakeLock = await globalThis.navigator?.wakeLock?.request('screen') ?? null;
    } catch {
      wakeLock = null;
    }
  }

  fileInput.addEventListener('change', async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    // Se mira el tamaño ANTES de leer el archivo a memoria: no tiene sentido
    // cargar 200 MB en un ArrayBuffer para después rechazarlo.
    if (file.size > MAX_BYTES) {
      archivo = null;
      botonEmitir.disabled = true;
      setEstado(
        `${file.name} pesa ${formatBytes(file.size)}; el máximo es ${formatBytes(MAX_BYTES)}`,
        'error',
      );
      return;
    }

    archivo = new Uint8Array(await file.arrayBuffer());
    nombreArchivo = file.name;
    tipoArchivo = file.type || 'application/octet-stream';
    botonEmitir.disabled = false;

    if (archivo.length > AVISO_BYTES) {
      const vuelta = Math.ceil(archivo.length / Number(chunkInput.value)) / Number(fpsInput.value);
      setEstado(
        `${nombreArchivo} · ${formatBytes(archivo.length)} · ~${Math.round(vuelta)} s por vuelta`,
        'listo',
      );
    } else {
      setEstado(`${nombreArchivo} · ${formatBytes(archivo.length)} listo`, 'listo');
    }
  });

  botonEmitir.addEventListener('click', async () => {
    if (corriendo) {
      corriendo = false;
      botonEmitir.textContent = 'Emitir';
      wakeLock?.release?.();
      setEstado('emisión detenida', 'idle');
      return;
    }
    if (!archivo) return;

    try {
      plan = planEmission(archivo, {
        chunkSize: Number(chunkInput.value),
        fps: Number(fpsInput.value),
        name: nombreArchivo,
        mime: tipoArchivo,
      });
    } catch (err) {
      setEstado(err.message, 'error');
      return;
    }

    lecturas.doc.textContent = plan.docIdHex;
    lecturas.total.textContent = String(plan.totalFrames);
    lecturas.version.textContent = `V${plan.version}`;
    lecturas.ciclo.textContent = `${plan.cycleFrames} fr · ${plan.secondsPerCycle.toFixed(1)} s`;
    lecturas.vuelta.textContent = plan.manifest.compression === 1 ? 'deflate' : 'sin comprimir';

    corriendo = true;
    ultimoPintado = 0;
    botonEmitir.textContent = 'Detener';
    setEstado('emitiendo · apuntá la cámara al código', 'emitiendo');
    pedirWakeLock();
    globalThis.requestAnimationFrame(tick);
  });

  // La apertura arranca en blanco, no en negro: un rectángulo negro parece un
  // canvas roto, y además es el fondo contra el que se va a pintar el QR.
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const diag = $('diagnostico');
  if (diag) diag.textContent = describeEnvironment(globalThis);

  setEstado('elegí un archivo para empezar');
}
