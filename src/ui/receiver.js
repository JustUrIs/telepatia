// UI del receptor: cámara, progreso y render del dictamen.
//
// Igual que el emisor: `renderVerdict`, `renderFailure` y `downloadName` no
// tocan el DOM y se testean en Node. El acceso al DOM vive en `mount()`.
//
// Este archivo **nunca** importa nada de `src/audit/` (Bloque B). El `Verdict`
// entra como dato, y en desarrollo sale de `fixtures/verdict-{pass,fail,review}.json`.

import { FAILURE_CODES, isVerdict, runPaths } from '../shared/contract.js';
import { FrameDecoder } from '../optical/protocol.js';
import { ScanLoop } from '../optical/scan.js';

/** Nombres legibles de cada check de conciliación. */
const ETIQUETAS_CHECK = {
  items_sum_subtotal: 'Los ítems suman el subtotal',
  subtotal_plus_tax_equals_total: 'Subtotal + impuesto da el total',
  tax_amount_matches_rate: 'El impuesto corresponde a la alícuota',
  tax_rate_plausible: 'La alícuota es plausible',
  currency_consistent: 'La moneda es consistente',
  dates_ordered: 'Emisión no posterior al vencimiento',
  issue_date_not_future: 'La emisión no está en el futuro',
  invoice_not_duplicate: 'La factura no está duplicada',
};

/** Nombres legibles de los campos que pueden quedar sin anclar. */
const ETIQUETAS_CAMPO = {
  invoiceNumber: 'Número de factura',
  issueDate: 'Fecha de emisión',
  dueDate: 'Fecha de vencimiento',
  supplierName: 'Proveedor',
  supplierTaxId: 'CUIT del proveedor',
  currency: 'Moneda',
  subtotal: 'Subtotal',
  taxRate: 'Alícuota',
  taxAmount: 'Impuesto',
  total: 'Total',
};

/** Título, tono y bajada de cada veredicto. */
const ESTADOS = {
  pass: {
    title: 'Conciliada',
    tone: 'ok',
    summary: 'Todos los controles pasaron y la factura tiene su movimiento en el extracto.',
  },
  fail: {
    title: 'Rechazada',
    tone: 'error',
    summary: 'Al menos un control de consistencia no cierra. No pagar sin revisar.',
  },
  review: {
    title: 'Requiere revisión',
    tone: 'warn',
    summary: 'Nada la contradice, pero falta respaldo: revisión humana antes de aprobar.',
  },
};

/** Qué significa cada código de fallo, y qué puede hacer quien lo lee. */
const FALLOS = {
  [FAILURE_CODES.digestMismatch]: {
    title: 'El documento llegó corrupto',
    detail: 'El SHA-256 de lo reconstruido no coincide con el que declara el emisor. '
      + 'Volvé a escanear: no se descarta nada, se rehace la captura.',
  },
  [FAILURE_CODES.ungroundedFields]: {
    title: 'Hay campos sin respaldo en el documento',
    detail: 'El modelo extrajo valores que ningún bloque del documento sostiene. '
      + 'Esos campos van marcados y el dictamen queda en revisión.',
  },
  [FAILURE_CODES.unsupportedVersion]: {
    title: 'El emisor habla una versión más nueva',
    detail: 'El stream usa una versión del protocolo AGP1 que este receptor no entiende. '
      + 'Actualizá el receptor o bajá la versión del emisor.',
  },
  [FAILURE_CODES.emptyDocument]: {
    title: 'El documento está vacío',
    detail: 'No hay bytes que auditar. Revisá el archivo del lado del emisor.',
  },
  [FAILURE_CODES.backendUnavailable]: {
    title: 'El motor de inferencia no está disponible',
    detail: 'No se pudo cargar el modelo local. El transporte funcionó: '
      + 'el documento está reconstruido y se puede auditar después.',
  },
  [FAILURE_CODES.malformedExtraction]: {
    title: 'La extracción no respetó el esquema',
    detail: 'El modelo devolvió algo que no encaja en el esquema de factura. '
      + 'El dictamen no se emite con una extracción malformada.',
  },
  [FAILURE_CODES.malformedRow]: {
    title: 'Hay filas del extracto que no se pudieron leer',
    detail: 'Alguna fila del CSV no normaliza. No se descarta en silencio: '
      + 'queda listada con su motivo.',
  },
  [FAILURE_CODES.cameraUnavailable]: {
    title: 'No hay cámara disponible',
    detail: 'El permiso fue denegado o no hay ningún dispositivo de video. '
      + 'Revisá los permisos del sitio y que ninguna otra app tenga la cámara tomada.',
  },
};

/** Confianza 0..1 a porcentaje legible. */
const porcentaje = (v) => `${Math.round((Number(v) || 0) * 100)}%`;

/**
 * Convierte un `Verdict` del contrato en la estructura que pinta la vista.
 *
 * @param {import('../shared/contract.js').Verdict} verdict
 */
export function renderVerdict(verdict) {
  if (!isVerdict(verdict)) {
    throw new TypeError('renderVerdict espera un Verdict válido del contrato');
  }

  const estado = ESTADOS[verdict.verdict];

  const rows = verdict.checks.map((check) => ({
    id: check.id,
    label: Object.hasOwn(ETIQUETAS_CHECK, check.id) ? ETIQUETAS_CHECK[check.id] : check.id,
    ok: check.ok,
    tone: check.ok ? 'ok' : 'error',
    expected: check.expected,
    actual: check.actual,
    evidence: check.evidence.map((ev) => ({
      value: ev.value,
      bbox: ev.bbox,
      confidence: ev.confidence,
      confidenceLabel: porcentaje(ev.confidence),
    })),
  }));

  const ungrounded = verdict.ungrounded.map((u) => ({
    key: u.key,
    label: Object.hasOwn(ETIQUETAS_CAMPO, u.key) ? ETIQUETAS_CAMPO[u.key] : u.key,
    value: u.value,
    reason: u.reason,
    tone: 'warn',
  }));

  return {
    verdict: verdict.verdict,
    title: estado.title,
    tone: estado.tone,
    summary: estado.summary,
    rows,
    ungrounded,
    failedCount: rows.filter((f) => !f.ok).length,
    ungroundedCount: ungrounded.length,
    passedCount: rows.filter((f) => f.ok).length,
    matched: verdict.matched,
    matchLabel: verdict.matched
      ? `${verdict.matched.date} · ${verdict.matched.description} · ${verdict.matched.amount}`
      : 'Sin movimiento asociado en el extracto',
  };
}

/**
 * Convierte un `Failure` en algo que una persona pueda leer y accionar.
 *
 * @param {import('../shared/contract.js').Failure} failure
 */
export function renderFailure(failure) {
  const stage = typeof failure?.stage === 'string' ? failure.stage : 'desconocida';
  const code = typeof failure?.code === 'string' ? failure.code : '';
  const message = typeof failure?.message === 'string' ? failure.message : '';

  // `Object.hasOwn` y no indexación cruda: con un `code` de `'toString'`, un
  // objeto literal devuelve una función y la UI pintaría "[native code]".
  const conocido = Object.hasOwn(FALLOS, code);
  const base = conocido
    ? FALLOS[code]
    : {
      title: 'Fallo no clasificado',
      detail: `El pipeline se cortó en la etapa "${stage}" con un código que este receptor `
        + 'no conoce. Se muestra el mensaje original abajo.',
    };

  return {
    stage,
    code,
    known: conocido,
    tone: 'error',
    title: base.title,
    detail: message ? `${base.detail}\n\n${message}` : base.detail,
    message,
  };
}

/**
 * Nombre sugerido para bajar el documento reconstruido.
 *
 * `runPaths` es la convención de rutas del Bloque B, que corre en Node. El
 * browser no escribe en el filesystem: acá se usa solo el basename como nombre
 * del `<a download>`.
 *
 * @param {number} docId
 * @param {string} [nombreDelManifest] El `name` que declaró el emisor.
 */
export function downloadName(docId, nombreDelManifest) {
  const propuesto = String(nombreDelManifest ?? '').trim();
  if (propuesto !== '') {
    // El nombre viene del emisor, que es entrada no confiable: solo el basename.
    const base = propuesto.split(/[/\\]/).pop().replace(/^\.+/, '');
    if (base !== '') return base;
  }
  return runPaths(docId).document.split('/').pop();
}

// ---------------------------------------------------------------------------
// A partir de acá empieza el DOM. Los tests no entran.
// ---------------------------------------------------------------------------

/**
 * Engancha la página del receptor.
 *
 * @param {Document} doc
 */
export function mount(doc = globalThis.document) {
  const $ = (id) => doc.getElementById(id);

  const video = $('video');
  const lienzo = doc.createElement('canvas');
  const ctx = lienzo.getContext('2d', { willReadFrequently: true });

  const botonCamara = $('camara');
  const barra = $('barra');
  const estado = $('estado');
  const panel = $('dictamen');
  const descarga = $('descarga');

  const lecturas = {
    doc: $('r-doc'), progreso: $('r-progreso'), frames: $('r-frames'),
    hits: $('r-hits'), recuperados: $('r-recuperados'), ajenos: $('r-ajenos'),
  };

  const decoder = new FrameDecoder();
  /** @type {MediaStream|null} */ let stream = null;
  /** @type {ScanLoop|null} */ let loop = null;
  let corriendo = false;

  const setEstado = (texto, tono = 'idle') => {
    estado.textContent = texto;
    estado.dataset.tono = tono;
  };

  /** Provider síncrono para `ScanLoop`: un cuadro del video como RGBA. */
  function tomarCuadro() {
    if (!video.videoWidth || !video.videoHeight) return null;
    if (lienzo.width !== video.videoWidth) {
      lienzo.width = video.videoWidth;
      lienzo.height = video.videoHeight;
    }
    ctx.drawImage(video, 0, 0, lienzo.width, lienzo.height);
    const imagen = ctx.getImageData(0, 0, lienzo.width, lienzo.height);
    return { rgba: imagen.data, width: imagen.width, height: imagen.height };
  }

  function pintarFallo(failure) {
    const vista = renderFailure(failure);
    panel.hidden = false;
    panel.dataset.tono = vista.tone;
    panel.innerHTML = '';

    const titulo = doc.createElement('h2');
    titulo.textContent = vista.title;
    const detalle = doc.createElement('p');
    detalle.textContent = vista.detail;
    panel.append(titulo, detalle);
  }

  function pintarDictamen(verdict) {
    const vista = renderVerdict(verdict);
    panel.hidden = false;
    panel.dataset.tono = vista.tone;
    panel.innerHTML = '';

    const titulo = doc.createElement('h2');
    titulo.textContent = vista.title;
    const bajada = doc.createElement('p');
    bajada.className = 'bajada';
    bajada.textContent = vista.summary;
    panel.append(titulo, bajada);

    const lista = doc.createElement('ul');
    lista.className = 'checks';
    for (const fila of vista.rows) {
      const item = doc.createElement('li');
      item.dataset.tono = fila.tone;

      const etiqueta = doc.createElement('span');
      etiqueta.className = 'check-label';
      etiqueta.textContent = fila.label;

      const evidencia = doc.createElement('span');
      evidencia.className = 'check-ev';
      evidencia.textContent = fila.evidence
        .map((ev) => `${ev.value} (${ev.confidenceLabel})`)
        .join(' · ');

      item.append(etiqueta, evidencia);
      lista.append(item);
    }
    panel.append(lista);

    if (vista.ungroundedCount > 0) {
      const aviso = doc.createElement('div');
      aviso.className = 'ungrounded';
      const h = doc.createElement('h3');
      h.textContent = `${vista.ungroundedCount} campo(s) sin respaldo en el documento`;
      aviso.append(h);
      for (const suelto of vista.ungrounded) {
        const p = doc.createElement('p');
        p.textContent = `${suelto.label}: ${suelto.value} — ${suelto.reason}`;
        aviso.append(p);
      }
      panel.append(aviso);
    }

    const match = doc.createElement('p');
    match.className = 'match';
    match.textContent = vista.matchLabel;
    panel.append(match);
  }

  function actualizarLecturas() {
    const stats = loop?.stats ?? { frames: 0, hits: 0 };
    lecturas.progreso.textContent = `${Math.round(decoder.progress * 100)}%`;
    lecturas.frames.textContent = String(stats.frames);
    lecturas.hits.textContent = String(stats.hits);
    lecturas.recuperados.textContent = String(decoder.stats.recovered);
    lecturas.ajenos.textContent = String(decoder.stats.foreign);
    lecturas.doc.textContent = decoder.docId === null
      ? '—'
      : decoder.docId.toString(16).padStart(8, '0');
    barra.style.width = `${decoder.progress * 100}%`;
  }

  function completar() {
    corriendo = false;
    loop?.stop();

    let armado;
    try {
      armado = decoder.assemble();
    } catch (err) {
      setEstado('el documento llegó corrupto', 'error');
      pintarFallo({ stage: 'assemble', code: err.code ?? '', message: err.message });
      return;
    }

    const blob = new Blob([armado.document], { type: armado.manifest.mime });
    descarga.href = URL.createObjectURL(blob);
    descarga.download = downloadName(decoder.docId, armado.manifest.name);
    descarga.hidden = false;
    descarga.textContent = `Guardar ${descarga.download}`;

    setEstado('documento completo · SHA-256 verificado', 'ok');
    detenerCamara();
  }

  function bucle() {
    if (!corriendo) return;

    // Un emisor más nuevo se informa en vez de quedarse escaneando para siempre.
    if (decoder.unsupportedVersion !== null) {
      corriendo = false;
      setEstado('versión de protocolo no soportada', 'error');
      pintarFallo({
        stage: 'scan',
        code: FAILURE_CODES.unsupportedVersion,
        message: `El emisor usa AGP1 v${decoder.unsupportedVersion}.`,
      });
      detenerCamara();
      return;
    }

    if (loop.tick()) {
      actualizarLecturas();
      completar();
      return;
    }
    actualizarLecturas();
    globalThis.requestAnimationFrame(bucle);
  }

  function detenerCamara() {
    for (const pista of stream?.getTracks() ?? []) pista.stop();
    stream = null;
    botonCamara.textContent = 'Encender cámara';
  }

  botonCamara.addEventListener('click', async () => {
    if (corriendo) {
      corriendo = false;
      detenerCamara();
      setEstado('escaneo detenido', 'idle');
      return;
    }

    try {
      stream = await globalThis.navigator.mediaDevices.getUserMedia({
        video: { facingMode: 'environment', width: { ideal: 1280 }, height: { ideal: 1280 } },
      });
    } catch (err) {
      setEstado('sin acceso a la cámara', 'error');
      pintarFallo({
        stage: 'scan',
        code: FAILURE_CODES.cameraUnavailable,
        message: err.message,
      });
      return;
    }

    video.srcObject = stream;
    await video.play();

    decoder.reset();
    panel.hidden = true;
    descarga.hidden = true;
    loop = new ScanLoop(tomarCuadro, decoder);
    corriendo = true;
    botonCamara.textContent = 'Detener';
    setEstado('escaneando · apuntá al código del emisor', 'escaneando');
    globalThis.requestAnimationFrame(bucle);
  });

  setEstado('encendé la cámara para empezar');
}
