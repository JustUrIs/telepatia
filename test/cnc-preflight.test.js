// Los checks de pre-flight, incluidos los dos falsos positivos que aparecieron
// recien al correr la herramienta de punta a punta.
//
// Un falso positivo en una herramienta de taller no es un bug menor: si frena
// programas buenos, el operario la apaga y vuelve al pendrive.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

import { parseGcode, extractRevision } from '../src/cnc/gcode.js';
import { validateJob, normalizeJob, normalizeTool } from '../src/cnc/job-schema.js';
import { preflight, lowConfidenceFields, CAMPOS_CRITICOS } from '../src/cnc/preflight.js';

const JOB = normalizeJob(JSON.parse(readFileSync('fixtures/shop/job-extracted.json', 'utf8')));
const REV_C = parseGcode(readFileSync('fixtures/programs/part-1837-revC.nc', 'utf8'));
const REV_B = parseGcode(readFileSync('fixtures/programs/part-1837-revB.nc', 'utf8'));

const porId = (checks) => new Map(checks.map((c) => [c.id, c]));
const fallados = (checks) => checks.filter((c) => !c.ok).map((c) => c.id).sort();

test('el programa correcto no dispara NINGUN check', () => {
  const checks = preflight(JOB, REV_C);
  assert.deepEqual(fallados(checks), [],
    'un falso positivo hace que el operario apague la herramienta');
});

test('el programa incorrecto dispara exactamente los cinco motivos reales', () => {
  assert.deepEqual(fallados(preflight(JOB, REV_B)), [
    'feed_within_limit',
    'revision_matches',
    'spindle_within_limit',
    'tools_in_setup',
    'work_offset_matches',
  ]);
});

test('la revision se compara letra a letra: B no es C', () => {
  const c = porId(preflight(JOB, REV_B)).get('revision_matches');
  assert.equal(c.ok, false);
  assert.equal(c.expected, 'C');
  assert.equal(c.actual, 'B');
  assert.equal(extractRevision(REV_C), 'C');
  assert.equal(extractRevision(REV_B), 'B');
});

test('una herramienta fuera del carrusel se nombra, no solo se cuenta', () => {
  const c = porId(preflight(JOB, REV_B)).get('tools_in_setup');
  assert.equal(c.ok, false);
  assert.deepEqual(c.missingTools, ['T7']);
  assert.match(c.actual, /T7/);
});

test('REGRESION: "O1837" y "01837" son el mismo programa', () => {
  // La letra O y el digito 0 son el mismo glifo para un OCR, y el modelo leyo
  // "01837" donde el papel dice "O1837". Castigar esa ambiguedad frenaba el
  // programa bueno y con el la confianza en todos los demas checks.
  const conCero = { ...JOB, programNumber: '01837' };
  assert.equal(porId(preflight(conCero, REV_C)).get('program_number_matches').ok, true);

  const conLetra = { ...JOB, programNumber: 'O1837' };
  assert.equal(porId(preflight(conLetra, REV_C)).get('program_number_matches').ok, true);

  // Pero un numero realmente distinto SI tiene que fallar.
  const otro = { ...JOB, programNumber: 'O2000' };
  assert.equal(porId(preflight(otro, REV_C)).get('program_number_matches').ok, false);
});

test('REGRESION: G91 G28 no puede bloquear un programa bueno', () => {
  // Es el retorno a home con el que termina literalmente todo programa de
  // taller. El parser lo reporta porque el envelope deja de ser confiable, y
  // eso es informacion, no una anomalia.
  assert.ok(REV_C.warnings.some((w) => /G91/i.test(w)), 'el fixture tiene que usar G91');
  const c = porId(preflight(JOB, REV_C)).get('gcode_parses_clean');
  assert.equal(c.ok, true, 'un retorno a home no puede frenar el programa');
  assert.ok(c.warnings.length > 0, 'pero el warning tiene que seguir reportandose');
});

test('una anomalia que impide LEER el programa si bloquea', () => {
  const roto = parseGcode('O1 (PART 1837 REV C\nT M6\nM30');
  const c = porId(preflight(JOB, roto)).get('gcode_parses_clean');
  assert.equal(c.ok, false);
  assert.ok(c.graves.length > 0);
});

test('los limites fisicos se comparan contra el setup, no contra el aire', () => {
  const checks = porId(preflight(JOB, REV_B));
  assert.match(checks.get('spindle_within_limit').actual, /11500/);
  assert.match(checks.get('feed_within_limit').actual, /2800/);

  // Sin limite declarado no se inventa un check: no tenerlo es distinto de
  // que pase.
  const sinLimites = { ...JOB, maxSpindleRpm: undefined, maxFeedMmMin: undefined };
  const ids = preflight(sinLimites, REV_B).map((c) => c.id);
  assert.ok(!ids.includes('spindle_within_limit'));
  assert.ok(!ids.includes('feed_within_limit'));
});

test('un offset ajeno al del setup se detecta aunque el correcto tambien este', () => {
  // REV_B usa G54 Y G55. Que el bueno este presente no vuelve inofensivo al otro.
  assert.deepEqual(REV_B.workOffsets, ['G54', 'G55']);
  assert.equal(porId(preflight(JOB, REV_B)).get('work_offset_matches').ok, false);
});

test('la compuerta de confianza ordena por gravedad y respeta el umbral', () => {
  const grounded = {
    revision: { value: 'C', confidence: 0.31 },
    material: { value: 'Al 6061', confidence: 0.52 },
    machine: { value: 'VF-2', confidence: 0.95 },
  };
  const flojos = lowConfidenceFields(grounded);
  assert.deepEqual(flojos.map((f) => f.key), ['revision', 'material']);
  assert.ok(CAMPOS_CRITICOS.includes('revision'));
  assert.ok(!CAMPOS_CRITICOS.includes('material'));
});

test('el esquema rechaza una clave de veredicto, venga como venga', () => {
  for (const clave of ['approved', 'Approved', 'RECOMMENDATION', 'authorized']) {
    const v = validateJob({ ...JOB, [clave]: true });
    assert.equal(v.ok, false, `dejo pasar ${clave}`);
    assert.ok(v.errors.some((e) => /veredicto|no decide/i.test(e)));
  }
});

test('normalizeJob reduce la respuesta del modelo a identificadores', () => {
  const crudo = { tools: ['T1: 12 mm end mill', 'T 02  drill', 'sin herramienta'] };
  assert.deepEqual(normalizeJob(crudo).tools, ['T1', 'T2']);
  assert.equal(normalizeTool('T7 M6'), 'T7');
  assert.equal(normalizeTool('nada'), null);
});

test('preflight no lanza con entradas incompletas', () => {
  for (const job of [{}, { tools: null }, { revision: null }]) {
    assert.doesNotThrow(() => preflight(job, REV_C));
  }
  assert.doesNotThrow(() => preflight(JOB, parseGcode('')));
});
