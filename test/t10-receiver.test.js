import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { FAILURE_CODES, isVerdict, runPaths, docIdHex } from '../src/shared/contract.js';
import { renderVerdict, renderFailure, downloadName } from '../src/ui/receiver.js';

const fixture = (estado) =>
  JSON.parse(readFileSync(`fixtures/verdict-${estado}.json`, 'utf8'));

const PASS = fixture('pass');
const FAIL = fixture('fail');
const REVIEW = fixture('review');

test('ASERCION GOLDEN: los tres fixtures pasan isVerdict', () => {
  // Si el Bloque B cambia la forma del Verdict, se rompe aca y no el domingo.
  for (const [nombre, v] of [['pass', PASS], ['fail', FAIL], ['review', REVIEW]]) {
    assert.ok(isVerdict(v), `fixtures/verdict-${nombre}.json ya no pasa isVerdict`);
  }
});

test('importar receiver.js no toca el DOM', () => {
  assert.equal(typeof globalThis.document, 'undefined');
  assert.equal(typeof renderVerdict, 'function');
  assert.equal(typeof renderFailure, 'function');
});

test('renderVerdict produce una fila por check, con su evidencia', () => {
  for (const v of [PASS, FAIL, REVIEW]) {
    const vista = renderVerdict(v);
    assert.equal(vista.rows.length, v.checks.length);

    vista.rows.forEach((fila, i) => {
      const check = v.checks[i];
      assert.equal(fila.id, check.id);
      assert.equal(fila.ok, check.ok);
      assert.equal(fila.evidence.length, check.evidence.length);
      assert.ok(fila.label.length > 0, `el check ${check.id} no tiene etiqueta legible`);
      assert.notEqual(fila.label, fila.id, `el check ${check.id} muestra el id crudo`);
    });
  }
});

test('la evidencia conserva valor, bbox y confianza', () => {
  const [fila] = renderVerdict(PASS).rows;
  const [ev] = fila.evidence;
  const original = PASS.checks[0].evidence[0];

  assert.equal(ev.value, original.value);
  assert.deepEqual(ev.bbox, original.bbox);
  assert.equal(ev.confidence, original.confidence);
  assert.match(ev.confidenceLabel, /%/, 'la confianza tiene que ser legible');
});

test('los tres estados dan titulo y tono distintos', () => {
  const vistas = [renderVerdict(PASS), renderVerdict(FAIL), renderVerdict(REVIEW)];

  const titulos = vistas.map((v) => v.title);
  const tonos = vistas.map((v) => v.tone);
  assert.equal(new Set(titulos).size, 3, `titulos repetidos: ${titulos.join(' | ')}`);
  assert.equal(new Set(tonos).size, 3, `tonos repetidos: ${tonos.join(' | ')}`);
  for (const titulo of titulos) assert.ok(titulo.trim().length > 0);

  assert.equal(vistas[0].verdict, 'pass');
  assert.equal(vistas[1].verdict, 'fail');
  assert.equal(vistas[2].verdict, 'review');
});

test('el check que falla queda marcado y contado, no escondido entre los demas', () => {
  const vista = renderVerdict(FAIL);
  const fallados = vista.rows.filter((f) => !f.ok);

  assert.equal(fallados.length, 1);
  assert.equal(fallados[0].id, 'subtotal_plus_tax_equals_total');
  assert.equal(fallados[0].tone, 'error');
  assert.equal(vista.failedCount, 1);
  assert.ok(vista.rows.every((f) => (f.ok ? f.tone === 'ok' : f.tone === 'error')));
});

test('los campos sin anclar se marcan visualmente y se cuentan', () => {
  const vista = renderVerdict(REVIEW);
  assert.equal(vista.ungroundedCount, 1);
  assert.equal(vista.ungrounded.length, 1);

  const [suelto] = vista.ungrounded;
  assert.equal(suelto.key, 'supplierTaxId');
  assert.equal(suelto.tone, 'warn');
  assert.ok(suelto.reason.length > 0);
  assert.ok(suelto.label.length > 0);

  assert.equal(renderVerdict(PASS).ungroundedCount, 0);
  assert.equal(renderVerdict(PASS).ungrounded.length, 0);
});

test('el estado del match del extracto se refleja en la vista', () => {
  assert.equal(renderVerdict(PASS).matched, PASS.matched);
  assert.ok(renderVerdict(PASS).matchLabel.length > 0);
  assert.equal(renderVerdict(REVIEW).matched, null);
  assert.match(renderVerdict(REVIEW).matchLabel, /sin|no/i);
});

test('renderVerdict rechaza algo que no es un Verdict', () => {
  assert.throws(() => renderVerdict(null), /verdict/i);
  assert.throws(() => renderVerdict({ verdict: 'quiza', checks: [], ungrounded: [] }), /verdict/i);
  assert.throws(() => renderVerdict({ ...PASS, checks: 'no' }), /verdict/i);
});

test('renderFailure de tres codigos da tres mensajes distintos y no vacios', () => {
  const codigos = [
    FAILURE_CODES.digestMismatch,
    FAILURE_CODES.ungroundedFields,
    FAILURE_CODES.unsupportedVersion,
  ];
  const vistas = codigos.map((code) => renderFailure({ stage: 'assemble', code, message: '' }));

  const titulos = vistas.map((v) => v.title);
  const cuerpos = vistas.map((v) => v.detail);
  assert.equal(new Set(titulos).size, 3, `titulos repetidos: ${titulos.join(' | ')}`);
  assert.equal(new Set(cuerpos).size, 3);
  for (const vista of vistas) {
    assert.ok(vista.title.trim().length > 0);
    assert.ok(vista.detail.trim().length > 0);
    assert.equal(vista.tone, 'error');
  }
});

test('renderFailure cubre todos los codigos del contrato', () => {
  for (const code of Object.values(FAILURE_CODES)) {
    const vista = renderFailure({ stage: 'scan', code, message: 'x' });
    assert.ok(vista.title.trim().length > 0, `sin titulo para ${code}`);
    assert.ok(vista.detail.trim().length > 0, `sin detalle para ${code}`);
    assert.equal(vista.known, true, `${code} deberia estar en la tabla`);
  }
});

test('un code inexistente no devuelve nada del prototipo', () => {
  // Indexar crudo un objeto literal con 'toString' devuelve una funcion, y la
  // UI terminaria renderizando "function toString() { [native code] }".
  for (const code of ['toString', 'constructor', '__proto__', 'hasOwnProperty', 'nope']) {
    const vista = renderFailure({ stage: 'scan', code, message: 'algo raro paso' });
    assert.equal(typeof vista.title, 'string');
    assert.equal(typeof vista.detail, 'string');
    assert.equal(vista.known, false, `${code} no deberia estar en la tabla`);
    assert.ok(vista.title.trim().length > 0);
    assert.ok(vista.detail.includes('algo raro paso'), 'se pierde el mensaje original');
  }
});

test('renderFailure conserva stage, code y el mensaje crudo', () => {
  const fallo = { stage: 'assemble', code: FAILURE_CODES.digestMismatch, message: 'faltan 3 frames' };
  const vista = renderFailure(fallo);
  assert.equal(vista.stage, 'assemble');
  assert.equal(vista.code, FAILURE_CODES.digestMismatch);
  assert.ok(vista.detail.includes('faltan 3 frames'));
});

test('renderFailure tolera un failure incompleto sin romper la UI', () => {
  for (const entrada of [null, undefined, {}, { code: null }, 'texto suelto']) {
    const vista = renderFailure(entrada);
    assert.equal(typeof vista.title, 'string');
    assert.ok(vista.title.trim().length > 0);
    assert.equal(vista.tone, 'error');
  }
});

test('downloadName usa el basename de la ruta del Bloque B', () => {
  const docId = 0xfa86fd28;
  assert.equal(downloadName(docId), 'document.bin');
  assert.ok(runPaths(docId).document.endsWith(downloadName(docId)));
  assert.ok(runPaths(docId).document.includes(docIdHex(docId)));

  assert.equal(downloadName(docId, 'factura.json'), 'factura.json');
  // Un nombre del manifest no puede escaparse a otra carpeta.
  assert.equal(downloadName(docId, '../../etc/passwd'), 'passwd');
  assert.equal(downloadName(docId, 'C:\\temp\\x.bin'), 'x.bin');
  assert.equal(downloadName(docId, ''), 'document.bin');
});
