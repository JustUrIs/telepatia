import { test } from 'node:test';
import assert from 'node:assert/strict';
import { INVOICE_SCHEMA, FORBIDDEN_KEYS, validateInvoice, schemaKeys } from '../src/audit/schema.js';
import { INVOICE } from './_invoice.js';

test('una factura válida pasa el validador', () => {
  const { ok, errors } = validateInvoice(INVOICE);
  assert.deepEqual(errors, []);
  assert.equal(ok, true);
});

test('una clave extra es rechazada (additionalProperties: false)', () => {
  const { ok, errors } = validateInvoice({ ...INVOICE, approved: true });
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /no permitida "approved"/.test(e)));
});

test('un total como string es rechazado', () => {
  const { ok, errors } = validateInvoice({ ...INVOICE, total: '421820.52' });
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /"total" debería ser number/.test(e)));
});

test('una clave requerida ausente es rechazada', () => {
  const { total, ...sinTotal } = INVOICE;
  const { ok, errors } = validateInvoice(sinTotal);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /falta la clave requerida "total"/.test(e)));
});

test('los ítems se validan uno por uno con su índice', () => {
  const bad = structuredClone(INVOICE);
  bad.lineItems[1].amount = 'mucho';
  const { ok, errors } = validateInvoice(bad);
  assert.equal(ok, false);
  assert.ok(errors.some((e) => /lineItems\[1\].*amount/.test(e)), errors.join(' | '));
});

test('el schema NO contiene ningún campo de veredicto', () => {
  const keys = schemaKeys(INVOICE_SCHEMA).map((k) => k.toLowerCase());
  for (const forbidden of FORBIDDEN_KEYS) {
    assert.ok(
      !keys.some((k) => k.split(/[.\[\]]/).includes(forbidden)),
      `el schema expone un campo de conclusión: ${forbidden}`,
    );
  }
});

test('NaN e Infinity no cuentan como number válido', () => {
  assert.equal(validateInvoice({ ...INVOICE, total: NaN }).ok, false);
  assert.equal(validateInvoice({ ...INVOICE, total: Infinity }).ok, false);
});

test('null y no-objetos se rechazan sin lanzar', () => {
  assert.equal(validateInvoice(null).ok, false);
  assert.equal(validateInvoice([]).ok, false);
  assert.equal(validateInvoice('x').ok, false);
});
