// Dev server para probar la UI en dispositivos reales.
//
//   node scripts/serve.mjs
//
// Levanta dos puertos sobre la raíz del repo:
//   http://localhost:8777   prueba rápida en esta computadora
//   https://<ip>:8443      emisor y receptor en cualquier dispositivo
//
// Por qué el https: `getUserMedia` solo existe en contexto seguro. Sobre
// `http://192.168.x.x` el browser no muestra el permiso de cámara — falla
// directamente, sin preguntar. `localhost` cuenta como seguro, una IP de LAN
// no. Para probar el receptor en un celular hace falta TLS, aunque el
// certificado sea propio.
//
// El certificado se genera con (SAN con la IP, que es lo que miran los
// browsers; el CN solo ya no alcanza):
//
//   openssl req -x509 -newkey rsa:2048 -nodes -days 30 \
//     -keyout certs/dev.key -out certs/dev.crt -subj "/CN=telepatia-dev" \
//     -addext "subjectAltName=DNS:localhost,IP:127.0.0.1,IP:<TU-IP>"
//
// `certs/` está en .gitignore: son claves de desarrollo, no van al repo.

import { createServer as createHttp } from 'node:http';
import { createServer as createHttps } from 'node:https';
import { createReadStream, existsSync, statSync, readFileSync } from 'node:fs';
import { networkInterfaces } from 'node:os';
import { extname, join, normalize, resolve } from 'node:path';

const RAIZ = resolve('.');
const PUERTO_HTTP = Number(process.env.PORT_HTTP ?? 8777);
const PUERTO_HTTPS = Number(process.env.PORT_HTTPS ?? 8443);

// `.js` como text/plain rompe los módulos ESM sin decir por qué.
const TIPOS = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.bin': 'application/octet-stream',
  '.csv': 'text/csv; charset=utf-8',
  '.webmanifest': 'application/manifest+json; charset=utf-8',
  // Android reconoce este tipo y ofrece instalar el certificado.
  '.crt': 'application/x-x509-ca-cert',
};

/**
 * Lo que este servidor no entrega nunca.
 *
 * `certs/` tiene la clave privada de la CA al lado del certificado publico que
 * si hay que poder bajar. Servir el directorio entero dejaria la clave a
 * disposicion de cualquiera en la red.
 */
const PROHIBIDO = /\.(key|pem|csr|srl)$/i;

function manejar(req, res) {
  const url = new URL(req.url, 'http://x');
  const pedido = decodeURIComponent(url.pathname);

  // Sin esto, `..` en la URL sirve cualquier archivo del disco.
  const destino = join(RAIZ, normalize(pedido).replace(/^(\.\.[/\\])+/, ''));
  if (!destino.startsWith(RAIZ) || PROHIBIDO.test(destino)) {
    res.writeHead(403, { 'content-type': 'text/plain; charset=utf-8' });
    res.end('403');
    return;
  }

  let archivo = destino;
  if (existsSync(archivo) && statSync(archivo).isDirectory()) {
    archivo = join(archivo, 'index.html');
  }
  if (!existsSync(archivo) || !statSync(archivo).isFile()) {
    res.writeHead(404, { 'content-type': 'text/plain; charset=utf-8' });
    res.end(`404 ${pedido}`);
    return;
  }

  res.writeHead(200, {
    'content-type': TIPOS[extname(archivo).toLowerCase()] ?? 'application/octet-stream',
    // Nada de caché: en el celular una versión vieja del bundle cuesta media
    // hora de debug de un bug que ya estaba arreglado.
    'cache-control': 'no-store',
  });
  createReadStream(archivo).pipe(res);
}

const ips = Object.values(networkInterfaces())
  .flat()
  .filter((i) => i?.family === 'IPv4' && !i.internal)
  .map((i) => i.address);

createHttp(manejar).listen(PUERTO_HTTP, '0.0.0.0', () => {
  console.log(`http  → http://localhost:${PUERTO_HTTP}`);
  for (const ip of ips) console.log(`        http://${ip}:${PUERTO_HTTP}`);
});

if (existsSync('certs/dev.crt') && existsSync('certs/dev.key')) {
  const opciones = {
    cert: readFileSync('certs/dev.crt'),
    key: readFileSync('certs/dev.key'),
  };
  createHttps(opciones, manejar).listen(PUERTO_HTTPS, '0.0.0.0', () => {
    console.log(`https → https://localhost:${PUERTO_HTTPS}`);
    for (const ip of ips) {
      console.log(`        https://${ip}:${PUERTO_HTTPS}   ← abrí esta dirección en ambos equipos`);
    }
  });
} else {
  console.log('https → falta preparar el certificado. Ejecutá primero: npm run demo:setup');
  for (const ip of ips) {
    console.log(`        después abrí http://${ip}:${PUERTO_HTTP}/certs/telepatia-ca.crt en el teléfono`);
  }
}
