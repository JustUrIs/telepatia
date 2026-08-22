import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseCsv, sniffDelimiter } from '../src/csv/parse.js';

const STATEMENT = readFileSync('fixtures/statement.csv', 'utf8');

test('sniffDelimiter detecta el punto y coma del extracto real', () => {
  assert.equal(sniffDelimiter(STATEMENT), ';');
});

test('sniffDelimiter distingue coma, punto y coma y tab', () => {
  assert.equal(sniffDelimiter('a,b,c\n1,2,3\n'), ',');
  assert.equal(sniffDelimiter('a;b;c\n1;2;3\n'), ';');
  assert.equal(sniffDelimiter('a\tb\tc\n1\t2\t3\n'), '\t');
});

test('sniffDelimiter solo mira las primeras 5 lineas', () => {
  const texto = ['a;b', '1;2', '3;4', '5;6', '7;8', ...Array(50).fill('x,y,z,w')].join('\n');
  assert.equal(sniffDelimiter(texto), ';');
});

test('sniffDelimiter cae en coma cuando no hay ningun separador', () => {
  assert.equal(sniffDelimiter('una sola columna\notra fila\n'), ',');
  assert.equal(sniffDelimiter(''), ',');
});

test('el extracto real da 7 filas: encabezado + 6 de datos', () => {
  const rows = parseCsv(STATEMENT);
  assert.equal(rows.length, 7);
  assert.ok(rows.every((r) => r.length === 5), 'todas las filas tienen 5 columnas');
});

test('el BOM no se cuela en el primer encabezado', () => {
  const [header] = parseCsv(STATEMENT);
  assert.deepEqual(header, ['Fecha', 'Concepto', 'Importe', 'Moneda', 'Referencia']);
  assert.equal(header[0].charCodeAt(0), 'F'.charCodeAt(0), 'quedo un U+FEFF adelante');
});

test('una coma dentro de comillas queda en un solo campo', () => {
  const rows = parseCsv(STATEMENT);
  assert.equal(rows[1][1], 'Transferencia a Insumos Patagonia SRL, FA-2026-00417');
  assert.equal(rows[1].length, 5, 'la coma partio el campo en dos');
});

test('las comillas escapadas se colapsan a una sola', () => {
  const rows = parseCsv(STATEMENT);
  assert.equal(rows[3][1], 'Compra "Libreria Sur" insumos');

  assert.deepEqual(parseCsv('a,"di ""hola"" fuerte",c')[0], ['a', 'di "hola" fuerte', 'c']);
  assert.deepEqual(parseCsv('"""",x')[0], ['"', 'x']);
});

test('las lineas vacias se saltean, pero una fila de campos vacios no', () => {
  assert.equal(parseCsv('a,b\n\n\nc,d\n').length, 2);
  assert.deepEqual(parseCsv('a,b\n,,\n')[1], ['', '', '']);
  assert.equal(parseCsv('\n\n\n').length, 0);
  assert.equal(parseCsv('').length, 0);
});

test('CRLF y LF mezclados dan el mismo resultado', () => {
  const crlf = parseCsv('a,b\r\n1,2\r\n');
  const lf = parseCsv('a,b\n1,2\n');
  const mezcla = parseCsv('a,b\r\n1,2\n');
  assert.deepEqual(crlf, lf);
  assert.deepEqual(mezcla, lf);
  assert.equal(crlf[1][1], '2', 'quedo un \\r pegado al ultimo campo');
});

test('la ultima linea sin salto final se incluye igual', () => {
  const rows = parseCsv(STATEMENT);
  assert.deepEqual(rows[6], ['2026-06-30', 'Sin salto final', '1.000,00', 'ARS', 'LAST-1']);

  assert.equal(parseCsv('a,b\n1,2').length, 2);
  assert.deepEqual(parseCsv('a,b\n1,2')[1], ['1', '2']);
});

test('un salto de linea dentro de comillas no corta la fila', () => {
  const rows = parseCsv('a,b\n"linea uno\nlinea dos",x\n');
  assert.equal(rows.length, 2);
  assert.equal(rows[1][0], 'linea uno\nlinea dos');

  const conCrlf = parseCsv('a,b\r\n"uno\r\ndos",x\r\n');
  assert.equal(conCrlf[1][0], 'uno\ndos', 'el CRLF interno tambien se normaliza');
});

test('el delimitador se puede forzar y gana sobre el olfateo', () => {
  const texto = 'a;b,c\n1;2,3\n';
  assert.deepEqual(parseCsv(texto, { delimiter: ';' })[0], ['a', 'b,c']);
  assert.deepEqual(parseCsv(texto, { delimiter: ',' })[0], ['a;b', 'c']);
});

test('los espacios alrededor de un campo entrecomillado no lo rompen', () => {
  assert.deepEqual(parseCsv('a, "b,c" ,d')[0], ['a', 'b,c', 'd']);
  assert.deepEqual(parseCsv('  hola  ,mundo')[0], ['hola', 'mundo']);
});

test('parseCsv no interpreta semantica: todo sale como string', () => {
  const rows = parseCsv(STATEMENT);
  for (const row of rows) {
    for (const cell of row) assert.equal(typeof cell, 'string');
  }
  assert.equal(rows[2][2], '(15.400,00)', 'no convierte montos');
  assert.equal(rows[1][0], '02/09/2026', 'no convierte fechas');
});

test('parseCsv valida sus argumentos', () => {
  assert.throws(() => parseCsv(null), /texto/i);
  assert.throws(() => parseCsv(123), /texto/i);
  assert.throws(() => parseCsv('a,b', { delimiter: 'xy' }), /delimitador/i);
  assert.throws(() => parseCsv('a,b', { delimiter: '"' }), /delimitador/i);
});
