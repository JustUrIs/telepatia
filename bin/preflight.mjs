#!/usr/bin/env node
// telepatía · pre-flight de un programa de CNC.
//
// Lee lo que el operario tiene abierto antes de apretar Cycle Start y le dice
// en cinco segundos si el papeleo y el programa dicen lo mismo.
//
//   node bin/preflight.mjs <programa.nc> [opciones]
//
//   --order <img>    orden de trabajo   (default: fixtures/shop/work-order.png)
//   --setup <img>    setup sheet        (default: fixtures/shop/setup-sheet.png)
//   --job <json>     saltea el modelo y usa una extracción ya hecha
//   --preset <n>     standard | lowMemory
//   --json           salida en JSON, sin el informe
//
// LA DIVISIÓN DE TRABAJO, que es la decisión de diseño del producto:
//
//   documentos de taller (PDF, foto, escaneo)  ->  MODELO LOCAL
//   programa .nc (lenguaje regular)            ->  CÓDIGO DETERMINISTA
//   veredicto                                  ->  CÓDIGO, comparando los dos
//
// El modelo nunca decide. Lee y le explica a la persona que decide.
//
// Y corre en la laptop del técnico, no en el CNC: un control de 2003 no puede
// correr un modelo de 4B, y nadie quiere un modelo de lenguaje adentro de la
// base de cómputo confiable de una máquina que mueve acero.

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { dirname } from 'node:path';

import { parseGcode, extractRevision, programHash } from '../src/cnc/gcode.js';
import { JOB_SCHEMA, validateJob, normalizeJob } from '../src/cnc/job-schema.js';
import { CNC_FIELD_RULES } from '../src/cnc/ground-rules.js';
import { groundFields } from '../src/audit/ground.js';
import { preflight, lowConfidenceFields, CONFIANZA_MINIMA, CAMPOS_CRITICOS } from '../src/cnc/preflight.js';
import { sourceHash } from '../src/cnc/approval.js';

function parseArgs(argv) {
  const posicionales = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (!a.startsWith('--')) { posicionales.push(a); continue; }
    const clave = a.slice(2);
    const sig = argv[i + 1];
    if (sig === undefined || sig.startsWith('--')) flags[clave] = true;
    else { flags[clave] = sig; i++; }
  }
  return { posicionales, flags };
}

const raiz = (clave) => String(clave).split('.')[0];

/**
 * Lee los documentos de taller con el modelo local, o los saltea.
 *
 * El modelo es OPCIONAL a propósito. Sin él la herramienta sigue verificando el
 * programa y transfiriéndolo con su hash verificado; lo que se pierde es la lectura
 * del papeleo, no la seguridad.
 */
async function leerDocumentos(flags) {
  if (flags.job) {
    const job = JSON.parse(readFileSync(flags.job, 'utf8'));
    return { job, bloques: [], motor: `extracción precargada (${flags.job})`, msModelo: 0 };
  }

  const orden = flags.order ?? 'fixtures/shop/work-order.png';
  const setup = flags.setup ?? 'fixtures/shop/setup-sheet.png';

  const { QvacBackend } = await import('../src/audit/qvac-backend.js');
  const backend = new QvacBackend({ preset: flags.preset ?? 'standard' });

  const t0 = Date.now();
  await backend.init();
  const bloques = [];
  for (const ruta of [orden, setup]) bloques.push(...await backend.ocr(ruta));
  const job = await backend.extract(bloques, JOB_SCHEMA);
  const msModelo = Date.now() - t0;

  await backend.dispose();
  return { job, bloques, motor: `QVAC ${flags.preset ?? 'standard'} · ${orden} + ${setup}`, msModelo };
}

const ETIQUETAS = {
  revision_matches: 'La revisión del programa es la que pide la orden',
  part_number_matches: 'El programa es de esta pieza',
  program_number_matches: 'El número de programa coincide',
  tools_in_setup: 'Todas las herramientas están en el carrusel',
  work_offset_matches: 'El offset de trabajo es el del setup',
  spindle_within_limit: 'Las RPM están dentro del límite',
  feed_within_limit: 'El avance está dentro del límite',
  machine_matches: 'El programa es para esta máquina',
  program_has_end: 'El programa declara su fin',
  gcode_parses_clean: 'El G-code no tiene anomalías',
};

function informe(resultado) {
  const barra = '═'.repeat(68);
  const { job, program, checks, ungrounded, flojosCriticos, veredicto, motivos, contexto } = resultado;

  console.log(barra);
  console.log(`  ORDEN ${job.workOrder ?? '?'}   PIEZA ${job.partNumber ?? '?'} REV ${job.revision ?? '?'}`);
  console.log(`  ${job.machine ?? '?'}   programa ${contexto.programa}`);
  console.log(`  motor: ${contexto.motor}`);
  console.log(barra);

  const titulo = {
    approve: '  ✓  LISTO PARA ENVIAR',
    review: '  ‼  REVISAR ANTES DE ENVIAR',
    block: '  ✗  NO APRIETES CYCLE START',
  }[veredicto];
  console.log(titulo);
  console.log(barra);

  for (const c of checks) {
    const etiqueta = Object.hasOwn(ETIQUETAS, c.id) ? ETIQUETAS[c.id] : c.id;
    console.log(`  ${c.ok ? 'ok  ' : 'FALL'}  ${etiqueta}`);
    if (!c.ok) console.log(`        esperado: ${c.expected}\n        real:     ${c.actual}`);
  }

  if (ungrounded.length > 0) {
    console.log(barra);
    console.log(`  ${ungrounded.length} dato(s) que el modelo NO puede señalar en los documentos:`);
    for (const u of ungrounded) console.log(`    ${u.key} = ${JSON.stringify(u.value)}`);
  }

  if (flojosCriticos.length > 0) {
    console.log(barra);
    console.log(`  ${flojosCriticos.length} dato(s) CRÍTICO(s) leído(s) con confianza baja:`);
    for (const f of flojosCriticos) {
      console.log(`    ${f.key} = ${JSON.stringify(f.value)}   confianza ${f.confidence.toFixed(2)}`);
    }
  }

  if (motivos.length > 0) {
    console.log(barra);
    console.log('  POR QUÉ:');
    for (const m of motivos) console.log(`    · ${m}`);
  }

  console.log(barra);
  console.log(`  programa   ${program.lineCount} líneas · ${program.tools.join(', ') || 'sin herramientas'}`
    + ` · ${program.workOffsets.join(', ') || 'sin offset'}`);
  console.log(`  hash       ${contexto.hash.slice(0, 16)}…  (normalizado)`);
  console.log(`  bytes      ${contexto.sourceSha256.slice(0, 16)}…  (exactos, es el que valida el emisor)`);
  if (contexto.msModelo > 0) console.log(`  modelo     ${(contexto.msModelo / 1000).toFixed(1)} s`);
  console.log(barra);
}

export async function main(argv = process.argv.slice(2)) {
  const { posicionales, flags } = parseArgs(argv);
  if (posicionales.length === 0) {
    console.error('uso: node bin/preflight.mjs <programa.nc> [--order img] [--setup img] [--job json]');
    return 2;
  }

  const rutaPrograma = posicionales[0];
  const crudoBytes = readFileSync(rutaPrograma);
  const texto = crudoBytes.toString('utf8');
  const program = parseGcode(texto);
  // Dos identidades distintas, y las dos hacen falta:
  //   hash          normalizado, para que el programa se reconozca aunque cambie de CRLF a LF
  //   sourceSha256  byte a byte, que es lo que el emisor tiene que poder verificar
  const hash = programHash(texto);
  const sourceSha256 = sourceHash(crudoBytes);

  const { job: crudo, bloques, motor, msModelo } = await leerDocumentos(flags);

  // --- Capa 1: el esquema ---------------------------------------------------
  const validacion = validateJob(crudo);
  const job = normalizeJob(crudo);

  // --- Capa 2: grounding ----------------------------------------------------
  // Sin bloques (extracción precargada) no hay contra qué anclar, y decirlo es
  // más honesto que inventar un anclaje que nadie verificó.
  const { grounded, ungrounded } = bloques.length > 0
    ? groundFields(job, bloques, CNC_FIELD_RULES)
    : { grounded: {}, ungrounded: [] };

  // --- Capa 3: confianza ----------------------------------------------------
  const flojos = lowConfidenceFields(grounded);
  const flojosCriticos = flojos.filter((f) => CAMPOS_CRITICOS.includes(raiz(f.key)));

  // --- Capa 4: los checks deterministas -------------------------------------
  const checks = preflight(job, program, { grounded });

  // --- Veredicto, en código -------------------------------------------------
  const fallados = checks.filter((c) => !c.ok);
  const motivos = [];
  let veredicto = 'approve';

  if (!validacion.ok) {
    veredicto = 'block';
    motivos.push(`la extracción no cumple el esquema: ${validacion.errors[0]}`);
  }
  if (fallados.length > 0) {
    veredicto = 'block';
    for (const c of fallados) {
      motivos.push(`${Object.hasOwn(ETIQUETAS, c.id) ? ETIQUETAS[c.id] : c.id}: ${c.actual}`);
    }
  }
  if (veredicto === 'approve' && (ungrounded.length > 0 || flojosCriticos.length > 0)) {
    veredicto = 'review';
    if (ungrounded.length > 0) motivos.push('hay datos que no se pueden señalar en los documentos');
    if (flojosCriticos.length > 0) motivos.push('un dato crítico se leyó con confianza baja');
  }

  const resultado = {
    veredicto,
    motivos,
    job,
    program,
    checks,
    ungrounded,
    flojosCriticos,
    programRevision: extractRevision(program),
    contexto: { programa: rutaPrograma, motor, hash, sourceSha256, msModelo },
  };

  const salida = flags.out ?? `runs/preflight/${hash.slice(0, 8)}.json`;
  mkdirSync(dirname(salida), { recursive: true });
  writeFileSync(salida, `${JSON.stringify(resultado, null, 2)}\n`);

  if (flags.json) console.log(JSON.stringify(resultado, null, 2));
  else {
    informe(resultado);
    console.log(`  informe en ${salida}`);
  }

  return { approve: 0, review: 1, block: 2 }[veredicto];
}

if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  main().then((c) => { process.exitCode = c; });
}
