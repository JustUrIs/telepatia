// Corre el OCR real de QVAC sobre las cuatro variantes del aviso.
//
//   node scripts/try-ocr.mjs
//
// Usa QvacBackend, que es el camino que corre en producción — no una llamada
// suelta al SDK. Si esto anda, anda el pipeline.
//
// Escribe fixtures/advisories/<variante>.ocr.json con los bloques, para que el
// resto del pipeline pueda correr sin volver a pagar el OCR.

import { writeFileSync } from 'node:fs';
import { QvacBackend } from '../src/audit/qvac-backend.js';

const VARIANTES = ['clean', 'rotated', 'lowcontrast', 'noisy'];

const backend = new QvacBackend({
  preset: 'standard',
  onProgress: (rol, p) => {
    const pct = Math.floor((p?.progress ?? 0) * 100);
    if (pct % 25 === 0) console.log(`  cargando ${rol}: ${pct}%`);
  },
});

console.log('init: cargando OCR_LATIN + QWEN3_4B...');
const t0 = Date.now();
await backend.init();
console.log(`init listo en ${((Date.now() - t0) / 1000).toFixed(1)}s\n`);

const resumen = [];

for (const variante of VARIANTES) {
  const ruta = `fixtures/advisories/${variante}.png`;
  const t = Date.now();
  try {
    const bloques = await backend.ocr(ruta);
    const ms = Date.now() - t;

    writeFileSync(`fixtures/advisories/${variante}.ocr.json`,
      `${JSON.stringify(bloques, null, 2)}\n`);

    const texto = bloques.map((b) => b.text).join(' ');
    // Los seis datos que el expediente de cambio necesita sí o sí.
    const claves = {
      advisoryId: /ICSA-26-198-04/i.test(texto),
      fixedVersion: /4\.3\.0/.test(texto),
      affected: /4\.0\.0/.test(texto) && /4\.2\.3/.test(texto),
      cve: /CVE-2026-31877/i.test(texto),
      cvss: /9\.8/.test(texto),
      reboot: /reboot/i.test(texto),
    };
    const encontradas = Object.values(claves).filter(Boolean).length;

    console.log(`${variante.padEnd(12)} ${String(ms).padStart(6)} ms  `
      + `${String(bloques.length).padStart(3)} bloques  `
      + `${encontradas}/6 datos clave`);
    console.log(`             ${Object.entries(claves)
      .map(([k, v]) => `${v ? '+' : '-'}${k}`).join(' ')}`);

    resumen.push({ variante, ms, bloques: bloques.length, claves, encontradas });
  } catch (err) {
    console.log(`${variante.padEnd(12)} FALLO: ${err.message}`);
    resumen.push({ variante, error: err.message });
  }
}

writeFileSync('docs/ocr-bench.json', `${JSON.stringify(resumen, null, 2)}\n`);
console.log('\nescrito docs/ocr-bench.json');

await backend.dispose();
