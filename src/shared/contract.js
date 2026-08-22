// Contrato congelado entre Bloque A (óptico/CSV/UI) y Bloque B (QVAC/auditoría).
// Nadie modifica este archivo sin avisar al otro dev. Los tipos son JSDoc; los
// validadores existen para que los tests puedan afirmar forma sin dependencias.

/** @typedef {{ text: string, bbox: [number,number,number,number], confidence: number }} OcrBlock */
/** @typedef {{ date: string, description: string, amount: number, currency: string, ref?: string }} Transaction */
/** @typedef {{ value: string|number, bbox: [number,number,number,number], confidence: number }} GroundedField */
/** @typedef {{ key: string, value: unknown, reason: string }} Ungrounded */
/** @typedef {{ id: string, ok: boolean, expected: unknown, actual: unknown, evidence: GroundedField[] }} CheckResult */
/** @typedef {{ verdict: 'pass'|'fail'|'review', checks: CheckResult[], ungrounded: Ungrounded[], matched: Transaction|null }} Verdict */
/** @typedef {{ stage: string, code: string, message: string }} Failure */

/** Etapas del pipeline, en orden. Las usan las métricas y la UI. */
export const STAGES = ['scan', 'assemble', 'ocr', 'extract', 'ground', 'reconcile', 'match', 'verdict'];

/** Códigos de fallo que la UI tiene que saber renderizar. */
export const FAILURE_CODES = {
  digestMismatch: 'digestMismatch',
  ungroundedFields: 'ungroundedFields',
  unsupportedVersion: 'unsupportedVersion',
  emptyDocument: 'emptyDocument',
  backendUnavailable: 'backendUnavailable',
  malformedExtraction: 'malformedExtraction',
};

/** docId (u32) a la forma canónica de 8 chars hex usada en rutas. */
export const docIdHex = (docId) => {
  if (!Number.isInteger(docId) || docId < 0 || docId > 0xffffffff) {
    throw new TypeError(`docId inválido: ${docId}`);
  }
  return docId.toString(16).padStart(8, '0');
};

/** Dónde vive todo lo de una corrida. */
export const runPaths = (docId) => {
  const hex = typeof docId === 'string' ? docId : docIdHex(docId);
  return {
    dir: `runs/${hex}`,
    document: `runs/${hex}/document.bin`,
    ocr: `runs/${hex}/ocr.json`,
    verdict: `runs/${hex}/verdict.json`,
    metrics: `runs/${hex}/metrics.json`,
  };
};

/** Ledger de facturas ya vistas, para detectar duplicados. */
export const LEDGER_PATH = 'runs/ledger.json';

/** Interfaz que TODO backend de inferencia debe cumplir. */
export const BACKEND_METHODS = ['init', 'ocr', 'extract', 'explain', 'dispose'];

/** Dinero en centavos enteros. Nunca comparar floats de plata directamente. */
export const toCents = (amount) => {
  if (typeof amount !== 'number' || !Number.isFinite(amount)) return null;
  return Math.round(amount * 100);
};

export function isOcrBlock(v) {
  return !!v && typeof v === 'object'
    && typeof v.text === 'string'
    && Array.isArray(v.bbox) && v.bbox.length === 4 && v.bbox.every(Number.isFinite)
    && typeof v.confidence === 'number' && v.confidence >= 0 && v.confidence <= 1;
}

export function isTransaction(v) {
  return !!v && typeof v === 'object'
    && typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.date)
    && typeof v.description === 'string'
    && Number.isFinite(v.amount)
    && typeof v.currency === 'string' && v.currency.length === 3;
}

export function isCheckResult(v) {
  return !!v && typeof v === 'object'
    && typeof v.id === 'string' && typeof v.ok === 'boolean'
    && Array.isArray(v.evidence);
}

export function isVerdict(v) {
  return !!v && typeof v === 'object'
    && ['pass', 'fail', 'review'].includes(v.verdict)
    && Array.isArray(v.checks) && v.checks.every(isCheckResult)
    && Array.isArray(v.ungrounded)
    && (v.matched === null || isTransaction(v.matched));
}

export function isFailure(v) {
  return !!v && typeof v === 'object'
    && typeof v.stage === 'string' && STAGES.includes(v.stage)
    && typeof v.code === 'string' && typeof v.message === 'string';
}

export function isBackend(v) {
  return !!v && BACKEND_METHODS.every((m) => typeof v[m] === 'function');
}
