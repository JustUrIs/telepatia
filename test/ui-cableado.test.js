// El JS y el HTML tienen que hablar de los mismos elementos.
//
// `mount()` busca elementos por id. Si uno no existe, o cambio de nombre en el
// HTML, la pagina no avisa: revienta con un TypeError sobre null en el primer
// getContext, o peor, un addEventListener sobre undefined que nadie ve. Es la
// clase de error que deja la interfaz muda.
//
// Estos tests no necesitan DOM: comparan los dos archivos como texto.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const PAGINAS = [
  ['emisor', 'src/ui/sender.js', 'src/ui/sender.html'],
  ['receptor', 'src/ui/receiver.js', 'src/ui/receiver.html'],
];

/** Los ids que el modulo busca con el helper `$`. */
function idsPedidos(js) {
  return [...js.matchAll(/\$\('([^']+)'\)/g)].map((m) => m[1]);
}

/** Los ids declarados en el HTML. */
function idsDeclarados(html) {
  return new Set([...html.matchAll(/\bid="([^"]+)"/g)].map((m) => m[1]));
}

for (const [nombre, rutaJs, rutaHtml] of PAGINAS) {
  test(`${nombre}: todo id que busca el JS existe en el HTML`, () => {
    const pedidos = idsPedidos(readFileSync(rutaJs, 'utf8'));
    const declarados = idsDeclarados(readFileSync(rutaHtml, 'utf8'));

    assert.ok(pedidos.length > 3, `${rutaJs} no parece buscar elementos`);
    for (const id of pedidos) {
      assert.ok(declarados.has(id), `${rutaJs} busca #${id} y ${rutaHtml} no lo declara`);
    }
  });

  test(`${nombre}: la pagina carga su bundle, no el modulo fuente`, () => {
    const html = readFileSync(rutaHtml, 'utf8');
    // El modulo fuente importa por specifier pelado y no resuelve en un browser.
    assert.match(html, /\.\/dist\/\w+\.bundle\.js/, `${rutaHtml} no importa el bundle`);
    assert.doesNotMatch(html, /from '\.\/(sender|receiver)\.js'/, 'importa el fuente');
  });
}

test('emisor: las pestanas del HTML son las que el JS sabe manejar', () => {
  const html = readFileSync('src/ui/sender.html', 'utf8');
  const js = readFileSync('src/ui/sender.js', 'utf8');

  const modos = [...html.matchAll(/data-modo="([^"]+)"/g)].map((m) => m[1]);
  assert.deepEqual(modos, ['archivo', 'texto']);

  for (const modo of modos) {
    assert.ok(js.includes(`'${modo}'`), `el JS no menciona el modo ${modo}`);
    assert.match(html, new RegExp(`id="panel-${modo}"`), `falta el panel de ${modo}`);
  }
  // Exactamente una pestana arranca seleccionada.
  const seleccionadas = [...html.matchAll(/aria-selected="true"/g)];
  assert.equal(seleccionadas.length, 1);
});

test('emisor: los presets de densidad son valores que el protocolo acepta', async () => {
  const { pickVersion } = await import('../src/optical/render.js');
  const html = readFileSync('src/ui/sender.html', 'utf8');

  const select = html.match(/<select id="chunk">([\s\S]*?)<\/select>/);
  assert.ok(select, 'no hay select de chunkSize');

  const valores = [...select[1].matchAll(/value="(\d+)"/g)].map((m) => Number(m[1]));
  assert.ok(valores.length >= 3, 'muy pocos presets para que la densidad sea ajustable');

  for (const chunkSize of valores) {
    // Que entre en un QR es la condicion que hace usable al preset.
    const version = pickVersion(chunkSize);
    assert.ok(version >= 1 && version <= 40, `${chunkSize} B no entra en ningun QR`);

    // Y la etiqueta tiene que decir la verdad sobre la version.
    const opcion = select[1].match(new RegExp(`value="${chunkSize}"[^>]*>([^<]+)<`));
    assert.ok(opcion, `sin etiqueta para ${chunkSize}`);
    assert.ok(
      opcion[1].includes(`V${version}`),
      `la opcion de ${chunkSize} B dice "${opcion[1]}" y la version real es V${version}`,
    );
  }

  // Ordenados de menor a mayor: un desplegable desordenado es una trampa.
  assert.deepEqual(valores, [...valores].sort((a, b) => a - b));
});

test('las dos paginas registran el service worker de la raiz', () => {
  for (const [, , rutaHtml] of PAGINAS) {
    const html = readFileSync(rutaHtml, 'utf8');
    assert.match(html, /register\('\.\.\/\.\.\/sw\.js'/, `${rutaHtml} no registra el worker`);
  }
});
