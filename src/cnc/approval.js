// Atar un informe de pre-flight aprobado a los bytes exactos que se van a emitir.
//
// Sin esto, el flujo tiene un agujero de narrativa y de uso: el pre-flight
// aprueba `part-1837-revC.nc` y después el emisor deja elegir cualquier archivo.
// El operario puede aprobar uno y mandar otro sin que nada se lo diga.
//
// QUÉ ES Y QUÉ NO ES ESTO, dicho de frente porque importa:
//
//   ES     una verificación de que los bytes seleccionados son exactamente los
//          que se evaluaron. Cierra el error humano y el cambio accidental, que
//          es de lejos el caso frecuente en un taller.
//
//   NO ES  una firma. El informe es un JSON sin firmar: alguien con acceso a la
//          máquina puede editarlo. Llamarlo "firmado" o "autenticado" sería
//          mentir, y una mentira en un pitch de seguridad la encuentra el
//          primer jurado que abra el archivo.
//
// Para que fuera una firma haría falta una cadena Ed25519 completa: manejo de
// claves, verificación en emisor y receptor, y tests de adulteración. No está
// hecho, así que no se dice.

import { createHash } from 'node:crypto';

/** Los tres veredictos que puede emitir el pre-flight. */
export const VEREDICTOS = ['approve', 'review', 'block'];

/**
 * SHA-256 de los bytes CRUDOS del archivo.
 *
 * Distinto a propósito de `programHash()` del parser, que normaliza finales de
 * línea para que un mismo programa mantenga su identidad al pasar por sistemas
 * distintos. Acá hace falta lo contrario: la identidad byte a byte de lo que se
 * va a transmitir. Son dos preguntas distintas y las dos son útiles.
 *
 * @param {Uint8Array|string} datos
 * @returns {string} hexadecimal
 */
export function sourceHash(datos) {
  const bytes = typeof datos === 'string' ? Buffer.from(datos, 'utf8') : datos;
  return createHash('sha256').update(bytes).digest('hex');
}

/** Forma mínima que un informe tiene que tener para siquiera considerarse. */
function formaValida(informe) {
  return !!informe
    && typeof informe === 'object'
    && !Array.isArray(informe)
    && typeof informe.veredicto === 'string'
    && VEREDICTOS.includes(informe.veredicto)
    && typeof informe.contexto === 'object'
    && informe.contexto !== null
    && typeof informe.contexto.sourceSha256 === 'string'
    && /^[0-9a-f]{64}$/.test(informe.contexto.sourceSha256);
}

/**
 * ¿Estos bytes son los que ese informe aprobó?
 *
 * Falla cerrado: cualquier duda —informe malformado, veredicto que no es
 * `approve`, hash distinto— devuelve `ok: false` con el motivo escrito. Nunca
 * lanza: el emisor la llama con lo que el usuario haya elegido, que puede ser
 * cualquier archivo.
 *
 * @param {unknown} informe El JSON del pre-flight, ya parseado.
 * @param {Uint8Array} bytes Los bytes del `.nc` seleccionado.
 * @returns {{ok: boolean, reason: string, resumen: object|null}}
 */
export function validateApproval(informe, bytes) {
  if (!ArrayBuffer.isView(bytes) || bytes.length === 0) {
    return { ok: false, reason: 'no hay archivo seleccionado', resumen: null };
  }
  if (!formaValida(informe)) {
    return {
      ok: false,
      reason: 'Ese JSON no fue creado por Telepatía: le falta el resultado o la huella del archivo.',
      resumen: null,
    };
  }

  const job = informe.job ?? {};
  const resumen = {
    veredicto: informe.veredicto,
    workOrder: job.workOrder ?? null,
    partNumber: job.partNumber ?? null,
    revision: job.revision ?? null,
    programa: informe.contexto?.programa ?? null,
    esperado: informe.contexto.sourceSha256,
    real: sourceHash(bytes),
    motivos: Array.isArray(informe.motivos) ? informe.motivos : [],
  };

  if (informe.veredicto !== 'approve') {
    const detalle = resumen.motivos[0] ? `: ${resumen.motivos[0]}` : '';
    return {
      ok: false,
      reason: informe.veredicto === 'block'
        ? `Telepatía bloqueó este trabajo${detalle}`
        : `Telepatía pidió que una persona lo revise${detalle}`,
      resumen,
    };
  }

  if (resumen.esperado !== resumen.real) {
    return {
      ok: false,
      reason: 'Este no es el archivo que fue aprobado. Aunque el nombre se parezca, su contenido cambió.',
      resumen,
    };
  }

  return { ok: true, reason: 'El programa coincide exactamente con el que Telepatía revisó.', resumen };
}

/** Hash abreviado para mostrar en pantalla sin ocupar un renglón entero. */
export const hashCorto = (h) => (typeof h === 'string' && h.length >= 16
  ? `${h.slice(0, 8)}…${h.slice(-8)}`
  : '—');
