// Service worker: telepatía sigue funcionando sin red.
//
// No es un detalle de comodidad — es coherencia con lo que la herramienta dice
// ser. Una app para mover archivos sin red que necesita red para abrirse
// contradice su propia tesis. Después de la primera visita, la portada, el
// emisor y el receptor levantan con el wifi apagado, en modo avión, o en una
// planta donde nunca hubo señal.
//
// Vive en la raíz a propósito: un service worker solo puede controlar su
// propio directorio hacia abajo. Desde `/src/ui/` no alcanzaba a la portada.
//
// Estrategia: cache-first sobre un precache explícito. No hay backend, no hay
// contenido dinámico, y todo el shell entra en un puñado de archivos — una
// política más lista solo agregaría formas de fallar.

const VERSION = 'telepatia-v7';

/**
 * Todo lo que hace falta para que las páginas abran sin red.
 *
 * Las rutas son relativas al propio worker, que está en la raíz: así el mismo
 * archivo funciona servido desde `/` o desde un subdirectorio.
 */
const SHELL = [
  './',
  './index.html',
  './src/ui/sender.html',
  './src/ui/receiver.html',
  './src/ui/instrument.css',
  './src/ui/manifest.webmanifest',
  './src/ui/icon.svg',
  './src/ui/dist/sender.bundle.js',
  './src/ui/dist/receiver.bundle.js',
];

/** Qué del precache no se pudo guardar, para poder decirlo en pantalla. */
let faltantes = [];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);

    // Uno por uno y con allSettled, NO cache.addAll: addAll rechaza entero si
    // un solo pedido falla, y entonces el worker no se instala. Un `./` que da
    // 404 no puede ser motivo de que la app no funcione sin red.
    const resultados = await Promise.allSettled(
      SHELL.map(async (url) => {
        // `reload` evita guardar una version vieja que el browser ya tenga.
        const respuesta = await fetch(new Request(url, { cache: 'reload' }));
        if (!respuesta.ok) throw new Error(`${respuesta.status} ${url}`);
        await cache.put(url, respuesta);
        return url;
      }),
    );

    faltantes = SHELL.filter((_, i) => resultados[i].status === 'rejected');
    if (faltantes.length > 0) {
      console.warn('[telepatia] sin cachear:', faltantes.join(', '));
    }

    // Sin esto, la primera visita instala el worker pero recién sirve offline
    // en la visita siguiente — justo la que puede no tener red.
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (event) => {
  event.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((n) => n !== VERSION).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

/** La página pregunta qué quedó afuera del precache. */
self.addEventListener('message', (event) => {
  if (event.data === 'estado') {
    event.source?.postMessage({ tipo: 'estado', version: VERSION, faltantes });
  }
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  event.respondWith((async () => {
    const guardado = await caches.match(request, { ignoreSearch: true });
    if (guardado) return guardado;

    try {
      const respuesta = await fetch(request);
      // Se guarda lo que salió bien, para que el segundo arranque sin red
      // tenga también lo que no estaba en el precache.
      if (respuesta.ok && respuesta.type === 'basic') {
        const cache = await caches.open(VERSION);
        cache.put(request, respuesta.clone());
      }
      return respuesta;
    } catch {
      // Sin red y sin copia: una navegación cae a la portada, que es la página
      // que no necesita nada.
      if (request.mode === 'navigate') {
        const respaldo = await caches.match('./index.html')
          ?? await caches.match('./');
        if (respaldo) return respaldo;
      }
      return new Response('sin red y sin copia local', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
