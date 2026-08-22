// T-16 — Motor de conciliación interna de la factura.
//
// Funciones PURAS. Cero llamadas al modelo. Este archivo es la razón por la que
// una inyección de prompt no puede voltear un dictamen: el modelo no participa.
//
// Toda la plata se compara en CENTAVOS ENTEROS. Nunca floats: 0.1+0.2 !== 0.3
// en IEEE-754, y una factura rechazada por eso es un bug que parece fraude.

import { toCents } from '../shared/contract.js';
import { parseDateIso } from '../shared/money.js';

/** Tolerancia de redondeo: un centavo. */
const CENT_TOLERANCE = 1;
const MAX_TAX_RATE = 0.30;

const val = (grounded, key) => (key in grounded ? grounded[key].value : undefined);
const ev = (grounded, ...keys) => keys.filter((k) => k in grounded).map((k) => grounded[k]);

function check(id, ok, expected, actual, evidence, note) {
  const r = { id, ok, expected, actual, evidence };
  if (note) r.note = note;
  return r;
}

/** Índices de lineItems presentes en el objeto aplanado, en orden. */
export function lineItemIndices(grounded) {
  const seen = new Set();
  for (const key of Object.keys(grounded)) {
    const m = /^lineItems\.(\d+)\.amount$/.exec(key);
    if (m) seen.add(Number(m[1]));
  }
  return [...seen].sort((a, b) => a - b);
}

/**
 * @param {Record<string, import('../shared/contract.js').GroundedField>} grounded
 * @param {{today?:string}} [opts] `today` en ISO, inyectable para test.
 * @returns {import('../shared/contract.js').CheckResult[]}
 */
export function reconcileInvoice(grounded, opts = {}) {
  if (grounded === null || typeof grounded !== 'object') {
    throw new TypeError('reconcileInvoice espera el mapa de campos anclados');
  }
  const today = opts.today ?? new Date().toISOString().slice(0, 10);
  const checks = [];

  // ---- 1. Los ítems suman el subtotal
  const indices = lineItemIndices(grounded);
  const subtotal = toCents(val(grounded, 'subtotal'));
  if (indices.length === 0 || subtotal === null) {
    checks.push(check('items_sum_subtotal', false, 'suma de ítems === subtotal',
      null, ev(grounded, 'subtotal'), 'faltan ítems o el subtotal no está anclado'));
  } else {
    let sum = 0;
    let broken = false;
    for (const i of indices) {
      const c = toCents(val(grounded, `lineItems.${i}.amount`));
      if (c === null) { broken = true; break; }
      sum += c;
    }
    checks.push(broken
      ? check('items_sum_subtotal', false, 'suma de ítems === subtotal', null,
          ev(grounded, 'subtotal'), 'algún ítem no tiene monto anclado')
      : check('items_sum_subtotal', Math.abs(sum - subtotal) <= CENT_TOLERANCE,
          subtotal / 100, sum / 100,
          ev(grounded, 'subtotal', ...indices.map((i) => `lineItems.${i}.amount`))));
  }

  // ---- 2. subtotal + impuesto === total
  const taxAmount = toCents(val(grounded, 'taxAmount'));
  const total = toCents(val(grounded, 'total'));
  if (subtotal === null || taxAmount === null || total === null) {
    checks.push(check('subtotal_plus_tax_equals_total', false, 'subtotal + IVA === total',
      null, ev(grounded, 'subtotal', 'taxAmount', 'total'), 'falta algún importe anclado'));
  } else {
    checks.push(check('subtotal_plus_tax_equals_total',
      Math.abs(subtotal + taxAmount - total) <= CENT_TOLERANCE,
      total / 100, (subtotal + taxAmount) / 100,
      ev(grounded, 'subtotal', 'taxAmount', 'total')));
  }

  // ---- 3. La tasa es plausible
  const rate = val(grounded, 'taxRate');
  const rateOk = typeof rate === 'number' && Number.isFinite(rate) && rate >= 0 && rate <= MAX_TAX_RATE;
  checks.push(check('tax_rate_plausible', rateOk, `0..${MAX_TAX_RATE}`,
    rate ?? null, ev(grounded, 'taxRate'),
    rateOk ? undefined : 'tasa ausente o fuera del rango razonable'));

  // ---- 4. El importe de IVA se corresponde con la tasa declarada
  if (subtotal === null || taxAmount === null || typeof rate !== 'number') {
    checks.push(check('tax_amount_matches_rate', false, 'subtotal * tasa === IVA', null,
      ev(grounded, 'subtotal', 'taxRate', 'taxAmount'), 'falta subtotal, tasa o importe de IVA'));
  } else {
    const expected = Math.round(subtotal * rate);
    checks.push(check('tax_amount_matches_rate',
      Math.abs(expected - taxAmount) <= CENT_TOLERANCE,
      expected / 100, taxAmount / 100,
      ev(grounded, 'subtotal', 'taxRate', 'taxAmount')));
  }

  // ---- 5. Moneda consistente y con forma de código ISO
  const currency = val(grounded, 'currency');
  const currencyOk = typeof currency === 'string' && /^[A-Z]{3}$/.test(currency.trim().toUpperCase());
  checks.push(check('currency_consistent', currencyOk, 'código ISO de 3 letras',
    currency ?? null, ev(grounded, 'currency'),
    currencyOk ? undefined : 'moneda ausente o con formato inesperado'));

  // ---- 6. Emisión <= vencimiento
  const issue = parseDateIso(String(val(grounded, 'issueDate') ?? ''));
  const due = parseDateIso(String(val(grounded, 'dueDate') ?? ''));
  if (!issue || !due) {
    checks.push(check('dates_ordered', false, 'emisión <= vencimiento', null,
      ev(grounded, 'issueDate', 'dueDate'), 'alguna fecha no se pudo interpretar'));
  } else {
    checks.push(check('dates_ordered', issue <= due, `${issue} <= ${due}`, issue <= due,
      ev(grounded, 'issueDate', 'dueDate')));
  }

  // ---- 7. La emisión no está en el futuro
  if (!issue) {
    checks.push(check('issue_date_not_future', false, `emisión <= ${today}`, null,
      ev(grounded, 'issueDate'), 'la fecha de emisión no se pudo interpretar'));
  } else {
    checks.push(check('issue_date_not_future', issue <= today, `<= ${today}`, issue,
      ev(grounded, 'issueDate')));
  }

  return checks;
}
