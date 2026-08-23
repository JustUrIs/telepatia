// El precache del service worker tiene que apuntar a archivos que existen.
//
// Esto no es paranoia: la lista tenia un './' que desde /src/ui/ resolvia a un
// directorio sin index.html. `cache.addAll` rechaza entero si UN solo pedido
// falla, asi que ese 404 hacia que el worker no se instalara nunca — y el modo
// offline fallaba sin ningun error visible.

import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

const SW = readFileSync('sw.js', 'utf8');

/** Las rutas del array SHELL, leidas del propio worker. */
function rutasDelShell() {
  const bloque = SW.match(/const SHELL = \[([\s\S]*?)\];/);
  assert.ok(bloque, 'no se encontro el array SHELL en sw.js');
  return [...bloque[1].matchAll(/'([^']+)'/g)].map((m) => m[1]);
}

/** Que archivo del repo sirve una ruta, con `./` cayendo en index.html. */
function archivoDe(ruta) {
  const limpio = ruta.replace(/^\.\//, '');
  return limpio === '' ? 'index.html' : limpio;
}

test('todas las rutas del precache existen en el repo', () => {
  const rutas = rutasDelShell();
  assert.ok(rutas.length >= 5, `el shell parece incompleto: ${rutas.length} rutas`);

  for (const ruta of rutas) {
    const archivo = join(process.cwd(), archivoDe(ruta));
    assert.ok(existsSync(archivo), `el precache pide ${ruta} y no existe ${archivoDe(ruta)}`);
  }
});

test('el precache cubre las tres paginas y sus dependencias', () => {
  const rutas = rutasDelShell().map(archivoDe);

  for (const imprescindible of [
    'index.html',
    'src/ui/sender.html',
    'src/ui/receiver.html',
    'src/ui/instrument.css',
    'src/ui/dist/sender.bundle.js',
    'src/ui/dist/receiver.bundle.js',
  ]) {
    assert.ok(rutas.includes(imprescindible), `falta ${imprescindible} en el precache`);
  }
});

test('el worker vive en la raiz: desde src/ui no alcanzaria a la portada', () => {
  assert.ok(existsSync('sw.js'), 'sw.js tiene que estar en la raiz del repo');
  assert.ok(!existsSync('src/ui/sw.js'), 'quedo una copia vieja en src/ui');

  for (const pagina of ['src/ui/sender.html', 'src/ui/receiver.html']) {
    const html = readFileSync(pagina, 'utf8');
    assert.match(html, /register\('\.\.\/\.\.\/sw\.js'/, `${pagina} no registra el worker de la raiz`);
    assert.match(html, /scope: '\.\.\/\.\.\/'/, `${pagina} no pide alcance de raiz`);
  }
});

test('el install no usa cache.addAll', () => {
  // addAll rechaza entero ante un solo fallo. Un archivo que falta no puede
  // ser motivo de que la app entera deje de funcionar sin red.
  //
  // Se mira el codigo sin comentarios: el propio worker explica por que NO usa
  // addAll, y esa mencion no es una llamada.
  const codigo = SW.split('\n').filter((l) => !l.trim().startsWith('//')).join('\n');
  assert.doesNotMatch(codigo, /cache\.addAll/, 'addAll vuelve el install todo-o-nada');
  assert.match(codigo, /allSettled/, 'el precache tiene que tolerar fallas parciales');
});

test('la version del cache subio junto con los bundles', () => {
  const version = SW.match(/const VERSION = '([^']+)'/);
  assert.ok(version, 'sin VERSION no hay forma de invalidar el cache viejo');
  assert.match(version[1], /^telepatia-v\d+$/);
});

test('las paginas piden el estado del precache y lo muestran', () => {
  // Un offline que promete y falla es peor que no tenerlo: si algo del shell
  // no se cacheo, la pagina tiene que decirlo.
  assert.match(SW, /faltantes/, 'el worker tiene que reportar que quedo afuera');
  for (const pagina of ['src/ui/sender.html', 'src/ui/receiver.html']) {
    const html = readFileSync(pagina, 'utf8');
    assert.match(html, /postMessage\('estado'\)/, `${pagina} no consulta el estado`);
    assert.match(html, /offline parcial/i, `${pagina} no muestra un precache incompleto`);
  }
});
