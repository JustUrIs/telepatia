// Hechos del entorno de ejecucion, en una linea.
//
// En un celular nadie abre devtools. Sin esto, "el boton esta gris" o "no
// abre el selector de archivos" no tienen forma de convertirse en una causa,
// y el diagnostico se vuelve una charla de adivinanzas.

/**
 * Los hechos del entorno, en una línea, para poder diagnosticar sin devtools.
 *
 * En un celular nadie abre la consola. Sin esto, "el botón está gris" no tiene
 * forma de convertirse en una causa.
 *
 * @param {object} entorno
 * @returns {string}
 */
export function describeEnvironment(entorno) {
  const nav = entorno?.navigator;
  const loc = entorno?.location;

  // `host` ya trae el puerto; si falta se rearma, que es lo que pasa en los
  // tests y en cualquier entorno que no sea un browser real.
  const host = loc?.host ?? (loc?.hostname
    ? `${loc.hostname}${loc.port ? `:${loc.port}` : ''}`
    : '?');

  const partes = [
    `origen ${loc?.protocol ?? 'http:'}//${host}`,
    `seguro:${entorno?.isSecureContext ? 'si' : 'NO'}`,
    `camara:${nav?.mediaDevices?.getUserMedia ? 'si' : 'NO'}`,
    `red:${nav?.onLine === false ? 'no' : 'si'}`,
    `sw:${nav?.serviceWorker?.controller ? 'activo' : 'no'}`,
  ];

  // `standalone` significa que se abrió desde el icono instalado, no desde una
  // pestaña. Cambia el comportamiento de permisos y del selector de archivos.
  const modo = entorno?.matchMedia?.('(display-mode: standalone)')?.matches;
  if (modo) partes.push('modo:app');

  return partes.join(' · ');
}
