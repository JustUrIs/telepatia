import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groundFields } from '../src/audit/ground.js';
import { reconcileInvoice, lineItemIndices } from '../src/audit/reconcile.js';
import { INVOICE, TODAY } from './_invoice.js';

const clean = JSON.parse(readFileSync(new URL('../fixtures/ocr-invoice-clean.json', import.meta.url), 'utf8'));
const groundOf = (inv, blocks = clean) => groundFields(inv, blocks).grounded;
const run = (inv, blocks) => reconcileInvoice(groundOf(inv, blocks), { today: TODAY });
const byId = (checks, id) => checks.find((c) => c.id === id);

test('una factura consistente pasa todos los checks', () => {
  const checks = run(INVOICE);
  const failed = checks.filter((c) => !c.ok);
  assert.deepEqual(failed.map((c) => c.id), [], JSON.stringify(failed, null, 2));
  assert.ok(checks.length >= 6);
});

test('cada check lleva la evidencia de los campos que usó', () => {
  for (const c of run(INVOICE)) {
    assert.ok(Array.isArray(c.evidence), `${c.id} sin evidence`);
    if (['items_sum_subtotal', 'subtotal_plus_tax_equals_total'].includes(c.id)) {
      assert.ok(c.evidence.length > 0, `${c.id} debería citar evidencia`);
      assert.ok(c.evidence.every((e) => Array.isArray(e.bbox)), `${c.id} con evidencia sin bbox`);
    }
  }
});

test('alterar el total hace fallar SOLO el check de la suma', () => {
  // Se usa un bloque de OCR con el total alterado para que igual ancle.
  const blocks = [...clean, { text: 'TOTAL   421.821,52', bbox: [0, 0, 10, 10], confidence: 0.9 }];
  const checks = run({ ...INVOICE, total: 421821.52 }, blocks);
  const failed = checks.filter((c) => !c.ok).map((c) => c.id);
  assert.deepEqual(failed, ['subtotal_plus_tax_equals_total']);
});

test('una tasa absurda hace fallar SOLO el check de plausibilidad', () => {
  const blocks = [...clean, { text: 'IVA 85%', bbox: [0, 0, 10, 10], confidence: 0.9 }];
  const checks = run({ ...INVOICE, taxRate: 0.85 }, blocks);
  const failed = checks.filter((c) => !c.ok).map((c) => c.id).sort();
  // La tasa 0.85 también rompe la correspondencia tasa/importe, que es correcto.
  assert.deepEqual(failed, ['tax_amount_matches_rate', 'tax_rate_plausible']);
});

test('la aritmética va en centavos: 0.1 + 0.2 no rompe nada', () => {
  const blocks = [
    { text: 'Resma 1 0,10 0,10', bbox: [0, 0, 1, 1], confidence: 0.9 },
    { text: 'Subtotal 0,10', bbox: [0, 1, 1, 1], confidence: 0.9 },
    { text: 'IVA 200% 0,20', bbox: [0, 2, 1, 1], confidence: 0.9 },
    { text: 'TOTAL 0,30', bbox: [0, 3, 1, 1], confidence: 0.9 },
    { text: 'Fecha 03/08/2026 Venc 02/09/2026 ARS FA-1', bbox: [0, 4, 1, 1], confidence: 0.9 },
  ];
  const inv = {
    invoiceNumber: 'FA-1', issueDate: '2026-08-03', dueDate: '2026-09-02',
    supplierName: 'x', supplierTaxId: 'y', currency: 'ARS',
    lineItems: [{ description: 'Resma', quantity: 1, unitPrice: 0.1, amount: 0.1 }],
    subtotal: 0.1, taxRate: 2, taxAmount: 0.2, total: 0.30000000000000004,
  };
  const checks = reconcileInvoice(groundFields(inv, blocks).grounded, { today: TODAY });
  assert.equal(byId(checks, 'subtotal_plus_tax_equals_total').ok, true,
    'la suma en centavos tenía que cerrar pese al float');
});

test('una fecha de emisión futura falla, y solo eso', () => {
  const blocks = [...clean, { text: 'Fecha de emision: 03/08/2027', bbox: [0, 0, 1, 1], confidence: 0.9 },
    { text: 'Vencimiento: 02/09/2027', bbox: [0, 1, 1, 1], confidence: 0.9 }];
  const checks = run({ ...INVOICE, issueDate: '2027-08-03', dueDate: '2027-09-02' }, blocks);
  assert.equal(byId(checks, 'issue_date_not_future').ok, false);
  assert.equal(byId(checks, 'dates_ordered').ok, true);
});

test('vencimiento anterior a la emisión falla dates_ordered', () => {
  const blocks = [...clean, { text: 'Vencimiento: 01/07/2026', bbox: [0, 0, 1, 1], confidence: 0.9 }];
  const checks = run({ ...INVOICE, dueDate: '2026-07-01' }, blocks);
  assert.equal(byId(checks, 'dates_ordered').ok, false);
});

test('campos ausentes producen checks en false, nunca un throw', () => {
  const checks = reconcileInvoice({}, { today: TODAY });
  assert.ok(checks.length >= 6);
  assert.ok(checks.every((c) => c.ok === false));
  assert.ok(checks.every((c) => typeof c.note === 'string'));
});

test('un ítem sin monto anclado no se cuenta como suma correcta', () => {
  const g = groundOf(INVOICE);
  delete g['lineItems.1.amount'];
  const checks = reconcileInvoice(g, { today: TODAY });
  assert.equal(byId(checks, 'items_sum_subtotal').ok, false);
});

test('lineItemIndices ordena numéricamente, no lexicográficamente', () => {
  const g = {};
  for (const i of [0, 1, 2, 10, 11]) g[`lineItems.${i}.amount`] = { value: 1, bbox: [0, 0, 1, 1], confidence: 1 };
  assert.deepEqual(lineItemIndices(g), [0, 1, 2, 10, 11]);
});

test('moneda con formato inesperado falla currency_consistent', () => {
  const blocks = [...clean, { text: 'Moneda: pesos', bbox: [0, 0, 1, 1], confidence: 0.9 }];
  const checks = run({ ...INVOICE, currency: 'pesos' }, blocks);
  assert.equal(byId(checks, 'currency_consistent').ok, false);
});

test('reconcileInvoice rechaza entrada que no sea objeto', () => {
  assert.throws(() => reconcileInvoice(null), TypeError);
  assert.throws(() => reconcileInvoice('x'), TypeError);
});
