// Service worker: telepatía sigue funcionando sin red.
//
// No es un detalle de comodidad — es coherencia con lo que la herramienta dice
// ser. Una app para mover archivos sin red que necesita red para abrirse
// contradice su propia tesis. Después de la primera visita, el emisor y el
// receptor levantan con el wifi apagado, en modo avión, o en una planta donde
// nunca hubo señal.
//
// Estrategia: cache-first sobre un precache explícito. No hay backend, no hay
// contenido dinámico, y todo el shell entra en un puñado de archivos — una
// política más lista solo agregaría formas de fallar.

const VERSION = 'telepatia-v3';

/** Todo lo que hace falta para que las dos páginas abran sin red. */
const SHELL = [
  './',
  './sender.html',
  './receiver.html',
  './instrument.css',
  './manifest.webmanifest',
  './dist/sender.bundle.js',
  './dist/receiver.bundle.js',
];

self.addEventListener('install', (event) => {
  event.waitUntil((async () => {
    const cache = await caches.open(VERSION);
    // `reload` evita cachear una versión vieja que el browser ya tenga guardada.
    await cache.addAll(SHELL.map((url) => new Request(url, { cache: 'reload' })));
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
      // Sin red y sin caché: una navegación cae al emisor, que es la página
      // que sirve sin cámara y sin nada más.
      if (request.mode === 'navigate') {
        const respaldo = await caches.match('./sender.html');
        if (respaldo) return respaldo;
      }
      return new Response('sin red y sin copia local', {
        status: 503,
        headers: { 'content-type': 'text/plain; charset=utf-8' },
      });
    }
  })());
});
