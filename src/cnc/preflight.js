// Pre-flight: comparar lo que dice el papeleo contra lo que hace el programa.
//
// Todo lo de acá es determinista y sin modelo. El modelo ya hizo su trabajo —
// leer los documentos de taller y devolver hechos— y estos checks son los que
// deciden si el programa cruza a la máquina.
//
// Lo que NO hacemos, y hay que decirlo en voz alta: no simulamos el mecanizado.
// No verificamos avances contra el material, no calculamos deflexión de
// herramienta, no detectamos colisiones. Verificamos que **el papeleo y el
// programa digan lo mismo**. Es un reclamo mucho más chico y mucho más difícil
// de romper.

import { normalizeRevision, normalizeTool, normalizeMachine } from './job-schema.js';

/** Confianza de OCR por debajo de la cual un dato no alcanza para aprobar. */
export const CONFIANZA_MINIMA = 0.55;

/** Un check en la forma que ya usa el resto del proyecto. */
const check = (id, ok, expected, actual, evidence = [], extra = {}) =>
  ({ id, ok, expected, actual, evidence, ...extra });

/**
 * Compara la orden de trabajo contra el programa.
 *
 * @param {object} job Lo que el modelo extrajo de los documentos, ya anclado.
 * @param {object} program La salida de `parseGcode`.
 * @param {{grounded?: object}} [contexto] Campos anclados con su confianza.
 * @returns {object[]} checks
 */
export function preflight(job, program, contexto = {}) {
  const checks = [];
  const grounded = contexto.grounded ?? {};
  const ev = (clave) => (grounded[clave] ? [grounded[clave]] : []);

  // --- 1. Revisión. Una letra decide si el lote va al tacho. ---------------
  const revEsperada = normalizeRevision(job.revision);
  const revPrograma = normalizeRevision(
    (program.comments ?? []).find((c) => /\bREV\b/i.test(c)) ?? '',
  );
  checks.push(check(
    'revision_matches',
    revEsperada !== null && revPrograma !== null && revEsperada === revPrograma,
    revEsperada,
    revPrograma ?? 'sin revisión declarada en el programa',
    ev('revision'),
  ));

  // --- 2. Número de pieza -------------------------------------------------
  const piezaEnComentarios = (program.comments ?? [])
    .some((c) => new RegExp(`\\b${String(job.partNumber).replace(/\W/g, '')}\\b`).test(c.replace(/\W/g, ' ')));
  checks.push(check(
    'part_number_matches',
    piezaEnComentarios,
    job.partNumber,
    piezaEnComentarios ? job.partNumber : 'no aparece en los comentarios del programa',
    ev('partNumber'),
  ));

  // --- 3. Número de programa ----------------------------------------------
  // Se comparan solo los dígitos. La letra `O` y el dígito `0` son el mismo
  // glifo para un OCR, y de hecho el modelo leyó "01837" donde el papel dice
  // "O1837". Exigir el prefijo sería castigar una ambigüedad tipográfica que
  // ningún operario nota, y un falso positivo acá quema la confianza en todos
  // los demás checks.
  // Como número y no como string: "O1837" pierde la letra y queda "1837",
  // mientras que "01837" conserva el cero que el OCR puso en su lugar. Son el
  // mismo programa.
  const digitos = (v) => {
    const soloDigitos = String(v ?? '').replace(/\D+/g, '');
    return soloDigitos === '' ? null : Number(soloDigitos);
  };
  const oEsperado = digitos(job.programNumber);
  const oReal = digitos(program.programNumber);
  checks.push(check(
    'program_number_matches',
    oEsperado !== null && oEsperado === oReal,
    job.programNumber || 'no declarado',
    program.programNumber || 'el programa no declara número',
    ev('programNumber'),
  ));

  // --- 4. Herramientas. El check que evita romper el husillo. -------------
  // Cada herramienta que el programa llama tiene que estar en el carrusel. Una
  // T7 que no está monta el portaherramientas vacío contra la pieza.
  const enSetup = new Set((job.tools ?? []).map(normalizeTool).filter(Boolean));
  const llamadas = (program.tools ?? []).map(normalizeTool).filter(Boolean);
  const faltantes = llamadas.filter((t) => !enSetup.has(t));
  checks.push(check(
    'tools_in_setup',
    faltantes.length === 0,
    `todas dentro de ${[...enSetup].join(', ') || '(setup vacío)'}`,
    faltantes.length === 0 ? 'todas presentes' : `no están en el setup: ${faltantes.join(', ')}`,
    ev('tools'),
    { missingTools: faltantes },
  ));

  // --- 5. Offset de trabajo -----------------------------------------------
  // Correr con G55 cuando el cero está seteado en G54 mueve la pieza entera.
  const offsetEsperado = String(job.workOffset ?? '').toUpperCase().trim();
  const offsets = program.workOffsets ?? [];
  const offsetsAjenos = offsets.filter((g) => g.toUpperCase() !== offsetEsperado);
  checks.push(check(
    'work_offset_matches',
    offsetEsperado !== '' && offsets.length > 0 && offsetsAjenos.length === 0,
    offsetEsperado || 'no declarado',
    offsets.length === 0 ? 'el programa no fija ningún offset' : offsets.join(', '),
    ev('workOffset'),
  ));

  // --- 6 y 7. Límites físicos del setup -----------------------------------
  const rpmMax = job.maxSpindleRpm;
  if (typeof rpmMax === 'number' && Number.isFinite(rpmMax)) {
    checks.push(check(
      'spindle_within_limit',
      program.maxSpindle === null || program.maxSpindle <= rpmMax,
      `<= ${rpmMax} RPM`,
      program.maxSpindle === null ? 'el programa no fija S' : `${program.maxSpindle} RPM`,
      ev('maxSpindleRpm'),
    ));
  }
  const feedMax = job.maxFeedMmMin;
  if (typeof feedMax === 'number' && Number.isFinite(feedMax)) {
    checks.push(check(
      'feed_within_limit',
      program.maxFeed === null || program.maxFeed <= feedMax,
      `<= ${feedMax} mm/min`,
      program.maxFeed === null ? 'el programa no fija F' : `${program.maxFeed} mm/min`,
      ev('maxFeedMmMin'),
    ));
  }

  // --- 8. Máquina ---------------------------------------------------------
  const maquinaJob = normalizeMachine(job.machine);
  const maquinaPrograma = (program.comments ?? [])
    .map(normalizeMachine)
    .some((c) => maquinaJob !== '' && c.includes(maquinaJob));
  checks.push(check(
    'machine_matches',
    maquinaPrograma,
    job.machine,
    maquinaPrograma ? job.machine : 'el programa no nombra esta máquina',
    ev('machine'),
  ));

  // --- 9. Fin de programa declarado ---------------------------------------
  // Sin M30 ni M99 el control puede seguir leyendo memoria vieja después del
  // último bloque. Es barato de chequear y caro de descubrir en la máquina.
  const mCodes = (program.mCodes ?? []).map((m) => m.toUpperCase());
  checks.push(check(
    'program_has_end',
    mCodes.includes('M30') || mCodes.includes('M99'),
    'M30 o M99',
    mCodes.length === 0 ? 'sin códigos M' : mCodes.join(', '),
  ));

  // --- 10. Anomalías léxicas que sí importan ------------------------------
  //
  // No todo warning del parser es un problema. `G91 G28 Z0.` es el retorno a
  // home con el que termina LITERALMENTE todo programa de taller: marcarlo como
  // anomalía bloqueante hace que la herramienta frene el 100% de los programas
  // buenos, y una herramienta que siempre dice que no es una que se apaga.
  //
  // Bloquean solo las anomalías que indican que el archivo está mal formado, no
  // las que indican que el análisis tiene un límite.
  const warnings = program.warnings ?? [];
  const BLOQUEANTES = [/sin cerrar/i, /sin n[uú]mero/i, /sin ning[uú]n movimiento/i];
  const graves = warnings.filter((w) => BLOQUEANTES.some((re) => re.test(w)));

  checks.push(check(
    'gcode_parses_clean',
    graves.length === 0,
    'sin anomalías que impidan leer el programa',
    graves.length === 0 ? 'legible' : graves.join(' · '),
    [],
    { warnings, graves },
  ));

  return checks;
}

/**
 * Campos leídos con confianza demasiado baja para aprobar sobre ellos.
 *
 * Esto no es paranoia: medido con el OCR real sobre un documento con ruido,
 * `4.0.0` se leyó como `4.0,8` con confianza 0.32, y `Rev B` contra `Rev C` es
 * un solo carácter. Un dato mal leído con confianza alta es un problema
 * distinto; uno mal leído con confianza baja es un problema que el sistema
 * puede ver venir, y entonces tiene que verlo.
 *
 * @param {object} grounded Campos anclados, cada uno con `confidence`.
 * @param {number} [minimo]
 * @returns {{key: string, confidence: number, value: unknown}[]}
 */
export function lowConfidenceFields(grounded, minimo = CONFIANZA_MINIMA) {
  return Object.entries(grounded ?? {})
    .filter(([, campo]) => typeof campo?.confidence === 'number' && campo.confidence < minimo)
    .map(([key, campo]) => ({ key, confidence: campo.confidence, value: campo.value }))
    .sort((a, b) => a.confidence - b.confidence);
}

/**
 * Los campos sin los cuales no se puede aprobar nada, aunque todo lo demás dé
 * bien. Un check que no pudo correr no es un check que pasó.
 */
export const CAMPOS_CRITICOS = ['revision', 'partNumber', 'tools', 'workOffset'];
