import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FAILURE_CODES, isTransaction, isFailure } from '../src/shared/contract.js';
import { parseCsv } from '../src/csv/parse.js';
import { normalize } from '../src/csv/normalize.js';

const STATEMENT = readFileSync('fixtures/statement.csv', 'utf8');
const ESPERADO = JSON.parse(readFileSync('fixtures/statement-normalized.json', 'utf8'));

const HEADER = ['Fecha', 'Concepto', 'Importe', 'Moneda', 'Referencia'];
const fila = (fecha, concepto, importe, moneda = 'ARS', ref = 'R-1') =>
  [fecha, concepto, importe, moneda, ref];
const soloUna = (...args) => normalize([HEADER, fila(...args)]);

test('LA ASERCION: el extracto real normaliza exactamente al fixture canonico', () => {
  const { transactions } = normalize(parseCsv(STATEMENT));
  assert.deepEqual(transactions, ESPERADO);
});

test('toda transaccion emitida pasa isTransaction', () => {
  const { transactions } = normalize(parseCsv(STATEMENT));
  assert.equal(transactions.length, 5);
  for (const tx of transactions) {
    assert.ok(isTransaction(tx), `no pasa isTransaction: ${JSON.stringify(tx)}`);
  }
});

test('1.234,56 y 1,234.56 dan los dos 1234.56', () => {
  assert.equal(soloUna('2026-01-01', 'x', '1.234,56').transactions[0].amount, 1234.56);
  assert.equal(soloUna('2026-01-01', 'x', '1,234.56').transactions[0].amount, 1234.56);
});

test('(50,00) da -50, y el sufijo menos tambien', () => {
  assert.equal(soloUna('2026-01-01', 'x', '(50,00)').transactions[0].amount, -50);
  assert.equal(soloUna('2026-01-01', 'x', '50,00-').transactions[0].amount, -50);
  assert.equal(soloUna('2026-01-01', 'x', '-50,00').transactions[0].amount, -50);
  assert.equal(soloUna('2026-01-01', 'x', '50,00').transactions[0].amount, 50);
});

test('el separador decimal se decide por la posicion del ultimo, no por locale', () => {
  const casos = [
    ['421.820,52', 421820.52],
    ['421,820.52', 421820.52],
    ['1.000,00', 1000],
    ['0,50', 0.5],
    ['0.50', 0.5],
    ['1234', 1234],
    ['ARS 1.284.500,00', 1284500],
    ['$ 47.412,00', 47412],
  ];
  for (const [texto, esperado] of casos) {
    assert.equal(soloUna('2026-01-01', 'x', texto).transactions[0].amount, esperado, texto);
  }
});

test('un separador unico con tres digitos detras es de miles, no decimal', () => {
  assert.equal(soloUna('2026-01-01', 'x', '1.000').transactions[0].amount, 1000);
  assert.equal(soloUna('2026-01-01', 'x', '1,000').transactions[0].amount, 1000);
  assert.equal(soloUna('2026-01-01', 'x', '1.234.567').transactions[0].amount, 1234567);
});

test('las tres formas de fecha dan ISO', () => {
  assert.equal(soloUna('02/09/2026', 'x', '1,00').transactions[0].date, '2026-09-02');
  assert.equal(soloUna('2026-08-28', 'x', '1,00').transactions[0].date, '2026-08-28');
  assert.equal(soloUna('15-07-26', 'x', '1,00').transactions[0].date, '2026-07-15');
  assert.equal(soloUna('02-09-2026', 'x', '1,00').transactions[0].date, '2026-09-02');
});

test('el pivote de siglo es 70', () => {
  assert.equal(soloUna('01-01-69', 'x', '1,00').transactions[0].date, '2069-01-01');
  assert.equal(soloUna('01-01-70', 'x', '1,00').transactions[0].date, '1970-01-01');
  assert.equal(soloUna('01-01-99', 'x', '1,00').transactions[0].date, '1999-01-01');
  assert.equal(soloUna('01-01-26', 'x', '1,00').transactions[0].date, '2026-01-01');
});

test('una fecha que no existe se rechaza, no se corre de mes', () => {
  for (const mala of ['31/02/2026', '2026-13-01', '00/01/2026', '2026-02-30']) {
    const { transactions, rejected } = soloUna(mala, 'x', '1,00');
    assert.equal(transactions.length, 0, `acepto ${mala}`);
    assert.equal(rejected.length, 1);
  }
});

test('una fila con fecha basura va a rejected con un Failure del contrato', () => {
  const { rejected } = normalize(parseCsv(STATEMENT));
  assert.equal(rejected.length, 1);

  const [fallo] = rejected;
  assert.ok(isFailure(fallo), `no pasa isFailure: ${JSON.stringify(fallo)}`);
  assert.equal(fallo.stage, 'csv');
  assert.equal(fallo.code, FAILURE_CODES.malformedRow);
  assert.match(fallo.message, /no-es-una-fecha|fecha/i, 'el motivo tiene que ser legible');
});

test('nada se descarta en silencio: filas + rechazos cubren todos los datos', () => {
  const rows = parseCsv(STATEMENT);
  const { transactions, rejected } = normalize(rows);
  assert.equal(transactions.length + rejected.length, rows.length - 1, 'menos el encabezado');
});

test('un monto ilegible se rechaza con su motivo', () => {
  for (const malo of ['abc', '', '--', '1,2,3.4.5', 'N/D']) {
    const { transactions, rejected } = soloUna('2026-01-01', 'x', malo);
    assert.equal(transactions.length, 0, `acepto el monto ${JSON.stringify(malo)}`);
    assert.equal(rejected[0].code, FAILURE_CODES.malformedRow);
    assert.ok(isFailure(rejected[0]));
  }
});

test('sin columna de moneda no se inventa un default: todo va a rejected', () => {
  const rows = [
    ['Fecha', 'Concepto', 'Importe'],
    ['2026-01-01', 'x', '1,00'],
    ['2026-01-02', 'y', '2,00'],
  ];
  const { transactions, rejected } = normalize(rows);
  assert.equal(transactions.length, 0);
  assert.equal(rejected.length, 2);
  assert.ok(rejected.every(isFailure));
  assert.match(rejected[0].message, /moneda|currency/i);
});

test('una moneda que no son 3 letras se rechaza', () => {
  for (const mala of ['AR', 'PESOS', '', '12A']) {
    const { transactions, rejected } = soloUna('2026-01-01', 'x', '1,00', mala);
    assert.equal(transactions.length, 0, `acepto la moneda ${JSON.stringify(mala)}`);
    assert.equal(rejected.length, 1);
  }
  assert.equal(soloUna('2026-01-01', 'x', '1,00', 'usd').transactions[0].currency, 'USD');
});

test('los sinonimos de encabezado se reconocen en cualquier variante', () => {
  const variantes = [
    ['Fecha', 'Concepto', 'Importe', 'Moneda', 'Referencia'],
    ['date', 'description', 'amount', 'currency', 'ref'],
    ['F. Valor', 'Detalle', 'Monto', 'Divisa', 'Comprobante'],
    ['  FECHA  ', 'DESCRIPTION', 'MONTO', 'CURRENCY', 'REF'],
  ];
  for (const header of variantes) {
    const { transactions } = normalize([header, ['2026-01-01', 'x', '1,00', 'ARS', 'R-9']]);
    assert.equal(transactions.length, 1, `no mapeo ${header.join('|')}`);
    assert.deepEqual(transactions[0], {
      date: '2026-01-01', description: 'x', amount: 1, currency: 'ARS', ref: 'R-9',
    });
  }
});

test('sin columna de referencia la transaccion sale sin ref, no con ref vacio', () => {
  const rows = [['Fecha', 'Concepto', 'Importe', 'Moneda'], ['2026-01-01', 'x', '1,00', 'ARS']];
  const { transactions } = normalize(rows);
  assert.equal(transactions.length, 1);
  assert.equal('ref' in transactions[0], false);
  assert.ok(isTransaction(transactions[0]));
});

test('faltan columnas obligatorias: se rechaza con motivo, no se rompe', () => {
  const { transactions, rejected } = normalize([['Cosa', 'Otra'], ['a', 'b']]);
  assert.equal(transactions.length, 0);
  assert.equal(rejected.length, 1);
  assert.ok(isFailure(rejected[0]));
});

test('entrada degenerada no lanza', () => {
  assert.deepEqual(normalize([]), { transactions: [], rejected: [] });
  assert.deepEqual(normalize([HEADER]), { transactions: [], rejected: [] });
  assert.throws(() => normalize(null), /filas/i);
  assert.throws(() => normalize('a,b'), /filas/i);
});

test('una fila con menos columnas que el encabezado se rechaza', () => {
  const { transactions, rejected } = normalize([HEADER, ['2026-01-01', 'x']]);
  assert.equal(transactions.length, 0);
  assert.equal(rejected.length, 1);
  assert.ok(isFailure(rejected[0]));
});
