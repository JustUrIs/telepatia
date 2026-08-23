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

/** Cuántas claves se nombran en el detalle antes de resumir. Sin esto, un caso
 *  con 200 ítems lista 600 claves y el reporte —que es un entregable— queda
 *  ilegible. */
const MAX_KEYS_IN_DETAIL = 6;

function summarizeKeys(keys, prefix) {
  if (keys.length <= MAX_KEYS_IN_DETAIL) return `${prefix}: ${keys.join(', ')}`;
  // Agrupa las rutas de ítems: lineItems.7.amount -> lineItems.N.amount
  const grouped = new Map();
  for (const k of keys) {
    const g = k.replace(/^lineItems\.\d+\./, 'lineItems.N.');
    grouped.set(g, (grouped.get(g) ?? 0) + 1);
  }
  const shown = [...grouped.entries()].slice(0, MAX_KEYS_IN_DETAIL)
    .map(([k, n]) => (n > 1 ? `${k} ×${n}` : k));
  const resto = grouped.size - shown.length;
  return `${prefix} (${keys.length}): ${shown.join(', ')}${resto > 0 ? ` y ${resto} más` : ''}`;
}

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
      detail: summarizeKeys(ungrounded.map((u) => u.key), 'sin anclar') };
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

  // Object.create(null): con `families[r.family] ??= {...}` y `family:'__proto__'`,
  // el `??=` no asignaba (Object.prototype es truthy) y los `++` escribían EN
  // Object.prototype. Verificado: contaminaba el proceso entero.
  const families = Object.create(null);
  for (const r of rows) {
    const fam = String(r.family ?? 'sin-familia');
    if (!Object.hasOwn(families, fam)) families[fam] = { total: 0, blocked: 0, passed: 0 };
    families[fam].total++;
    if (r.blockedBy === null) families[fam].passed++;
    else families[fam].blocked++;
  }

  // La tasa de bloqueo sola no dice nada: un sistema que rechaza TODO la saca
  // perfecta. El número que le importa a quien procesa 2.000 facturas por mes
  // es el otro — cuántas legítimas terminan en revisión, porque cada una es
  // una persona abriendo un documento a mano.
  const controles = rows.filter((r) => r.family === 'control');
  const falsosPositivos = controles.filter((r) => r.blockedBy !== null);
  const ataques = rows.filter((r) => r.family !== 'control');
  const pasaron = ataques.filter((r) => r.blockedBy === null);

  return {
    rows,
    byLayer,
    byFamily: families,
    // Todo lo que NO es control cuenta como ataque. Antes solo miraba
    // `family === 'adversarial'`, así que un caso con `family:'injection'` o sin
    // familia pasaba y la métrica reportaba cero ataques exitosos.
    adversarialPassed: pasaron.map((r) => r.id),
    controlTotal: controles.length,
    falsePositives: falsosPositivos.map((r) => r.id),
    blockRate: ataques.length === 0 ? null : (ataques.length - pasaron.length) / ataques.length,
    falsePositiveRate: controles.length === 0
      ? null
      : falsosPositivos.length / controles.length,
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

  const pct = (v) => (v === null ? 'n/d' : `${(v * 100).toFixed(1)}%`);

  // Las dos métricas, siempre juntas. Publicar la de bloqueo sola es publicar
  // media verdad: sin la de falsos positivos no se sabe si es una compuerta o
  // un muro.
  lines.push(
    '',
    `**Tasa de bloqueo:** ${pct(result.blockRate)} `
    + `(${result.rows.length - result.controlTotal} ataques, `
    + `${result.adversarialPassed.length} pasaron)`,
    `**Tasa de falsos positivos:** ${pct(result.falsePositiveRate)} `
    + `(${result.controlTotal} facturas legitimas, `
    + `${result.falsePositives.length} frenadas de mas)`,
  );

  if (result.adversarialPassed.length > 0) {
    lines.push('', `**ATAQUES QUE PASARON:** ${result.adversarialPassed.join(', ')}`);
  }
  if (result.falsePositives.length > 0) {
    lines.push('', `**FALSOS POSITIVOS:** ${result.falsePositives.join(', ')}`);
  }
  return lines.join('\n');
}
