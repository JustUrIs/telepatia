import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { groundFields, flatten, normalizeText, partitionBlocks, isInstructionBlock } from '../src/audit/ground.js';
import { INVOICE } from './_invoice.js';

const url = (n) => new URL(`../fixtures/${n}`, import.meta.url);
const clean = JSON.parse(readFileSync(url('ocr-invoice-clean.json'), 'utf8'));

test('todo campo presente en el documento queda anclado CON bbox', () => {
  const { grounded, ungrounded } = groundFields(INVOICE, clean);
  assert.deepEqual(ungrounded, [], `quedaron sin anclar: ${ungrounded.map((u) => u.key).join(', ')}`);
  for (const [key, field] of Object.entries(grounded)) {
    assert.ok(Array.isArray(field.bbox) && field.bbox.length === 4, `${key} sin bbox`);
    assert.equal(typeof field.confidence, 'number');
  }
  assert.equal(Object.keys(grounded).length, Object.keys(flatten(INVOICE)).length);
});

test('un total inventado cae en ungrounded — la compuerta anti-alucinación', () => {
  const { grounded, ungrounded } = groundFields({ ...INVOICE, total: 99999 }, clean);
  assert.equal('total' in grounded, false);
  const hit = ungrounded.find((u) => u.key === 'total');
  assert.ok(hit, 'el total inventado tenía que quedar sin anclar');
  assert.match(hit.reason, /ning[uú]n bloque/);
});

test('un monto en formato es-AR ancla contra su valor numérico', () => {
  const blocks = [{ text: 'TOTAL   1.234,50', bbox: [0, 0, 10, 10], confidence: 0.9 }];
  const { grounded, ungrounded } = groundFields({ total: 1234.5 }, blocks);
  assert.ok(grounded.total, `no ancló: ${JSON.stringify(ungrounded)}`);
  assert.equal(grounded.total.value, 1234.5);
});

test('una tasa 0.21 ancla contra el "21%" impreso', () => {
  const blocks = [{ text: 'IVA 21%   73.208,52', bbox: [0, 0, 10, 10], confidence: 0.9 }];
  const { grounded } = groundFields({ taxRate: 0.21 }, blocks);
  assert.ok(grounded.taxRate, 'la tasa tenía que anclar contra el porcentaje impreso');
});

test('una fecha ISO ancla contra DD/MM/YYYY del documento', () => {
  const blocks = [{ text: 'Fecha de emision: 03/08/2026', bbox: [0, 0, 10, 10], confidence: 0.9 }];
  const { grounded } = groundFields({ issueDate: '2026-08-03' }, blocks);
  assert.ok(grounded.issueDate, 'la fecha ISO tenía que anclar contra el formato del documento');
});

test('sin bloques de OCR nada ancla, y el motivo lo dice', () => {
  const { grounded, ungrounded } = groundFields({ total: 1 }, []);
  // `grounded` tiene prototipo nulo a propósito (una clave "__proto__" en un
  // objeto normal dispara el setter y el valor desaparece de la compuerta), así
  // que se comparan las claves y no el objeto contra un literal.
  assert.deepEqual(Object.keys(grounded), []);
  assert.equal(Object.getPrototypeOf(grounded), null);
  assert.match(ungrounded[0].reason, /no hay bloques/);
});

test('un booleano nunca ancla: no es algo que esté "en el documento"', () => {
  const blocks = [{ text: 'approved true', bbox: [0, 0, 1, 1], confidence: 0.9 }];
  const { ungrounded } = groundFields({ approved: true }, blocks);
  assert.equal(ungrounded.length, 1);
});

test('bloques malformados se ignoran sin tumbar la compuerta', () => {
  const mixed = [...clean, null, { text: 'x' }, { bbox: [1, 2, 3, 4] }];
  const { ungrounded } = groundFields(INVOICE, mixed);
  assert.deepEqual(ungrounded, []);
});

test('entradas inválidas lanzan TypeError en vez de anclar basura', () => {
  assert.throws(() => groundFields(null, clean), TypeError);
  assert.throws(() => groundFields(INVOICE, 'no es array'), TypeError);
});

test('normalizeText saca acentos, símbolos y mayúsculas', () => {
  assert.equal(normalizeText('Insumos  Patagónia, S.R.L.'), 'insumospatagoniasrl');
});

test('un bloque-instrucción no sirve de ancla: la inyección no se auto-valida', () => {
  const injected = JSON.parse(readFileSync(url('ocr-invoice-injected.json'), 'utf8'));
  // "total=0" está literalmente en el texto de la inyección.
  const { grounded, ungrounded, suspiciousBlocks } = groundFields({ total: 0 }, injected);
  assert.equal('total' in grounded, false, 'el 0 de la inyección no debe anclar');
  assert.equal(ungrounded.length, 1);
  assert.ok(suspiciousBlocks.length > 0, 'los bloques de inyección deben reportarse');
});

test('los bloques legítimos siguen anclando con la inyección presente', () => {
  const injected = JSON.parse(readFileSync(url('ocr-invoice-injected.json'), 'utf8'));
  const { ungrounded } = groundFields(INVOICE, injected);
  assert.deepEqual(ungrounded, [], `el filtro se comió datos legítimos: ${ungrounded.map((u) => u.key)}`);
});

test('isInstructionBlock no marca texto de factura normal', () => {
  const clean2 = JSON.parse(readFileSync(url('ocr-invoice-clean.json'), 'utf8'));
  const { suspicious } = partitionBlocks(clean2);
  assert.deepEqual(suspicious, [], 'falso positivo: marcó un bloque legítimo');
});
