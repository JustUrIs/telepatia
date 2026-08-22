// T-20 — Pipeline end-to-end, con cronometraje por etapa y reporte de hardware.
//
// Encadena ocr -> extract -> ground -> reconcile -> match -> verdict, midiendo
// cada etapa de STAGES. Las etapas `scan` y `assemble` las hace el receptor
// óptico (Bloque A) antes de esto, así que acá figuran como 'skipped' cuando ya
// llega un documento en disco: el reporte tiene una entrada por cada etapa,
// siempre, y se ve dónde se fue el tiempo.

import { mkdirSync, writeFileSync, statSync } from 'node:fs';
import { STAGES, FAILURE_CODES, runPaths, docIdHex } from '../shared/contract.js';
import { INVOICE_SCHEMA, validateInvoice } from './schema.js';
import { groundFields } from './ground.js';
import { reconcileInvoice } from './reconcile.js';
import { matchTransaction } from './match.js';
import { buildVerdict } from './verdict.js';
import { explainVerdict } from './explain.js';

class Clock {
  constructor() { this.entries = new Map(); for (const s of STAGES) this.entries.set(s, { stage: s, ms: null, status: 'skipped' }); }
  async time(stage, fn) {
    const t0 = performance.now();
    try {
      const out = await fn();
      this.entries.set(stage, { stage, ms: +(performance.now() - t0).toFixed(1), status: 'ok' });
      return out;
    } catch (err) {
      this.entries.set(stage, { stage, ms: +(performance.now() - t0).toFixed(1), status: 'error', error: err?.message ?? String(err) });
      throw err;
    }
  }
  report() { return STAGES.map((s) => this.entries.get(s)); }
}

const fail = (stage, code, message) => ({ ok: false, failure: { stage, code, message } });

/**
 * @param {{documentPath:string, transactions?:any[], backend:object, docId?:number|string,
 *          today?:string, ledgerPath?:string, persist?:boolean, systemResources?:object}} input
 * @returns {Promise<{ok:boolean, verdict?:object, failure?:object, metrics:object}>}
 */
export async function runPipeline(input) {
  const {
    documentPath, transactions = [], backend,
    docId, today, ledgerPath, persist = true, systemResources = null,
  } = input ?? {};

  if (!backend || typeof backend.ocr !== 'function' || typeof backend.extract !== 'function') {
    throw new TypeError('runPipeline necesita un backend que cumpla la interfaz');
  }
  if (typeof documentPath !== 'string' || documentPath === '') {
    throw new TypeError('runPipeline necesita documentPath');
  }

  const clock = new Clock();
  const started = performance.now();
  let documentBytes = null;
  try { documentBytes = statSync(documentPath).size; } catch { documentBytes = null; }

  const finish = (outcome) => {
    const metrics = {
      docId: docId === undefined ? null : (typeof docId === 'string' ? docId : docIdHex(docId)),
      documentPath, documentBytes,
      totalMs: +(performance.now() - started).toFixed(1),
      stages: clock.report(),
      systemResources,
      outcome: outcome.ok ? outcome.verdict.verdict : `failure:${outcome.failure.code}`,
    };
    if (persist && docId !== undefined) {
      try {
        const paths = runPaths(docId);
        mkdirSync(paths.dir, { recursive: true });
        writeFileSync(paths.metrics, JSON.stringify(metrics, null, 2) + '\n');
      } catch { /* el artefacto es opcional; el resultado en memoria no */ }
    }
    return { ...outcome, metrics };
  };

  if (documentBytes === 0) {
    return finish(fail('assemble', FAILURE_CODES.emptyDocument, `${documentPath} está vacío`));
  }

  // ---- OCR
  let blocks;
  try {
    blocks = await clock.time('ocr', () => backend.ocr(documentPath));
  } catch (err) {
    return finish(fail('ocr', err?.code ?? FAILURE_CODES.backendUnavailable, err?.message ?? String(err)));
  }
  if (!Array.isArray(blocks) || blocks.length === 0) {
    return finish(fail('ocr', FAILURE_CODES.emptyDocument, 'el OCR no devolvió ningún bloque de texto'));
  }

  // ---- Extracción con gramática
  let extraction;
  try {
    extraction = await clock.time('extract', () => backend.extract(blocks, INVOICE_SCHEMA));
  } catch (err) {
    return finish(fail('extract', err?.code ?? FAILURE_CODES.malformedExtraction, err?.message ?? String(err)));
  }
  const validation = validateInvoice(extraction, INVOICE_SCHEMA);
  if (!validation.ok) {
    return finish(fail('extract', FAILURE_CODES.malformedExtraction,
      `la extracción no cumple el schema: ${validation.errors.slice(0, 3).join('; ')}`));
  }

  // ---- Grounding
  const { grounded, ungrounded, suspiciousBlocks } = await clock.time('ground',
    () => groundFields(extraction, blocks));

  // ---- Aritmética determinista
  const checks = await clock.time('reconcile', () => reconcileInvoice(grounded, today ? { today } : {}));

  // ---- Match bancario
  const { matched, candidates, decision } = await clock.time('match',
    () => matchTransaction(grounded, transactions));

  // ---- Dictamen (código, no modelo)
  const verdict = await clock.time('verdict', () => buildVerdict({
    checks, ungrounded, matched,
    invoiceNumber: grounded.invoiceNumber?.value,
    docId, ledgerPath, persist,
  }));

  // ---- Explicación: lo último, y opcional por diseño.
  verdict.explanation = await explainVerdict(backend, verdict.checks, { verdict: verdict.verdict });
  verdict.matchDecision = decision;
  verdict.candidateCount = candidates.length;
  verdict.suspiciousBlockCount = suspiciousBlocks?.length ?? 0;

  return finish({ ok: true, verdict });
}
