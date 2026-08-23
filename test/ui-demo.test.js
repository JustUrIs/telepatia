// La demo tiene que poder probarse sin saber qué archivo va en cada campo.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { DEMOS, esProgramaDeMaquina } from '../src/ui/sender.js';
import { validateApproval } from '../src/cnc/approval.js';
import { explicarErrorCamara } from '../src/ui/receiver.js';

const rutaRepo = (desdeUi) => desdeUi.replace(/^\.\.\/\.\.\//, '');
const bytesComoEnDemo = (ruta) => Buffer.from(
  readFileSync(ruta, 'utf8').replace(/\r\n/g, '\n'),
  'utf8',
);

test('el botón aprobado carga una pareja real que habilita Emitir', () => {
  const demo = DEMOS.aprobado;
  const informe = JSON.parse(readFileSync(rutaRepo(demo.informe), 'utf8'));
  const resultado = validateApproval(informe, bytesComoEnDemo(rutaRepo(demo.programa)));
  assert.equal(resultado.ok, true, resultado.reason);
});

test('el botón bloqueado carga una pareja real que no puede emitirse', () => {
  const demo = DEMOS.bloqueado;
  const informe = JSON.parse(readFileSync(rutaRepo(demo.informe), 'utf8'));
  const resultado = validateApproval(informe, bytesComoEnDemo(rutaRepo(demo.programa)));
  assert.equal(resultado.ok, false);
  assert.equal(resultado.resumen.veredicto, 'block');
  assert.ok(resultado.resumen.motivos.length > 0);
});

test('una foto no se presenta como programa de máquina', () => {
  for (const nombre of ['foto.jpg', 'informe.json', 'captura.png', 'texto.pdf']) {
    assert.equal(esProgramaDeMaquina(nombre), false, nombre);
  }
  for (const nombre of ['pieza.nc', 'PIEZA.GCODE', 'pieza.tap', 'pieza.cnc']) {
    assert.equal(esProgramaDeMaquina(nombre), true, nombre);
  }
});

test('los errores habituales de cámara dicen qué hacer', () => {
  const entornoSeguro = {
    isSecureContext: true,
    navigator: { mediaDevices: { getUserMedia() {} } },
    location: { hostname: 'localhost', port: '8777', pathname: '/src/ui/receiver.html' },
  };
  assert.match(explicarErrorCamara({ name: 'NotAllowedError' }, entornoSeguro).detail, /permití Cámara/i);
  assert.match(explicarErrorCamara({ name: 'NotReadableError' }, entornoSeguro).detail, /Zoom|Meet/i);
});
