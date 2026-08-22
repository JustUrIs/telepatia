// T-17 — Matching de factura contra transacciones del extracto.
//
// Consume Transaction[] ya canónico. NUNCA importa el normalizador de CSV del
// Bloque A: el cruce va por fixture, que es lo que mantiene los dos bloques
// desacoplados.
//
// Un empate NO se resuelve adivinando: devuelve matched=null y deja que el
// dictamen quede en revisión. Dos transferencias del mismo monto el mismo día
// son un caso real, y elegir una al azar es peor que pedir ojos humanos.

import { isTransaction, toCents } from '../shared/contract.js';
import { parseDateIso } from '../shared/money.js';

const W = { amountExact: 40, amountNear: 20, dateNear: 25, invoiceRef: 30, currency: 10 };
const SCORE_THRESHOLD = 60;
const TIE_MARGIN = 15;
const DATE_WINDOW_DAYS = 5;
const NEAR_RATIO = 0.01;

const DAY_MS = 86_400_000;
const daysApart = (a, b) => Math.abs(Date.parse(`${a}T00:00:00Z`) - Date.parse(`${b}T00:00:00Z`)) / DAY_MS;

const val = (g, k) => (k in g ? g[k].value : undefined);

/** Normaliza para buscar el número de factura dentro de una descripción. */
const squash = (s) => String(s).toUpperCase().replace(/[^A-Z0-9]/g, '');

/**
 * @param {Record<string, import('../shared/contract.js').GroundedField>} grounded
 * @param {import('../shared/contract.js').Transaction[]} transactions
 */
export function matchTransaction(grounded, transactions) {
  if (grounded === null || typeof grounded !== 'object') {
    throw new TypeError('matchTransaction espera el mapa de campos anclados');
  }
  if (!Array.isArray(transactions)) {
    throw new TypeError('matchTransaction espera un array de transacciones');
  }

  const totalCents = toCents(val(grounded, 'total'));
  const dueDate = parseDateIso(String(val(grounded, 'dueDate') ?? '')) ?? null;
  const currency = typeof val(grounded, 'currency') === 'string'
    ? val(grounded, 'currency').trim().toUpperCase() : null;
  const invoiceKey = val(grounded, 'invoiceNumber') ? squash(val(grounded, 'invoiceNumber')) : null;

  const candidates = [];
  for (const tx of transactions) {
    if (!isTransaction(tx)) continue;
    const txCents = toCents(tx.amount);
    if (txCents === null || totalCents === null) continue;

    // Un candidato tiene que parecerse en el MONTO. Sin eso no es candidato:
    // coincidir solo en moneda o fecha no dice nada.
    let score = 0;
    const reasons = [];
    if (Math.abs(txCents - totalCents) <= 1) {
      score += W.amountExact; reasons.push('monto exacto');
    } else if (totalCents !== 0 && Math.abs(txCents - totalCents) / Math.abs(totalCents) <= NEAR_RATIO) {
      score += W.amountNear; reasons.push(`monto dentro del ${NEAR_RATIO * 100}%`);
    } else {
      continue;
    }

    if (dueDate) {
      const d = daysApart(tx.date, dueDate);
      if (Number.isFinite(d) && d <= DATE_WINDOW_DAYS) {
        score += W.dateNear; reasons.push(`fecha a ${d} día(s) del vencimiento`);
      }
    }
    if (invoiceKey) {
      const hay = squash(`${tx.description} ${tx.ref ?? ''}`);
      if (hay.includes(invoiceKey)) { score += W.invoiceRef; reasons.push('número de factura en la descripción'); }
    }
    if (currency && tx.currency.toUpperCase() === currency) {
      score += W.currency; reasons.push('moneda coincide');
    }
    candidates.push({ tx, score, reasons });
  }

  candidates.sort((a, b) => b.score - a.score);
  const best = candidates[0];
  const second = candidates[1];

  let matched = null;
  let decision;
  if (!best) {
    decision = 'sin candidatos: ningún movimiento se acerca al total';
  } else if (best.score < SCORE_THRESHOLD) {
    decision = `mejor puntaje ${best.score} por debajo del umbral ${SCORE_THRESHOLD}`;
  } else if (second && best.score - second.score < TIE_MARGIN) {
    decision = `empate: ${best.score} vs ${second.score} (margen mínimo ${TIE_MARGIN}) — requiere revisión humana`;
  } else {
    matched = best.tx;
    decision = `match con puntaje ${best.score}`;
  }
  return { matched, candidates, decision };
}
