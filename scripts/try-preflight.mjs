// La prueba que importa: modelo real leyendo documentos reales de taller.
//
//   node scripts/try-preflight.mjs [--worn]
//
// Encadena OCR_LATIN sobre la orden de trabajo y el setup sheet, y QWEN3-4B
// extrayendo el JOB_SCHEMA de esos bloques con gramática forzada. Después ancla
// cada campo contra el OCR: un valor que el modelo no puede señalar en los
// píxeles no es un dato.
//
// El programa .nc NO pasa por acá. Lo parsea código determinista.

import { readFileSync, writeFileSync } from 'node:fs';
import { QvacBackend } from '../src/audit/qvac-backend.js';
import { JOB_SCHEMA, validateJob, normalizeJob } from '../src/cnc/job-schema.js';
import { groundFields } from '../src/audit/ground.js';
import { CNC_FIELD_RULES } from '../src/cnc/ground-rules.js';
import { lowConfidenceFields, CONFIANZA_MINIMA, CAMPOS_CRITICOS } from '../src/cnc/preflight.js';

const gastado = process.argv.includes('--worn');
const DOCS = [
  ['orden de trabajo', gastado ? 'fixtures/shop/work-order-photo.png' : 'fixtures/shop/work-order.png'],
  ['setup sheet', gastado ? 'fixtures/shop/setup-sheet-worn.png' : 'fixtures/shop/setup-sheet.png'],
];

const backend = new QvacBackend({ preset: 'standard' });

console.log(`documentos: ${gastado ? 'foto torcida + fotocopia gastada' : 'limpios'}`);
console.log('cargando modelos...');
let t = Date.now();
await backend.init();
console.log(`modelos listos en ${((Date.now() - t) / 1000).toFixed(1)}s\n`);

// --- OCR de los dos documentos ----------------------------------------------

const bloques = [];
for (const [nombre, ruta] of DOCS) {
  t = Date.now();
  const b = await backend.ocr(ruta);
  const ms = Date.now() - t;
  const media = b.reduce((a, x) => a + x.confidence, 0) / Math.max(1, b.length);
  console.log(`OCR ${nombre.padEnd(18)} ${String(ms).padStart(6)} ms  ${String(b.length).padStart(3)} bloques  conf. media ${media.toFixed(2)}`);
  bloques.push(...b);
}

// --- Extracción con gramática forzada ---------------------------------------

console.log('\nextrayendo con QWEN3-4B (JSON Schema forzado)...');
t = Date.now();
let extraido;
try {
  extraido = await backend.extract(bloques, JOB_SCHEMA);
} catch (err) {
  console.error(`FALLO la extracción: ${err.message}`);
  await backend.dispose();
  process.exit(1);
}
const msExtract = Date.now() - t;
console.log(`extracción en ${(msExtract / 1000).toFixed(1)}s\n`);
console.log(JSON.stringify(extraido, null, 2));

// --- Capa 1: el esquema -----------------------------------------------------

const validacion = validateJob(extraido);
console.log(`\nschema: ${validacion.ok ? 'OK' : 'RECHAZA'}`);
if (!validacion.ok) for (const e of validacion.errors) console.log(`  - ${e}`);

// --- Capa 2: grounding contra los píxeles -----------------------------------

const normalizado = normalizeJob(extraido);
const { grounded, ungrounded } = groundFields(normalizado, bloques, CNC_FIELD_RULES);
console.log(`\ngrounding: ${Object.keys(grounded).length} anclados, ${ungrounded.length} sin anclar`);
for (const u of ungrounded) console.log(`  SIN ANCLAR  ${u.key} = ${JSON.stringify(u.value)}`);

// --- Capa 3: la compuerta de confianza --------------------------------------

const flojos = lowConfidenceFields(grounded);
// La compuerta bloquea solo si el campo flojo es critico. Que el material se
// haya leido a 0.53 es informacion; que la revision se lea a 0.53 es un lote.
const criticosFlojos = flojos.filter((f) => CAMPOS_CRITICOS.includes(f.key.split(String.fromCharCode(46))[0]));
console.log(`\nconfianza (umbral ${CONFIANZA_MINIMA}): ${flojos.length} campo(s) por debajo`);
for (const f of flojos) console.log(`  BAJA  ${f.key} = ${JSON.stringify(f.value)}  conf ${f.confidence.toFixed(2)}`);

writeFileSync(`docs/preflight-extract${gastado ? '-worn' : ''}.json`, `${JSON.stringify({
  documentos: DOCS.map(([, r]) => r),
  msExtract,
  extraido,
  schemaOk: validacion.ok,
  schemaErrors: validacion.errors,
  anclados: Object.keys(grounded),
  ungrounded,
  bajaConfianza: flojos,
}, null, 2)}\n`);

console.log('\nescrito docs/preflight-extract.json');
await backend.dispose();
