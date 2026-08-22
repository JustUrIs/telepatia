import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groundFields } from '../src/audit/ground.js';
import { matchTransaction } from '../src/audit/match.js';
import { INVOICE } from './_invoice.js';

const url = (n) => new URL(`../fixtures/${n}`, import.meta.url);
const clean = JSON.parse(readFileSync(url('ocr-invoice-clean.json'), 'utf8'));
// Consume el fixture normalizado, NUNCA el normalizador del Bloque A.
const TXS = JSON.parse(readFileSync(url('statement-normalized.json'), 'utf8'));
const g = (inv = INVOICE) => groundFields(inv, clean).grounded;

test('monto y referencia exactos producen un match', () => {
  const { matched, candidates, decision } = matchTransaction(g(), TXS);
  assert.ok(matched, decision);
  assert.equal(matched.ref, 'TRF-99812');
  assert.ok(candidates[0].reasons.includes('número de factura en la descripción'));
});

test('dos movimientos del mismo monto sin referencia dan empate, no adivinanza', () => {
  // Sin número de factura anclado, TRF-99812 y TRF-99813 puntúan igual.
  const grounded = g();
  delete grounded.invoiceNumber;
  const { matched, candidates, decision } = matchTransaction(grounded, TXS);
  assert.equal(matched, null, 'un empate no debe resolverse eligiendo uno');
  assert.equal(candidates.length, 2);
  assert.equal(candidates[0].score, candidates[1].score);
  assert.match(decision, /empate/);
});

test('sin monto cercano no hay candidatos', () => {
  const blocks = [...clean, { text: 'TOTAL   7,77', bbox: [0, 0, 1, 1], confidence: 0.9 }];
  const grounded = groundFields({ ...INVOICE, total: 7.77 }, blocks).grounded;
  const { matched, candidates } = matchTransaction(grounded, TXS);
  assert.equal(matched, null);
  assert.deepEqual(candidates, []);
});

test('un monto dentro del 1% es candidato pero puntúa menos', () => {
  const near = 421820.52 * 1.005;
  const blocks = [{ text: `TOTAL ${near.toFixed(2).replace('.', ',')}`, bbox: [0, 0, 1, 1], confidence: 0.9 },
    { text: 'Vencimiento: 02/09/2026 ARS', bbox: [0, 1, 1, 1], confidence: 0.9 }];
  const grounded = groundFields({ total: near, dueDate: '2026-09-02', currency: 'ARS' }, blocks).grounded;
  const { candidates } = matchTransaction(grounded, TXS);
  assert.ok(candidates.length >= 1);
  assert.ok(candidates[0].reasons.some((r) => /dentro del 1%/.test(r)));
});

test('transacciones malformadas se ignoran sin romper', () => {
  const dirty = [...TXS, null, { date: 'ayer', amount: 1 }, { date: '2026-09-02', description: 'x', amount: NaN, currency: 'ARS' }];
  const { matched } = matchTransaction(g(), dirty);
  assert.ok(matched);
  assert.equal(matched.ref, 'TRF-99812');
});

test('una lista vacía de transacciones no es un error', () => {
  const { matched, candidates, decision } = matchTransaction(g(), []);
  assert.equal(matched, null);
  assert.deepEqual(candidates, []);
  assert.match(decision, /sin candidatos/);
});

test('sin total anclado no hay match posible', () => {
  const grounded = g();
  delete grounded.total;
  const { matched, candidates } = matchTransaction(grounded, TXS);
  assert.equal(matched, null);
  assert.deepEqual(candidates, []);
});

test('fecha fuera de la ventana de 5 días no aporta puntaje de fecha', () => {
  const far = TXS.map((t) => ({ ...t, date: '2026-12-01' }));
  const { candidates } = matchTransaction(g(), far);
  assert.ok(candidates.length > 0);
  assert.ok(!candidates[0].reasons.some((r) => /vencimiento/.test(r)));
});

test('entradas inválidas lanzan TypeError', () => {
  assert.throws(() => matchTransaction(null, TXS), TypeError);
  assert.throws(() => matchTransaction(g(), 'no es array'), TypeError);
});
