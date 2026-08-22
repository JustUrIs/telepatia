import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, writeFileSync, readFileSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { buildVerdict, readLedger, ledgerKey } from '../src/audit/verdict.js';
import { isVerdict } from '../src/shared/contract.js';

const tmpLedger = () => join(mkdtempSync(join(tmpdir(), 'tel-')), 'ledger.json');
const okChecks = [
  { id: 'a', ok: true, expected: 1, actual: 1, evidence: [] },
  { id: 'b', ok: true, expected: 2, actual: 2, evidence: [] },
];
const tx = { date: '2026-09-02', description: 'x', amount: 1, currency: 'ARS' };

test('entrada limpia da pass y escribe el ledger', () => {
  const ledgerPath = tmpLedger();
  const v = buildVerdict({ checks: okChecks, ungrounded: [], matched: tx,
    invoiceNumber: 'FA-1', ledgerPath, now: '2026-08-22T10:00:00Z' });
  assert.equal(v.verdict, 'pass');
  assert.equal(isVerdict(v), true);
  assert.ok(readLedger(ledgerPath).entries[ledgerKey('FA-1')]);
});

test('repetir la misma factura da fail por invoice_not_duplicate', () => {
  const ledgerPath = tmpLedger();
  buildVerdict({ checks: okChecks, ungrounded: [], matched: tx, invoiceNumber: 'FA-1', ledgerPath });
  const second = buildVerdict({ checks: okChecks, ungrounded: [], matched: tx, invoiceNumber: 'FA-1', ledgerPath });
  assert.equal(second.verdict, 'fail');
  const dup = second.checks.find((c) => c.id === 'invoice_not_duplicate');
  assert.equal(dup.ok, false);
  assert.match(String(dup.actual), /ya vista/);
});

test('un campo sin anclar fuerza review y NO toca el ledger', () => {
  const ledgerPath = tmpLedger();
  const v = buildVerdict({ checks: okChecks, matched: tx, invoiceNumber: 'FA-2', ledgerPath,
    ungrounded: [{ key: 'total', value: 99999, reason: 'no aparece en el texto del OCR' }] });
  assert.equal(v.verdict, 'review');
  assert.deepEqual(Object.keys(readLedger(ledgerPath).entries), []);
});

test('sin coincidencia bancaria el dictamen queda en review', () => {
  const v = buildVerdict({ checks: okChecks, ungrounded: [], matched: null,
    invoiceNumber: 'FA-3', ledgerPath: tmpLedger() });
  assert.equal(v.verdict, 'review');
});

test('un check en false gana sobre todo lo demás: fail', () => {
  const v = buildVerdict({
    checks: [...okChecks, { id: 'c', ok: false, expected: 1, actual: 2, evidence: [] }],
    ungrounded: [], matched: tx, invoiceNumber: 'FA-4', ledgerPath: tmpLedger() });
  assert.equal(v.verdict, 'fail');
});

test('sin número de factura no se puede descartar duplicado: fail', () => {
  const v = buildVerdict({ checks: okChecks, ungrounded: [], matched: tx, ledgerPath: tmpLedger() });
  assert.equal(v.verdict, 'fail');
  assert.equal(v.checks.find((c) => c.id === 'invoice_not_duplicate').ok, false);
});

test('un ledger corrupto es FAIL-CLOSED: no abre la puerta', () => {
  // Antes devolvía {} y una factura ya aprobada volvía a pasar. Un ledger
  // truncado por una escritura interrumpida no es "primera vez".
  const ledgerPath = tmpLedger();
  writeFileSync(ledgerPath, '{esto no es json');
  const { entries, readable } = readLedger(ledgerPath);
  assert.deepEqual(Object.keys(entries), []);
  assert.equal(readable, false);
  const v = buildVerdict({ checks: okChecks, ungrounded: [], matched: tx, invoiceNumber: 'FA-5', ledgerPath });
  assert.equal(v.verdict, 'fail');
  assert.match(String(v.checks.find((c) => c.id === 'invoice_not_duplicate').actual), /ilegible/);
});

test('un ledger que no existe SÍ es primera vez (no confundir con corrupto)', () => {
  const { entries, readable } = readLedger(join(mkdtempSync(join(tmpdir(), 'tel-')), 'no-existe.json'));
  assert.deepEqual(Object.keys(entries), []);
  assert.equal(readable, true);
});

test('un ledger que es un array se trata como ilegible', () => {
  const { entries, readable } = readLedger((() => { const p = tmpLedger(); writeFileSync(p, '["no"]'); return p; })());
  assert.deepEqual(Object.keys(entries), []);
  assert.equal(readable, false);
});

test('la clave del ledger se normaliza: no hay doble pago por un espacio', () => {
  const ledgerPath = tmpLedger();
  const first = buildVerdict({ checks: okChecks, ungrounded: [], matched: tx, invoiceNumber: 'INV-001', ledgerPath });
  assert.equal(first.verdict, 'pass');
  for (const variante of ['INV-001 ', ' INV-001', 'inv-001', 'INV001', 'inv 001']) {
    const again = buildVerdict({ checks: okChecks, ungrounded: [], matched: tx, invoiceNumber: variante, ledgerPath });
    assert.equal(again.verdict, 'fail', `${JSON.stringify(variante)} se colvió a aprobar`);
  }
  assert.equal(Object.keys(readLedger(ledgerPath).entries).length, 1);
});

test('un invoiceNumber "__proto__" no contamina ni da falso duplicado', () => {
  const ledgerPath = tmpLedger();
  const v = buildVerdict({ checks: okChecks, ungrounded: [], matched: tx, invoiceNumber: '__proto__', ledgerPath });
  // ledgerKey lo reduce a 'PROTO', que es una clave normal.
  assert.equal(v.verdict, 'pass');
  assert.equal(Object.prototype.seenAt, undefined);
});

test('un check malformado cuenta como fallo en vez de hacer lanzar', () => {
  const v = buildVerdict({ checks: [{ id: 'raro', expected: 1, actual: 1, evidence: [] }],
    ungrounded: [], matched: tx, invoiceNumber: 'FA-9', ledgerPath: tmpLedger() });
  assert.equal(v.verdict, 'fail');
});

test('toda salida cumple isVerdict', () => {
  for (const input of [
    { checks: okChecks, ungrounded: [], matched: tx, invoiceNumber: 'A' },
    { checks: [], ungrounded: [], matched: null },
    { checks: okChecks, ungrounded: [{ key: 'x', value: 1, reason: 'y' }], matched: null, invoiceNumber: 'B' },
  ]) {
    assert.equal(isVerdict(buildVerdict({ ...input, ledgerPath: tmpLedger() })), true);
  }
});

test('persist:false no escribe nada al disco', () => {
  const ledgerPath = tmpLedger();
  buildVerdict({ checks: okChecks, ungrounded: [], matched: tx,
    invoiceNumber: 'FA-6', ledgerPath, persist: false });
  assert.equal(existsSync(ledgerPath), false);
});

test('entradas inválidas lanzan TypeError', () => {
  assert.throws(() => buildVerdict({ checks: 'no', ungrounded: [] }), TypeError);
  assert.throws(() => buildVerdict({ checks: [], ungrounded: 'no' }), TypeError);
});
