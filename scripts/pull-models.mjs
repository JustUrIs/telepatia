// Descarga los modelos de QVAC y deja anotado qué máquina los corrió.
//
//   node scripts/pull-models.mjs [--preset standard|lowMemory]
//
// Los modelos bajan una sola vez y quedan en caché. Este script existe para que
// la descarga corra sola, de fondo, y para que quede registro de las specs de
// hardware — que el track pide como entregable con nombre propio.

import { writeFileSync } from 'node:fs';
import { MODEL_PRESETS } from '../src/audit/qvac-backend.js';

const preset = process.argv.includes('--preset')
  ? process.argv[process.argv.indexOf('--preset') + 1]
  : 'standard';

const modelos = MODEL_PRESETS[preset];
if (!modelos) {
  console.error(`preset desconocido: ${preset} (esperado: ${Object.keys(MODEL_PRESETS).join(', ')})`);
  process.exit(2);
}

console.log(`preset ${preset}: llm=${modelos.llm} ocr=${modelos.ocr}`);

const sdk = await import('@qvac/sdk');
const api = sdk.default ?? sdk;

// Specs de hardware primero: si la descarga falla, al menos queda esto.
let recursos = null;
try {
  recursos = typeof api.getSystemResources === 'function'
    ? await api.getSystemResources()
    : null;
  console.log('hardware:', JSON.stringify(recursos));
} catch (err) {
  console.log('getSystemResources no disponible:', err.message);
}

/** Barra de progreso en una línea, para no llenar el log de fondo. */
function progreso(nombre) {
  let ultimo = -1;
  return (info) => {
    const pct = Math.floor((info?.progress ?? info?.percent ?? 0) * 100);
    if (pct === ultimo || pct % 5 !== 0) return;
    ultimo = pct;
    console.log(`  ${nombre}  ${pct}%`);
  };
}

const resultados = {};

for (const [rol, nombre] of Object.entries(modelos)) {
  const t0 = Date.now();
  // El nombre del preset es una CLAVE del SDK, no el descriptor: `loadModel`
  // espera el objeto {name, src} que el SDK exporta, no el string.
  const modelSrc = api[nombre];
  if (!modelSrc) {
    console.error(`FALLO ${rol}: el SDK no expone ${nombre}`);
    resultados[rol] = { modelSrc: nombre, error: 'no expuesto por el SDK' };
    continue;
  }

  console.log(`bajando ${rol}: ${nombre}`);
  try {
    const modelId = await api.loadModel({
      modelSrc,
      ...(rol === 'ocr'
        ? { modelConfig: { langList: ['en', 'es'] } }
        : {}),
      onProgress: progreso(rol),
    });
    const segundos = ((Date.now() - t0) / 1000).toFixed(1);
    console.log(`listo ${rol} en ${segundos}s (modelId ${modelId})`);
    resultados[rol] = { modelSrc: nombre, modelId: String(modelId), loadSeconds: Number(segundos) };

    // Se descarga de memoria pero NO del disco: la caché es lo que queremos.
    if (typeof api.unloadModel === 'function') await api.unloadModel({ modelId });
  } catch (err) {
    console.error(`FALLO ${rol} (${nombre}): ${err.message}`);
    resultados[rol] = { modelSrc: nombre, error: err.message };
  }
}

writeFileSync('docs/hardware.json', `${JSON.stringify({
  preset,
  fecha: new Date().toISOString(),
  node: process.version,
  plataforma: `${process.platform} ${process.arch}`,
  recursos,
  modelos: resultados,
}, null, 2)}\n`);

console.log('escrito docs/hardware.json');
if (typeof api.close === 'function') await api.close();
