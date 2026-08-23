// Genera src/ui/dist/{sender,receiver}.bundle.js: las dos páginas de la UI
// empaquetadas como módulos ESM que un browser carga sin nada instalado.
//
//   node scripts/bundle-ui.mjs
//
// Por qué existe: `protocol.js` corre en Node y usa `Buffer`, `node:crypto` y
// `node:zlib`. TAREAS §1 congela el runtime en Node ≥22, pero T-09 y T-10 son
// páginas de browser. Sin esto, el núcleo de Bloque A no carga en una pestaña.
//
// La traducción es chica y está testeada: los tres shims de `src/ui/shim/` se
// comparan contra los builtins reales de Node en `test/t00-shim.test.js`.
//
// Los artefactos se commitean, así que abrir la página no requiere ningún paso
// previo más que `npm install`.

import { execFileSync } from 'node:child_process';
import { readFileSync, writeFileSync, mkdirSync } from 'node:fs';

const SALIDA = 'src/ui/dist';
const PAGINAS = [
  ['src/ui/sender.js', `${SALIDA}/sender.bundle.js`],
  ['src/ui/receiver.js', `${SALIDA}/receiver.bundle.js`],
];

mkdirSync(SALIDA, { recursive: true });

for (const [entrada, destino] of PAGINAS) {
  execFileSync(
    'npx',
    ['--yes', 'esbuild', entrada,
      '--bundle', '--format=esm', '--platform=browser', '--legal-comments=inline',
      '--alias:node:crypto=./src/ui/shim/node-crypto.js',
      '--alias:node:zlib=./src/ui/shim/node-zlib.js',
      '--inject:./src/ui/shim/inject-buffer.js',
      `--outfile=${destino}`],
    { stdio: 'inherit', shell: process.platform === 'win32' },
  );

  const cabecera = [
    '// GENERADO por scripts/bundle-ui.mjs. NO EDITAR A MANO.',
    `// Entrada: ${entrada}`,
    '// node:crypto y node:zlib resueltos a los shims de src/ui/shim/,',
    '// verificados contra los builtins de Node en test/t00-shim.test.js.',
    '',
  ].join('\n');
  writeFileSync(destino, cabecera + readFileSync(destino, 'utf8'));
  console.log(`escrito ${destino}`);
}
