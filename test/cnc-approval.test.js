// El permiso de emisión: que el archivo que se manda sea el que se aprobó.
//
// Sin esto el flujo tiene un agujero de uso: el pre-flight aprueba un programa
// y el emisor deja elegir cualquier otro. Todos los casos de aceptación del
// brief están acá, incluidos los de entrada corrupta — que tienen que fallar
// cerrado y sin excepción visible.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { validateApproval, sourceHash, hashCorto } from '../src/cnc/approval.js';

const bytesC = readFileSync('fixtures/programs/part-1837-revC.nc');
const bytesB = readFileSync('fixtures/programs/part-1837-revB.nc');
const informeC = JSON.parse(readFileSync('fixtures/programs/part-1837-revC.preflight.json', 'utf8'));
const informeB = JSON.parse(readFileSync('fixtures/programs/part-1837-revB.preflight.json', 'utf8'));

test('el informe aprobado habilita SU archivo', () => {
  const r = validateApproval(informeC, bytesC);
  assert.equal(r.ok, true, r.reason);
  assert.equal(r.resumen.esperado, r.resumen.real);
  assert.equal(r.resumen.revision, 'C');
});

test('un informe BLOQUEADO no habilita nada', () => {
  const r = validateApproval(informeB, bytesB);
  assert.equal(r.ok, false);
  assert.match(r.reason, /bloque/i);
  // Y el motivo concreto viaja, para que la UI no tenga que adivinar.
  assert.ok(r.resumen.motivos.length > 0);
});

test('un informe aprobado NO habilita otro archivo', () => {
  // El caso que este control existe para cerrar: aprobar uno y mandar otro.
  const r = validateApproval(informeC, bytesB);
  assert.equal(r.ok, false);
  assert.match(r.reason, /no es el archivo que fue aprobado/i);
  assert.notEqual(r.resumen.esperado, r.resumen.real);
});

test('cambiar UN byte después del pre-flight invalida el permiso', () => {
  const tocado = Buffer.from(bytesC);
  tocado[tocado.length - 20] ^= 0x01;

  const r = validateApproval(informeC, tocado);
  assert.equal(r.ok, false);
  assert.match(r.reason, /su contenido cambi/i);
});

test('un espacio al final de una linea tambien invalida', () => {
  // A diferencia de programHash, que normaliza para conservar identidad
  // semantica, este hash es byte a byte: es lo que se va a transmitir.
  const conEspacio = Buffer.concat([bytesC, Buffer.from(' ')]);
  assert.equal(validateApproval(informeC, conEspacio).ok, false);
});

test('un informe en REVISION tampoco habilita', () => {
  const enRevision = { ...informeC, veredicto: 'review', motivos: ['un dato sin anclar'] };
  const r = validateApproval(enRevision, bytesC);
  assert.equal(r.ok, false);
  assert.match(r.reason, /revise|revisi/i);
});

test('entrada corrupta falla cerrado y sin lanzar', () => {
  const basura = [
    null, undefined, 42, 'texto', [], {},
    { veredicto: 'approve' },
    { veredicto: 'approve', contexto: {} },
    { veredicto: 'approve', contexto: { sourceSha256: 'corto' } },
    { veredicto: 'approve', contexto: { sourceSha256: 'ZZ'.repeat(32) } },
    { veredicto: 'aprobado', contexto: { sourceSha256: 'a'.repeat(64) } },
    { ...informeC, veredicto: null },
    { ...informeC, contexto: null },
  ];
  for (const informe of basura) {
    let r;
    assert.doesNotThrow(() => { r = validateApproval(informe, bytesC); },
      `lanzo con ${JSON.stringify(informe)?.slice(0, 40)}`);
    assert.equal(r.ok, false, `dejo pasar ${JSON.stringify(informe)?.slice(0, 40)}`);
    assert.ok(r.reason.length > 0);
  }
});

test('sin archivo no hay permiso, aunque el informe sea perfecto', () => {
  for (const vacio of [new Uint8Array(0), null, undefined, 'no soy bytes']) {
    const r = validateApproval(informeC, vacio);
    assert.equal(r.ok, false);
    assert.match(r.reason, /archivo/i);
  }
});

test('sourceHash es el SHA-256 de los bytes crudos', () => {
  const esperado = informeC.contexto.sourceSha256;
  assert.equal(sourceHash(bytesC), esperado);
  assert.equal(sourceHash(bytesC.toString('utf8')), esperado, 'string y bytes dan lo mismo');
  assert.match(sourceHash(Buffer.from('x')), /^[0-9a-f]{64}$/);
});

test('el informe trae las dos identidades y son cosas distintas', () => {
  // `hash` normaliza finales de linea para reconocer el mismo programa venga de
  // donde venga. `sourceSha256` es byte a byte, que es lo que se transmite.
  assert.match(informeC.contexto.hash, /^[0-9a-f]{64}$/);
  assert.match(informeC.contexto.sourceSha256, /^[0-9a-f]{64}$/);
  assert.ok('sourceSha256' in informeC.contexto, 'el emisor necesita este campo');
});

test('hashCorto no revienta con entradas raras', () => {
  assert.equal(hashCorto('a'.repeat(64)), 'aaaaaaaa…aaaaaaaa');
  for (const v of [null, undefined, '', 'corto', 123]) assert.equal(hashCorto(v), '—');
});

// ---------------------------------------------------------------------------
// El receptor tiene que saber que un informe de CNC no es un dictamen de
// factura. Si los confunde, en un demo de CNC aparece la palabra "factura".
// ---------------------------------------------------------------------------

const { isPreflightReport, renderPreflight } = await import('../src/ui/receiver.js');

test('un informe de pre-flight se reconoce, y un dictamen de factura no', () => {
  assert.equal(isPreflightReport(informeC), true);
  assert.equal(isPreflightReport(informeB), true);

  const factura = JSON.parse(readFileSync('fixtures/verdict-pass.json', 'utf8'));
  assert.equal(isPreflightReport(factura), false, 'confundio una factura con un pre-flight');

  for (const v of [null, undefined, {}, [], 'texto', { veredicto: 'nope', checks: [] }]) {
    assert.equal(isPreflightReport(v), false);
  }
});

test('renderPreflight habla de CNC, nunca de facturas', () => {
  const vista = renderPreflight(informeB);

  assert.equal(vista.verdict, 'block');
  assert.equal(vista.tone, 'error');
  assert.equal(vista.rows.length, informeB.checks.length);
  assert.ok(vista.failedCount > 0);

  const texto = JSON.stringify(vista).toLowerCase();
  for (const prohibida of ['factura', 'invoice', 'iva', 'proveedor', 'bancar']) {
    assert.ok(!texto.includes(prohibida), `la vista de CNC dice "${prohibida}"`);
  }

  // Y las etiquetas son legibles, no ids crudos.
  for (const fila of vista.rows) {
    assert.ok(fila.label.length > 0);
    assert.notEqual(fila.label, fila.id, `${fila.id} muestra el id crudo`);
  }
});

test('renderPreflight rechaza lo que no es un informe', () => {
  for (const v of [null, {}, { veredicto: 'approve' }]) {
    assert.throws(() => renderPreflight(v), /pre-flight/i);
  }
});
