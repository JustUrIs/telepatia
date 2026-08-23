// Genera src/ui/vendor/qrcode-core.js: el encoder de `qrcode` empaquetado como
// un único módulo ESM que un browser puede cargar sin build step.
//
// Correr a mano solo cuando cambie la versión de `qrcode`:
//   node scripts/vendor-qrcode.mjs
//
// Por qué existe: `qrcode` se publica como 37 archivos CommonJS y no trae
// bundle UMD ni ESM. En Node eso no molesta (T-05 lo importa y listo), pero un
// browser no puede resolver ni `require` ni un specifier pelado, así que la UI
// del emisor no tenía forma de encodear un QR sin un bundler.
//
// El artefacto se commitea. La decisión de stack del proyecto es "cero paso de
// build" y esto la respeta: quien clona hace `npm install` y abre el HTML.
// `test/t09-sender.test.js` verifica que este bundle produzca matrices
// idénticas a las del paquete npm, así que no puede desincronizarse en silencio.

import { execFileSync } from 'node:child_process';
import { writeFileSync, readFileSync, rmSync } from 'node:fs';

const SALIDA = 'src/ui/vendor/qrcode-core.js';
// El entry vive dentro del proyecto: esbuild resuelve `node_modules` subiendo
// desde el archivo de entrada, y desde el temp del sistema no lo encontraría.
const ENTRY = 'src/ui/vendor/.entry-qrcode.mjs';

const { version } = JSON.parse(readFileSync('node_modules/qrcode/package.json', 'utf8'));

writeFileSync(ENTRY, [
  "import core from 'qrcode/lib/core/qrcode.js';",
  'export const create = core.create;',
  '',
].join('\n'));

try {
  execFileSync(
    'npx',
    ['--yes', 'esbuild', ENTRY,
      '--bundle', '--format=esm', '--platform=browser', '--legal-comments=inline',
      `--outfile=${SALIDA}`],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );
} finally {
  rmSync(ENTRY, { force: true });
}

const cabecera = [
  '// GENERADO por scripts/vendor-qrcode.mjs. NO EDITAR A MANO.',
  `// Origen: qrcode@${version} (MIT), módulo qrcode/lib/core/qrcode.js.`,
  '// Solo el encoder: sin renderers, sin pngjs, sin globals de browser.',
  '// Equivalencia con el paquete npm verificada en test/t09-sender.test.js.',
  '',
].join('\n');

writeFileSync(SALIDA, cabecera + readFileSync(SALIDA, 'utf8'));
console.log(`escrito ${SALIDA} desde qrcode@${version}`);
