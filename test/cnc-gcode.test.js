import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { extractRevision, parseGcode, programHash } from '../src/cnc/gcode.js';

test('parsea herramientas, offsets, límites y comentarios del ejemplo', () => {
  const programa = parseGcode(`%
O1837 (PART 1837 REV C)
N10 G17 G21 G90 G54
N20 T1 M6 (12MM END MILL)
N30 S8000 M3
N40 G0 X-12.7 Y0. Z25.
N50 G1 Z-2.5 F250.
N60 X50.8 F1200.
; cambio de herramienta
N70 T7 M6
N80 G55
N90 M30
%`);

  assert.deepEqual(programa, {
    tools: ['T1', 'T7'],
    workOffsets: ['G54', 'G55'],
    mCodes: ['M6', 'M3', 'M30'],
    envelope: {
      x: { min: -12.7, max: 50.8 },
      y: { min: 0, max: 0 },
      z: { min: -2.5, max: 25 },
    },
    maxFeed: 1200,
    maxSpindle: 8000,
    programNumber: 'O1837',
    comments: ['PART 1837 REV C', '12MM END MILL', 'cambio de herramienta'],
    lineCount: 11,
    warnings: [],
  });
  assert.equal(extractRevision(programa), 'C');
});

test('un T7 dentro de un comentario NO es una llamada a herramienta', () => {
  const programa = parseGcode('O10\nT1 M6 (cambiar a T7 manualmente)\n; tampoco T9\nM30');
  assert.deepEqual(programa.tools, ['T1']);
  assert.deepEqual(programa.comments, ['cambiar a T7 manualmente', 'tampoco T9']);
});

test('G0X10Y20 sin espacios parsea igual que G0 X10 Y20', () => {
  const compacto = parseGcode('O1\nG0X10Y20\nM30');
  const separado = parseGcode('O 1\nG 0 X 10 Y 20\nM 30');
  assert.deepEqual(compacto, separado);
});

test('un parentesis sin cerrar no cuelga el parser y deja warning', () => {
  const programa = parseGcode('T2 M6 (fresa T7 sin cierre\nG0 X.5\nM30');
  assert.deepEqual(programa.tools, ['T2']);
  assert.deepEqual(programa.comments, ['fresa T7 sin cierre']);
  assert.ok(programa.warnings.some((warning) => /paréntesis sin cerrar/i.test(warning)));
});

test('normaliza mayúsculas, códigos con ceros y números con signo', () => {
  const programa = parseGcode('o0042\nt007 m06\ng054 g00 x-.5 y+2. z0\nf250.5 s12000\nm030');
  assert.deepEqual(programa.tools, ['T7']);
  assert.deepEqual(programa.workOffsets, ['G54']);
  assert.deepEqual(programa.mCodes, ['M6', 'M30']);
  assert.equal(programa.programNumber, 'O0042');
  assert.deepEqual(programa.envelope, {
    x: { min: -0.5, max: -0.5 },
    y: { min: 2, max: 2 },
    z: { min: 0, max: 0 },
  });
  assert.equal(programa.maxFeed, 250.5);
  assert.equal(programa.maxSpindle, 12000);
});

test('avisa límites que requieren simulación o un programa completo', () => {
  const incremental = parseGcode('G91\nG1 X2\nM30');
  assert.ok(incremental.warnings.some((warning) => /G91.*incremental.*no es confiable/i.test(warning)));

  const sinMovimiento = parseGcode('X10 Y-2\nM99');
  assert.ok(sinMovimiento.warnings.some((warning) => /eje X.*ningún movimiento/i.test(warning)));
  assert.ok(sinMovimiento.warnings.some((warning) => /eje Y.*ningún movimiento/i.test(warning)));

  const sinFin = parseGcode('G0 X0');
  assert.ok(sinFin.warnings.some((warning) => /falta M30 o M99/i.test(warning)));
});

test('T sin número deja warning y no inventa una herramienta', () => {
  const programa = parseGcode('T\nG0 X0\nM30');
  assert.deepEqual(programa.tools, []);
  assert.ok(programa.warnings.some((warning) => /T sin número/i.test(warning)));
});

test('un archivo vacío o de comentarios conserva una estructura válida', () => {
  const programa = parseGcode('  \n(comentario)\n; otro comentario\n');
  assert.deepEqual(programa.tools, []);
  assert.deepEqual(programa.workOffsets, []);
  assert.deepEqual(programa.mCodes, []);
  assert.deepEqual(programa.envelope, {
    x: { min: null, max: null },
    y: { min: null, max: null },
    z: { min: null, max: null },
  });
  assert.deepEqual(programa.comments, ['comentario', 'otro comentario']);
  assert.equal(programa.lineCount, 2);
});

test('extractRevision reconoce variantes declarativas y no adivina', () => {
  assert.equal(extractRevision({ comments: ['PIEZA 9', 'Revisión: b2'] }), 'B2');
  assert.equal(extractRevision({ comments: ['revisar antes de montar'] }), null);
  assert.equal(extractRevision(null), null);
});

test('programHash normaliza CRLF y espacios al final, pero no el contenido', () => {
  const limpio = 'G0 X1\nM30\n';
  const conRuido = 'G0 X1  \r\nM30\t\r\n';
  assert.equal(programHash(conRuido), programHash(limpio));
  assert.notEqual(programHash('G0 X2\nM30\n'), programHash(limpio));
  assert.equal(
    programHash(limpio),
    createHash('sha256').update(limpio, 'utf8').digest('hex'),
  );
});

test('un programa realista de taller conserva el orden de primera aparición', () => {
  const programa = parseGcode(`%
O7712 (BRACKET 7712 REV D)
(MAQUINA VF2)
N10 G17 G21 G40 G49 G80 G90
N20 G54
N30 T3 M6 (FRESA PLANA 10MM)
N40 S6500 M3
N50 G0 G43 H3 Z50.
N60 X-5. Y-5.
N70 Z5.
N80 M8
N90 G1 Z-3. F180.
N100 X45. F900.
N110 Y25.
N120 X-5.
N130 Y-5.
N140 G0 Z50.
N150 M9
N160 T8 M6 (BROCA 6MM)
N170 S4200 M3
N180 G55
N190 G0 X10. Y10.
N200 Z8.
N210 G1 Z-12. F120.
N220 G0 Z8.
N230 X30.
N240 G1 Z-12.
N250 G0 Z50.
N260 M5
N270 T3 M6
N280 G54
N290 S6500 M3
N300 M8
N310 G0 X0 Y0
N320 Z5.
N330 G1 Z-1. F300.
N340 X40. F1100.
N350 G0 Z50.
N360 M9
N370 M5
N380 M30
%`);

  assert.deepEqual(programa.tools, ['T3', 'T8']);
  assert.deepEqual(programa.workOffsets, ['G54', 'G55']);
  assert.deepEqual(programa.mCodes, ['M6', 'M3', 'M8', 'M9', 'M5', 'M30']);
  assert.equal(programa.maxFeed, 1100);
  assert.equal(programa.maxSpindle, 6500);
  assert.equal(programa.programNumber, 'O7712');
  assert.equal(programa.lineCount, 40);
  assert.deepEqual(programa.warnings, []);
});
