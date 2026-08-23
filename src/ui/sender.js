// UI del emisor: convierte un archivo en un carrusel de QR y lo pinta.
//
// Todo lo testeable vive arriba y no toca el DOM: `planEmission` y `nextFrame`
// corren igual en Node que en el browser. El acceso al DOM está encerrado en
// `mount()`, que los tests no llaman nunca.

import { docIdHex } from '../shared/contract.js';
import { encodeDocument, carousel, cycleFrames, parseFrame, KIND } from '../optical/protocol.js';
import { create } from './vendor/qrcode-core.js';
import { describeEnvironment } from './environment.js';
import { rasterizeMatrix, escalaEntera, tamanoDisplay, MARGEN } from './raster.js';
import { validateApproval, hashCorto } from '../cnc/approval.js';

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

/** Extensiones habituales de instrucciones para máquinas CNC. */
export function esProgramaDeMaquina(nombre) {
  return /\.(?:nc|gcode|tap|cnc)$/i.test(String(nombre ?? '').trim());
}

/** Parejas reales que permiten probar el flujo sin buscar archivos a mano. */
export const DEMOS = Object.freeze({
  aprobado: Object.freeze({
    programa: '../../fixtures/programs/part-1837-revC.nc',
    informe: '../../fixtures/programs/part-1837-revC.preflight.json',
    nombre: 'part-1837-revC.nc',
    etiqueta: 'Caso aprobado cargado: revisión C y su informe de control.',
  }),
  bloqueado: Object.freeze({
    programa: '../../fixtures/programs/part-1837-revB.nc',
    informe: '../../fixtures/programs/part-1837-revB.preflight.json',
    nombre: 'part-1837-revB.nc',
    etiqueta: 'Caso bloqueado cargado: revisión B y su informe de control.',
  }),
});

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
  const informeInput = $('informe');
  const recibo = $('recibo');
  const seleccionDemo = $('seleccion-demo');
  const botonDemoAprobado = $('demo-aprobado');
  const botonDemoBloqueado = $('demo-bloqueado');

  const lecturas = {
    doc: $('r-doc'), total: $('r-total'), vuelta: $('r-vuelta'), version: $('r-version'),
    ciclo: $('r-ciclo'), frame: $('r-frame'), lap: $('r-lap'), emitidos: $('r-emitidos'),
  };

  /** @type {EmissionPlan|null} */ let plan = null;
  /** @type {Uint8Array|null} */ let archivo = null;
  /** @type {object|null} Última matriz pintada, para repintar tras un resize. */
  let matrizUltima = null;
  let nombreArchivo = '';
  let tipoArchivo = '';
  let corriendo = false;
  let ultimoPintado = 0;
  let wakeLock = null;
  /** @type {object|null} */ let informePre = null;

  const setEstado = (texto, tono = 'idle') => {
    estado.textContent = texto;
    estado.dataset.tono = tono;
  };

  // El lienzo auxiliar guarda el QR a resolución de módulo: un módulo, un
  // píxel. Escalarlo después con drawImage y el suavizado apagado es una sola
  // llamada al contexto por cuadro, contra size² fillRect — a 177 módulos por
  // lado y 10 fps eso eran 313.000 llamadas por segundo.
  const auxiliar = doc.createElement('canvas');
  const auxCtx = auxiliar.getContext('2d', { alpha: false });

  /** El raster de una matriz no cambia nunca: se calcula una sola vez. */
  const rasterCache = new WeakMap();

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

    // Escala entera: medio píxel de módulo es un borde gris, y un borde gris
    // es un módulo que la cámara puede leer de las dos formas.
    const escala = escalaEntera(raster.size, canvas.width, canvas.height);
    const pintado = raster.size * escala;
    const ox = Math.floor((canvas.width - pintado) / 2);
    const oy = Math.floor((canvas.height - pintado) / 2);

    ctx.fillStyle = '#ffffff';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    ctx.imageSmoothingEnabled = false;
    ctx.drawImage(auxiliar, 0, 0, raster.size, raster.size, ox, oy, pintado, pintado);
  }

  /** El lienzo sigue al viewport: un QR que no entra en pantalla no se encuadra. */
  function ajustarLienzo() {
    const lado = Math.round(tamanoDisplay(
      globalThis.innerWidth ?? 720,
      globalThis.innerHeight ?? 720,
      canvas.parentElement?.clientWidth ?? 720,
    ));
    if (canvas.width === lado) return;
    canvas.width = lado;
    canvas.height = lado;

    // Redimensionar un canvas lo borra: hay que repintar el cuadro actual, o
    // la emisión parpadea en blanco cada vez que gira el teléfono.
    if (matrizUltima) pintar(matrizUltima);
    else {
      ctx.fillStyle = '#ffffff';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
    }
  }

  function tick(ahora) {
    if (!corriendo || !plan) return;
    const intervalo = 1000 / plan.fps;

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
    if (!esProgramaDeMaquina(file.name)) {
      archivo = null;
      informePre = null;
      botonEmitir.disabled = true;
      recibo.hidden = true;
      fileInput.value = '';
      if (seleccionDemo) seleccionDemo.textContent = 'Ese archivo no es un programa de máquina.';
      setEstado(
        'Una foto o un JSON no se pueden ejecutar. Elegí un archivo .nc, .gcode, .tap o .cnc.',
        'error',
      );
      return;
    }
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
    if (seleccionDemo) seleccionDemo.textContent = `Programa propio: ${nombreArchivo}. Falta su informe de control.`;
    botonDemoAprobado?.setAttribute('aria-pressed', 'false');
    botonDemoBloqueado?.setAttribute('aria-pressed', 'false');
    // El archivo por si solo ya no habilita nada: el permiso sale del informe.
    invalidarPermiso();

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
      botonEmitir.textContent = 'Emitir por luz';
      wakeLock?.release?.();
      setEstado('emisión detenida', 'idle');
      return;
    }
    // En modo texto no hay archivo: el payload se arma al vuelo desde el
    // textarea, así se puede emitir algo sin tener que guardarlo primero.
    let payload = archivo;
    if (modoTexto()) {
      const texto = textoInput.value;
      if (texto.trim() === '') {
        setEstado('escribí algo para emitir', 'error');
        return;
      }
      payload = new TextEncoder().encode(texto);
      nombreArchivo = 'texto.txt';
      tipoArchivo = 'text/plain';
    }
    if (!payload) return;

    try {
      plan = planEmission(payload, {
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

  // --- modo archivo / modo texto -------------------------------------------

  const pestanas = [...doc.querySelectorAll('[data-modo]')];
  const panelArchivo = $('panel-archivo');
  const panelTexto = $('panel-texto');
  const textoInput = $('texto');

  const modoTexto = () => pestanas.find((p) => p.getAttribute('aria-selected') === 'true')
    ?.dataset.modo === 'texto';

  function cambiarModo(modo) {
    for (const p of pestanas) {
      p.setAttribute('aria-selected', String(p.dataset.modo === modo));
    }
    panelArchivo.hidden = modo !== 'archivo';
    panelTexto.hidden = modo !== 'texto';

    if (modo === 'texto') {
      botonEmitir.disabled = textoInput.value.trim() === '';
      setEstado('escribí o pegá el texto a emitir');
    } else {
      // En modo archivo el permiso NO sale de tener un archivo: sale del informe.
      recibo.hidden = archivo === null;
      revisarPermiso();
      if (archivo === null) setEstado('elegí el programa y su informe de pre-flight');
    }
  }

  for (const p of pestanas) {
    p.addEventListener('click', () => cambiarModo(p.dataset.modo));
  }

  textoInput?.addEventListener('input', () => {
    if (!modoTexto()) return;
    const bytes = new TextEncoder().encode(textoInput.value).length;
    botonEmitir.disabled = bytes === 0;
    setEstado(bytes === 0 ? 'escribí o pegá el texto a emitir' : `${formatBytes(bytes)} listo`,
      bytes === 0 ? 'idle' : 'listo');
  });

  // La apertura arranca en blanco, no en negro: un rectángulo negro parece un
  // canvas roto, y además es el fondo contra el que se va a pintar el QR.
  ajustarLienzo();
  globalThis.addEventListener?.('resize', ajustarLienzo);

  // --- El permiso de emisión ------------------------------------------------
  //
  // Un informe aprobado no sirve de nada si el emisor deja mandar otro archivo.
  // Acá se verifica que los bytes elegidos sean EXACTAMENTE los evaluados.
  //
  // No es una firma y no se llama así: el informe es un JSON sin firmar. Cierra
  // el error humano y el cambio accidental, que es el caso frecuente en un
  // taller, y nada más que eso.

  /** Recalcula el permiso y deja la UI diciendo la verdad sobre por qué. */
  function revisarPermiso() {
    if (modoTexto()) return;

    if (archivo === null || informePre === null) {
      botonEmitir.disabled = true;
      recibo.hidden = true;
      if (archivo !== null && informePre === null) {
        setEstado('Falta el informe de control creado para este programa.', 'idle');
      }
      return;
    }

    const { ok, reason, resumen } = validateApproval(informePre, archivo);
    botonEmitir.disabled = !ok;

    recibo.hidden = false;
    recibo.dataset.tono = ok ? 'ok' : 'error';
    recibo.innerHTML = '';

    const titulo = doc.createElement('h3');
    titulo.textContent = ok
      ? 'APROBADO · ES EL ARCHIVO CORRECTO'
      : { approve: 'NO COINCIDE', review: 'NECESITA REVISIÓN', block: 'BLOQUEADO' }[resumen?.veredicto] ?? 'ESE JSON NO ES UN INFORME';

    const detalle = doc.createElement('p');
    detalle.textContent = reason;

    recibo.append(titulo, detalle);

    if (resumen) {
      const meta = doc.createElement('dl');
      meta.className = 'recibo-meta';
      const filas = [
        ['Trabajo', resumen.workOrder ?? '—'],
        ['Pieza / rev', `${resumen.partNumber ?? '—'} · ${resumen.revision ?? '—'}`],
        ['Archivo', nombreArchivo],
        ['Bytes esperados', hashCorto(resumen.esperado)],
        ['Bytes reales', hashCorto(resumen.real)],
      ];
      for (const [k, v] of filas) {
        const dt = doc.createElement('dt');
        dt.textContent = k;
        const dd = doc.createElement('dd');
        dd.textContent = v;
        meta.append(dt, dd);
      }
      recibo.append(meta);

      if (!ok && resumen.motivos.length > 0) {
        const ul = doc.createElement('ul');
        ul.className = 'recibo-motivos';
        for (const m of resumen.motivos.slice(0, 6)) {
          const li = doc.createElement('li');
          li.textContent = m;
          ul.append(li);
        }
        recibo.append(ul);
      }
    }

    setEstado(
      ok ? `${nombreArchivo} aprobado · listo para emitir` : reason,
      ok ? 'listo' : 'error',
    );
  }

  /** Cualquier cambio invalida el permiso anterior y corta la emisión. */
  function invalidarPermiso() {
    if (corriendo) {
      corriendo = false;
      botonEmitir.textContent = 'Emitir por luz';
      wakeLock?.release?.();
    }
    revisarPermiso();
  }

  informeInput?.addEventListener('change', async () => {
    const file = informeInput.files?.[0];
    if (!file) { informePre = null; invalidarPermiso(); return; }
    try {
      informePre = JSON.parse(await file.text());
    } catch {
      informePre = null;
      setEstado('el informe no es JSON válido', 'error');
    }
    invalidarPermiso();
  });

  /** Carga programa + informe como una sola unidad: no hay campos para adivinar. */
  async function cargarDemo(tipo) {
    const demo = DEMOS[tipo];
    if (!demo) return;

    setEstado('Cargando el caso de prueba…');
    botonEmitir.disabled = true;
    try {
      const [respuestaPrograma, respuestaInforme] = await Promise.all([
        fetch(new URL(demo.programa, globalThis.location.href)),
        fetch(new URL(demo.informe, globalThis.location.href)),
      ]);
      if (!respuestaPrograma.ok || !respuestaInforme.ok) {
        throw new Error('no se pudieron abrir los archivos de ejemplo');
      }

      // El repo fija LF para que la huella del ejemplo sea igual en Windows,
      // macOS y Linux. Normalizar solo este fixture evita que un checkout viejo
      // con CRLF rompa la prueba de un clic; los archivos propios siguen siendo
      // validados byte a byte, sin tocarlos.
      const textoPrograma = await respuestaPrograma.text();
      archivo = new TextEncoder().encode(textoPrograma.replace(/\r\n/g, '\n'));
      informePre = await respuestaInforme.json();
      nombreArchivo = demo.nombre;
      tipoArchivo = 'text/plain';
      fileInput.value = '';
      informeInput.value = '';
      cambiarModo('archivo');
      if (seleccionDemo) seleccionDemo.textContent = demo.etiqueta;
      botonDemoAprobado?.setAttribute('aria-pressed', String(tipo === 'aprobado'));
      botonDemoBloqueado?.setAttribute('aria-pressed', String(tipo === 'bloqueado'));
      invalidarPermiso();
    } catch (err) {
      archivo = null;
      informePre = null;
      recibo.hidden = true;
      setEstado(`No pude cargar el ejemplo: ${err.message}`, 'error');
    }
  }

  botonDemoAprobado?.addEventListener('click', () => cargarDemo('aprobado'));
  botonDemoBloqueado?.addEventListener('click', () => cargarDemo('bloqueado'));

  const diag = $('diagnostico');
  if (diag) diag.textContent = describeEnvironment(globalThis);

  setEstado('Elegí un caso para empezar.');
}
