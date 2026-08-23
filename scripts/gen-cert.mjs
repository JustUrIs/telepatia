// Genera el certificado de desarrollo, cubriendo todas las IP de esta máquina.
//
//   node scripts/gen-cert.mjs
//
// Por qué existe: la IP de LAN cambia sola cuando el router renueva el DHCP o
// cuando cambiás de red. Un certificado emitido para la IP de ayer da
// ERR_CONNECTION_TIMED_OUT o un error de certificado hoy, y el síntoma no dice
// nada sobre la causa.
//
// Emite dos cosas:
//   certs/telepatia-ca.crt   la CA. Se instala UNA vez en el teléfono.
//   certs/dev.crt|.key       el certificado del servidor, firmado por esa CA.
//
// La CA se reusa si ya existe: si se regenerara, habría que reinstalarla en el
// teléfono cada vez que cambia la IP, que es exactamente lo que se quiere
// evitar. Solo se rehace el certificado del servidor.

import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { networkInterfaces } from 'node:os';

const DIR = 'certs';
const CA_CRT = `${DIR}/telepatia-ca.crt`;
const CA_KEY = `${DIR}/ca.key`;

// En Windows, Git incluye OpenSSL pero no siempre lo agrega al PATH de
// PowerShell. Buscarlo ahí evita que la preparación de cámara falle con ENOENT
// en una máquina que sí tiene todo lo necesario.
const OPENSSL = process.env.TELEPATIA_OPENSSL
  ?? (process.platform === 'win32' && existsSync('C:/Program Files/Git/usr/bin/openssl.exe')
    ? 'C:/Program Files/Git/usr/bin/openssl.exe'
    : 'openssl');

const openssl = (args) =>
  execFileSync(OPENSSL, args, { stdio: ['ignore', 'pipe', 'pipe'] });

mkdirSync(DIR, { recursive: true });

// IPs actuales, más las que se pasen por argumento.
//
// Aceptar extras importa: el router renueva el DHCP y la IP cambia sola, a
// veces yendo y viniendo entre dos. Un certificado que cubre las dos evita
// tener que regenerar —y sobre todo evita tener que volver a instalar la CA en
// el teléfono— cada vez que eso pasa.
const extras = process.argv.slice(2).filter((a) => /^\d+\.\d+\.\d+\.\d+$/.test(a));

const ips = [...new Set([
  ...Object.values(networkInterfaces())
    .flat()
    .filter((i) => i?.family === 'IPv4' && !i.internal)
    .map((i) => i.address),
  ...extras,
])];

const san = [
  'DNS:localhost',
  'IP:127.0.0.1',
  ...ips.map((ip) => `IP:${ip}`),
].join(',');

// --- La CA, solo si no existe ------------------------------------------------

if (!existsSync(CA_CRT) || !existsSync(CA_KEY)) {
  openssl(['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '365', '-sha256',
    '-keyout', CA_KEY, '-out', CA_CRT,
    '-subj', '/CN=telepatia dev CA/O=telepatia',
    '-addext', 'basicConstraints=critical,CA:TRUE,pathlen:0',
    '-addext', 'keyUsage=critical,keyCertSign,cRLSign']);
  console.log(`CA nueva: ${CA_CRT} — hay que instalarla en el telefono`);
} else {
  console.log(`CA existente: ${CA_CRT} — no hace falta reinstalarla`);
}

// --- El certificado del servidor, siempre ------------------------------------

const csr = `${DIR}/dev.csr`;
const ext = `${DIR}/ext.cnf`;

openssl(['req', '-newkey', 'rsa:2048', '-nodes',
  '-keyout', `${DIR}/dev.key`, '-out', csr,
  '-subj', '/CN=telepatia local']);

writeFileSync(ext, [
  `subjectAltName=${san}`,
  'extendedKeyUsage=serverAuth',
  'basicConstraints=critical,CA:FALSE',
  '',
].join('\n'));

openssl(['x509', '-req', '-in', csr, '-CA', CA_CRT, '-CAkey', CA_KEY,
  '-CAcreateserial', '-out', `${DIR}/dev.crt`, '-days', '365', '-sha256',
  '-extfile', ext]);

rmSync(csr, { force: true });
rmSync(ext, { force: true });

console.log(`certificado del servidor para: ${san}`);
for (const ip of ips) console.log(`  https://${ip}:8443/`);
