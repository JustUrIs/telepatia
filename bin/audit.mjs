#!/usr/bin/env node
// telepatía · auditoría de una factura recibida.
//
// Este archivo es la costura entre los dos bloques. Lo que hace visible:
//
//   receptor óptico → document.bin   (Bloque A, browser)
//        ↓
//   parseCsv + normalize             (Bloque A, T-07/T-08)
//        ↓
//   runPipeline                      (Bloque B, T-20)
//        ↓
//   runs/<docId>/verdict.json        (lo lee de vuelta el receptor)
//
// Corre en Node y no en el browser a propósito: el pipeline escribe artefactos
// y lee el ledger de duplicados, y el SDK de inferencia es de Node. La página
// reconstruye y muestra; la auditoría pasa acá.
//
// Uso:
//   node bin/audit.mjs <documento> [opciones]
//
//   --csv <ruta>       extracto bancario (default: fixtures/statement.csv)
//   --ocr <ruta>       bloques de OCR ya hechos: usa FakeBackend en vez del modelo
//   --preset <nombre>  preset de modelo del QvacBackend (default: standard)
//   --out <ruta>       dónde escribir el veredicto (default: runs/<docId>/verdict.json)
//   --no-ledger        no registrar la factura en el ledger de duplicados
//   --json             solo el veredicto en JSON por stdout, sin el resumen

import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname } from 'node:path';

import { docIdHex, runPaths, LEDGER_PATH } from '../src/shared/contract.js';
import { parseCsv } from '../src/csv/parse.js';
import { normalize } from '../src/csv/normalize.js';
import { runPipeline } from '../src/audit/pipeline.js';
import { FakeBackend } from '../src/audit/backend.js';

/** Argumentos: `--clave valor` y banderas sueltas, sin dependencias. */
function parseArgs(argv) {
  const posicionales = [];
  const flags = {};
  for (let i = 0; i < argv.length; i++) {
    const arg = argv[i];
    if (!arg.startsWith('--')) {
      posicionales.push(arg);
      continue;
    }
    const clave = arg.slice(2);
    const siguiente = argv[i + 1];
    if (siguiente === undefined || siguiente.startsWith('--')) {
      flags[clave] = true;
    } else {
      flags[clave] = siguiente;
      i++;
    }
  }
  return { posicionales, flags };
}

/** El mismo docId que usa el protocolo óptico: primeros 4 bytes del SHA-256. */
export function docIdDe(bytes) {
  return createHash('sha256').update(bytes).digest().readUInt32BE(0);
}

/**
 * Extracto bancario crudo a `Transaction[]`, con lo rechazado a la vista.
 *
 * Nada se descarta en silencio: si tres filas no normalizan, el operador tiene
 * que enterarse antes de que el matcher diga "sin coincidencia".
 */
export function cargarExtracto(ruta) {
  const texto = readFileSync(ruta, 'utf8');
  const { transactions, rejected } = normalize(parseCsv(texto));
  return { transactions, rejected };
}

/**
 * Elige el motor de inferencia.
 *
 * Con `--ocr` se usa `FakeBackend` sobre bloques ya extraídos: sirve para
 * demostrar el pipeline completo sin bajar 4 GB de modelo, y es el mismo camino
 * que corre en CI.
 */
async function armarBackend(flags) {
  if (flags.ocr) {
    const blocks = JSON.parse(readFileSync(flags.ocr, 'utf8'));
    // Sin extracción, FakeBackend devuelve `{}` y el esquema lo rechaza antes
    // de llegar al grounding: correcto, pero inútil para mostrar el pipeline.
    const rutaExtraccion = flags.extraction ?? 'fixtures/invoice-extraction.json';
    const extraction = JSON.parse(readFileSync(rutaExtraccion, 'utf8'));
    return {
      backend: new FakeBackend({ blocks, extraction }),
      etiqueta: `FakeBackend · ${flags.ocr} + ${rutaExtraccion}`,
    };
  }

  // Import diferido: `@qvac/sdk` es opcional, y pedirlo cuando no hace falta
  // rompería el camino de demostración en una máquina sin el modelo.
  const { QvacBackend } = await import('../src/audit/qvac-backend.js');
  const backend = new QvacBackend({ preset: flags.preset ?? 'standard' });
  return { backend, etiqueta: `QvacBackend (${flags.preset ?? 'standard'})` };
}

/** Resumen legible del veredicto, para la terminal. */
function imprimirResumen(resultado, contexto) {
  const linea = '─'.repeat(64);
  console.log(linea);
  console.log(`documento   ${contexto.documento}`);
  console.log(`docId       ${contexto.docIdHex}`);
  console.log(`motor       ${contexto.motor}`);
  console.log(`extracto    ${contexto.transacciones} transacciones`
    + (contexto.rechazadas ? `, ${contexto.rechazadas} filas rechazadas` : ''));
  console.log(linea);

  if (!resultado.ok) {
    const { stage, code, message } = resultado.failure;
    console.log(`FALLO en ${stage} · ${code}`);
    console.log(message);
    console.log(linea);
    return;
  }

  const { verdict, checks, ungrounded, matched } = resultado.verdict;
  const titulos = { pass: 'CONCILIADA', fail: 'RECHAZADA', review: 'REQUIERE REVISION' };
  console.log(`VEREDICTO   ${titulos[verdict] ?? verdict.toUpperCase()}`);
  console.log(linea);

  for (const check of checks) {
    console.log(`  ${check.ok ? 'ok  ' : 'FALL'}  ${check.id}`
      + (check.ok ? '' : `   esperado ${check.expected}, obtenido ${check.actual}`));
  }

  if (ungrounded.length > 0) {
    console.log(linea);
    console.log(`  ${ungrounded.length} campo(s) SIN RESPALDO en el documento:`);
    for (const u of ungrounded) console.log(`    ${u.key} = ${JSON.stringify(u.value)} — ${u.reason}`);
  }

  console.log(linea);
  console.log(matched
    ? `  movimiento  ${matched.date} · ${matched.description} · ${matched.amount} ${matched.currency}`
    : '  movimiento  sin coincidencia en el extracto');
  console.log(linea);

  // Solo las etapas que efectivamente corrieron: `scan` y `assemble` pasan en
  // el browser, y mostrarlas como "nullms" hace pensar que fallaron.
  const etapas = resultado.metrics.stages.filter((e) => e && Number.isFinite(e.ms));
  console.log(`  ${etapas.map((e) => `${e.stage} ${e.ms}ms`).join(' · ')}`);
  console.log(`  total ${resultado.metrics.totalMs} ms`);
  console.log(linea);
}

export async function main(argv = process.argv.slice(2)) {
  const { posicionales, flags } = parseArgs(argv);

  if (posicionales.length === 0 || flags.help) {
    console.log(readFileSync(new URL(import.meta.url), 'utf8')
      .split('\n')
      .filter((l) => l.startsWith('//'))
      .map((l) => l.replace(/^\/\/ ?/, ''))
      .join('\n'));
    return posicionales.length === 0 ? 2 : 0;
  }

  const documento = posicionales[0];
  const bytes = readFileSync(documento);
  const docId = docIdDe(bytes);

  const rutaCsv = flags.csv ?? 'fixtures/statement.csv';
  const { transactions, rejected } = cargarExtracto(rutaCsv);

  if (rejected.length > 0) {
    console.error(`aviso: ${rejected.length} fila(s) del extracto no se pudieron leer:`);
    for (const fallo of rejected) console.error(`  ${fallo.message}`);
  }

  const { backend, etiqueta } = await armarBackend(flags);

  const resultado = await runPipeline({
    documentPath: documento,
    transactions,
    backend,
    docId,
    ledgerPath: flags['no-ledger'] ? undefined : LEDGER_PATH,
    persist: true,
  });

  const salida = flags.out ?? runPaths(docId).verdict;
  mkdirSync(dirname(salida), { recursive: true });
  const payload = resultado.ok
    ? resultado.verdict
    : { verdict: null, failure: resultado.failure };
  writeFileSync(salida, `${JSON.stringify(payload, null, 2)}\n`);

  if (flags.json) {
    console.log(JSON.stringify(payload, null, 2));
  } else {
    imprimirResumen(resultado, {
      documento,
      docIdHex: docIdHex(docId),
      motor: etiqueta,
      transacciones: transactions.length,
      rechazadas: rejected.length,
    });
    console.log(`veredicto escrito en ${salida}`);
    console.log('cargalo en el receptor para verlo con la evidencia al lado.');
  }

  // El código de salida distingue los tres estados: un pipeline en CI necesita
  // saber si algo quedó en revisión sin tener que parsear el JSON.
  if (!resultado.ok) return 3;
  return { pass: 0, review: 1, fail: 2 }[resultado.verdict.verdict] ?? 3;
}

// Solo corre como programa si se lo invoca directo, no al importarlo del test.
if (process.argv[1] && import.meta.url.endsWith(process.argv[1].replace(/\\/g, '/').split('/').pop())) {
  main().then((codigo) => { process.exitCode = codigo; });
}
