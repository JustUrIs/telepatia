// T-19 — Corpus adversario y sucio, con métricas por capa defensiva.
//
// El entregable que más pesa en "evidencia, no vibras". La pregunta que
// responde no es "¿resistimos?" sino "¿QUÉ capa paró cada ataque?". Un número
// global no dice nada; saber que el 40% se corta en la gramática y el 40% en el
// grounding sí, porque dice qué pasaría si sacaras una de las dos.
//
// Las cuatro capas, en el orden en que actúan:
//   schema  — la gramática JSON Schema rechaza la forma
//   ground  — el valor no aparece en el OCR
//   verdict — la aritmética determinista lo rechaza
//   (null)  — nada lo paró: el ataque pasó

import { validateInvoice, INVOICE_SCHEMA } from './schema.js';
import { groundFields } from './ground.js';
import { reconcileInvoice } from './reconcile.js';
import { matchTransaction } from './match.js';
import { buildVerdict } from './verdict.js';

export const LAYERS = ['schema', 'ground', 'verdict'];

/**
 * Corre un caso por las cuatro capas y reporta dónde murió.
 * @returns {{id:string, family:string, blockedBy:string|null, verdict:string,
 *            detail:string, ungroundedCount:number, failedChecks:string[]}}
 */
export function runCase(testCase, { transactions = [], today, ledgerPath, persist = false } = {}) {
  const { id, family, blocks = [], extraction } = testCase;
  const base = { id, family, ungroundedCount: 0, failedChecks: [] };

  // ---- Capa 1: la gramática / el schema.
  const validation = validateInvoice(extraction, INVOICE_SCHEMA);
  if (!validation.ok) {
    return { ...base, blockedBy: 'schema', verdict: 'fail',
      detail: validation.errors.slice(0, 3).join('; ') };
  }

  // ---- Capa 2: grounding contra el OCR.
  const { grounded, ungrounded } = groundFields(extraction, blocks);
  base.ungroundedCount = ungrounded.length;

  // ---- Capa 3: aritmética determinista + dictamen.
  const checks = reconcileInvoice(grounded, today ? { today } : {});
  const { matched } = matchTransaction(grounded, transactions);
  const verdict = buildVerdict({
    checks, ungrounded, matched,
    invoiceNumber: grounded.invoiceNumber?.value,
    ledgerPath, persist,
  });
  base.failedChecks = verdict.checks.filter((c) => !c.ok).map((c) => c.id);

  // El orden importa: se atribuye a la PRIMERA capa que lo corta, no a la
  // última que se queja. Un valor sin anclar nunca llega a la aritmética — el
  // check que falla después es consecuencia, no causa.
  if (ungrounded.length > 0) {
    return { ...base, blockedBy: 'ground', verdict: verdict.verdict,
      detail: `sin anclar: ${ungrounded.map((u) => u.key).join(', ')}` };
  }
  if (verdict.verdict === 'fail') {
    return { ...base, blockedBy: 'verdict', verdict: 'fail',
      detail: `checks fallidos: ${base.failedChecks.join(', ')}` };
  }
  if (verdict.verdict === 'review') {
    return { ...base, blockedBy: 'verdict', verdict: 'review',
      detail: 'sin coincidencia bancaria' };
  }
  return { ...base, blockedBy: null, verdict: 'pass', detail: 'nada lo detuvo' };
}

/**
 * Corre el corpus entero y arma la tabla de métricas.
 * @returns {{rows:object[], byLayer:Record<string,number>, byFamily:object,
 *            adversarialPassed:string[]}}
 */
export function runHarness(corpus, opts = {}) {
  if (!Array.isArray(corpus) || corpus.length === 0) {
    throw new TypeError('runHarness espera un corpus no vacío');
  }
  const rows = corpus.map((c) => runCase(c, opts));

  const byLayer = { schema: 0, ground: 0, verdict: 0, none: 0 };
  for (const r of rows) byLayer[r.blockedBy ?? 'none']++;

  const families = {};
  for (const r of rows) {
    families[r.family] ??= { total: 0, blocked: 0, passed: 0 };
    families[r.family].total++;
    if (r.blockedBy === null) families[r.family].passed++;
    else families[r.family].blocked++;
  }

  return {
    rows,
    byLayer,
    byFamily: families,
    adversarialPassed: rows.filter((r) => r.family === 'adversarial' && r.blockedBy === null).map((r) => r.id),
  };
}

/** Tabla en markdown, lista para pegar en el README de la submission. */
export function formatReport(result) {
  const lines = [
    '| caso | familia | cortado por | dictamen | detalle |',
    '|---|---|---|---|---|',
    ...result.rows.map((r) =>
      `| \`${r.id}\` | ${r.family} | ${r.blockedBy ?? '**NINGUNA**'} | ${r.verdict} | ${r.detail} |`),
    '',
    '**Cortes por capa defensiva:** ' +
      Object.entries(result.byLayer).map(([k, v]) => `${k}=${v}`).join(' · '),
  ];
  return lines.join('\n');
}
