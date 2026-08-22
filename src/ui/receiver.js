// T-10 — Receptor: cámara → escaneo → reconstrucción → render del dictamen.
//
// Todo el acceso al DOM vive en mount(). Lo demás son funciones puras que los
// tests ejercitan sin navegador: renderVerdict() y renderFailure() devuelven
// una estructura de vista, no nodos.

import { FrameDecoder } from '../optical/protocol.js';
import { ScanLoop } from '../optical/scan.js';
import { FAILURE_CODES, STAGES, isVerdict, isFailure, docIdHex } from '../shared/contract.js';

const VERDICT_LABEL = {
  pass: { title: 'Conciliada', tone: 'ok', hint: 'Todos los controles pasaron.' },
  fail: { title: 'Rechazada', tone: 'bad', hint: 'Al menos un control falló.' },
  review: { title: 'Requiere revisión', tone: 'warn', hint: 'Hay campos sin anclar o sin coincidencia bancaria.' },
};

const FAILURE_TEXT = {
  [FAILURE_CODES.digestMismatch]:
    'El documento llegó corrupto: el SHA-256 no coincide con el declarado. Volvé a escanear.',
  [FAILURE_CODES.ungroundedFields]:
    'El modelo devolvió valores que no aparecen en el documento. Se descartaron y el dictamen queda en revisión.',
  [FAILURE_CODES.unsupportedVersion]:
    'Esa pantalla emite un formato AGP que esta versión no entiende. Actualizá el receptor.',
  [FAILURE_CODES.emptyDocument]: 'El documento reconstruido está vacío.',
  [FAILURE_CODES.backendUnavailable]:
    'El motor de inferencia local no está disponible. Revisá que el modelo esté descargado.',
  [FAILURE_CODES.malformedExtraction]:
    'La extracción no devolvió JSON válido. Se reintenta o se marca para revisión manual.',
  [FAILURE_CODES.malformedRow]:
    'Una fila del extracto bancario no se pudo interpretar. Quedó registrada como rechazada.',
  [FAILURE_CODES.cameraUnavailable]:
    'No se pudo abrir la cámara. Revisá el permiso del navegador y que ninguna otra app la esté usando.',
};

/** Un check → fila de vista, con su evidencia aplanada para mostrar. */
function checkRow(check) {
  return {
    id: check.id,
    ok: check.ok === true,
    tone: check.ok === true ? 'ok' : 'bad',
    expected: format(check.expected),
    actual: format(check.actual),
    // La bbox es la prueba de procedencia del campo: una que no cumple la forma
    // del contrato se reporta como desconocida, no se pasa a la vista para que
    // alguien dibuje un recuadro con ella.
    evidence: (Array.isArray(check.evidence) ? check.evidence : []).map((e) => ({
      value: format(e?.value),
      bbox: Array.isArray(e?.bbox) && e.bbox.length === 4 && e.bbox.every(Number.isFinite) ? e.bbox : null,
      confidence: typeof e?.confidence === 'number' && e.confidence >= 0 && e.confidence <= 1 ? e.confidence : null,
    })),
  };
}

function format(v) {
  if (v === null || v === undefined) return '—';
  if (typeof v === 'number') return Number.isInteger(v) ? String(v) : v.toFixed(2);
  if (typeof v === 'boolean') return v ? 'sí' : 'no';
  if (typeof v === 'object') return JSON.stringify(v);
  return String(v);
}

/**
 * Verdict → estructura de vista. Obligatorio cubrir los tres estados.
 * @param {import('../shared/contract.js').Verdict} verdict
 */
export function renderVerdict(verdict) {
  if (!isVerdict(verdict)) {
    throw new TypeError('renderVerdict recibió algo que no es un Verdict válido');
  }
  const label = VERDICT_LABEL[verdict.verdict];
  const rows = verdict.checks.map(checkRow);
  return {
    kind: 'verdict',
    status: verdict.verdict,
    title: label.title,
    tone: label.tone,
    hint: label.hint,
    rows,
    failedCount: rows.filter((r) => !r.ok).length,
    ungrounded: verdict.ungrounded.map((u) => ({
      key: String(u?.key ?? '?'),
      value: format(u?.value),
      reason: String(u?.reason ?? 'sin motivo'),
      tone: 'warn',
    })),
    hasUngrounded: verdict.ungrounded.length > 0,
    match: verdict.matched
      ? { date: verdict.matched.date, description: verdict.matched.description,
          amount: format(verdict.matched.amount), currency: verdict.matched.currency,
          ref: verdict.matched.ref ?? null }
      : null,
  };
}

/** Failure → estructura de vista. Los códigos desconocidos no rompen la UI. */
export function renderFailure(failure) {
  if (!isFailure(failure)) {
    throw new TypeError('renderFailure recibió algo que no es un Failure válido');
  }
  return {
    kind: 'failure',
    tone: 'bad',
    stage: failure.stage,
    stageIndex: STAGES.indexOf(failure.stage),
    code: failure.code,
    title: `Falló en la etapa "${failure.stage}"`,
    // Object.hasOwn y no indexación cruda: con `code: 'toString'` el lookup
    // alcanzaba Object.prototype y `text` dejaba de ser un string.
    text: Object.hasOwn(FAILURE_TEXT, failure.code)
      ? FAILURE_TEXT[failure.code]
      : (failure.message || 'Error desconocido.'),
    recoverable: failure.code !== FAILURE_CODES.unsupportedVersion,
  };
}

/** Texto de la barra de progreso a partir del decoder. Puro, testeable. */
export function progressLabel(decoder) {
  if (!decoder?.manifest) return { percent: 0, text: 'Buscando un código…' };
  const percent = Math.round(decoder.progress * 100);
  const have = decoder.chunks.size;
  const total = decoder.manifest.total;
  const rec = decoder.stats.recovered;
  return {
    percent,
    text: `${percent}% · ${have}/${total} bloques${rec > 0 ? ` · ${rec} recuperados por paridad` : ''}`,
  };
}

// ---------------------------------------------------------------- DOM (mount)

/** Proveedor de frames desde un <video> vía <canvas>. */
function videoFrameProvider(video, canvas) {
  const ctx = canvas.getContext('2d', { willReadFrequently: true });
  return () => {
    const w = video.videoWidth;
    const h = video.videoHeight;
    if (!w || !h) return null;
    if (canvas.width !== w || canvas.height !== h) { canvas.width = w; canvas.height = h; }
    ctx.drawImage(video, 0, 0);
    const img = ctx.getImageData(0, 0, w, h);
    return { rgba: new Uint8Array(img.data.buffer), width: w, height: h };
  };
}

/** Arranca el receptor. `onDocument` recibe {document, manifest, docIdHex}. */
export async function mount({ video, canvas, bar, status, result, onDocument }) {
  const decoder = new FrameDecoder();
  const render = (node) => { if (result) result.textContent = JSON.stringify(node, null, 2); };

  let stream;
  try {
    stream = await navigator.mediaDevices.getUserMedia({
      audio: false,
      video: { facingMode: 'environment', width: { ideal: 1280 } },
    });
  } catch (err) {
    render(renderFailure({ stage: 'scan', code: FAILURE_CODES.cameraUnavailable,
      message: `No se pudo abrir la cámara: ${err?.message ?? err}` }));
    return { decoder, stop: () => {} };
  }

  video.srcObject = stream;
  await video.play().catch(() => undefined);

  const loop = new ScanLoop(videoFrameProvider(video, canvas), decoder);
  let raf = 0;
  let stopped = false;
  const stop = () => {
    stopped = true;
    if (raf) cancelAnimationFrame(raf);
    loop.stop();
    for (const t of stream.getTracks()) t.stop();
  };

  const step = () => {
    if (stopped) return;
    // Una versión no soportada es lo único que amerita cortar y avisar.
    if (decoder.stats.badVersion > 0 && !decoder.manifest) {
      render(renderFailure({ stage: 'scan', code: FAILURE_CODES.unsupportedVersion,
        message: 'formato AGP desconocido' }));
      stop();
      return;
    }
    const done = loop.tick();
    const p = progressLabel(decoder);
    if (bar) bar.style.width = `${p.percent}%`;
    if (status) status.textContent = p.text;
    if (done) {
      stop();
      try {
        const { document: doc, manifest } = decoder.assemble();
        if (doc.length === 0) throw new Error('documento vacío');
        onDocument?.({ document: doc, manifest, docIdHex: docIdHex(decoder.docId) });
        if (status) status.textContent = `Documento recibido: ${manifest.name} (${doc.length} B)`;
      } catch (err) {
        const code = /SHA-256/.test(err.message) ? FAILURE_CODES.digestMismatch
          : /vacío/.test(err.message) ? FAILURE_CODES.emptyDocument
          : FAILURE_CODES.digestMismatch;
        render(renderFailure({ stage: 'assemble', code, message: err.message }));
      }
      return;
    }
    raf = requestAnimationFrame(step);
  };
  raf = requestAnimationFrame(step);
  return { decoder, stop };
}
