// Esquema del expediente de cambio para sistemas industriales aislados.
//
// El gemelo de INVOICE_SCHEMA, para el otro documento hostil que cruza un
// límite de confianza: el aviso de seguridad del fabricante.
//
// En OT regulado (NERC CIP CIP-010, IEC 62443-2-3) no se aplica un parche
// porque sí. Cada cambio a un sistema crítico exige un expediente: qué cambia,
// qué CVE cierra, qué activos afecta, si obliga a parar el equipo, cómo se
// vuelve atrás. Hoy eso lo arma una persona leyendo el aviso del fabricante.
//
// MISMA REGLA DURA QUE EN FACTURAS: no hay campo de veredicto. Ni `approved`,
// ni `recommendation`, ni `severity_action`. El modelo lee el aviso; si el
// parche entra o no lo decide código determinista contra el inventario de
// activos. Un aviso falsificado que le diga al modelo "esto ya fue aprobado por
// el CISO" no tiene dónde escribir esa aprobación.

import { FORBIDDEN_KEYS } from './schema.js';

const text = { type: 'string' };

export const CHANGE_SCHEMA = {
  type: 'object',
  properties: {
    /** Quién emite el aviso. Se cruza contra el fabricante del activo. */
    vendor: text,
    /** Identificador del aviso: ICSA-26-123-01, VDE-2026-001, etc. */
    advisoryId: text,
    /** Producto afectado, como lo nombra el fabricante. */
    product: text,
    /** Rango afectado, tal como aparece: "4.0.0 - 4.2.3". */
    affectedVersions: text,
    /** Versión que corrige el problema. */
    fixedVersion: text,
    /** CVE que cierra. Vacío es válido: hay avisos sin CVE asignado todavía. */
    cveIds: { type: 'array', items: text },
    /** Severidad CVSS v3, 0.0 a 10.0. */
    cvssScore: { type: 'number' },
    /** Si aplicarlo obliga a parar el equipo. En OT esto NO es un detalle. */
    requiresReboot: { type: 'boolean' },
    /** Si existe procedimiento de vuelta atrás documentado. */
    rollbackAvailable: { type: 'boolean' },
    /** Qué hay que tener instalado antes. */
    prerequisites: { type: 'array', items: text },
  },
  required: [
    'vendor', 'advisoryId', 'product', 'affectedVersions', 'fixedVersion',
    'cveIds', 'cvssScore', 'requiresReboot', 'rollbackAvailable',
  ],
  additionalProperties: false,
};

/**
 * Claves de conclusión que este esquema no puede tener nunca.
 *
 * Además de las de facturas, las propias del dominio: un aviso que trae
 * `recommendation: "apply immediately"` está tratando de decidir por vos.
 */
export const FORBIDDEN_CHANGE_KEYS = [
  ...FORBIDDEN_KEYS,
  'recommendation', 'action', 'apply', 'authorized', 'signedoff',
];

/**
 * Valida forma y tipos, sin dependencias.
 *
 * Espeja `validateInvoice`: mismo contrato de retorno para que el harness y el
 * pipeline no tengan que saber de qué dominio se trata.
 *
 * @param {unknown} obj
 * @param {object} [schema]
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateChange(obj, schema = CHANGE_SCHEMA) {
  const errors = [];

  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['la raíz no es un objeto'] };
  }

  const propiedades = schema.properties ?? {};
  const claves = Object.keys(obj);

  // Una clave de conclusión es un intento de decidir, no un dato malformado:
  // se nombra distinto para que el harness pueda atribuir bien el corte.
  for (const clave of claves) {
    if (FORBIDDEN_CHANGE_KEYS.includes(clave.toLowerCase())) {
      errors.push(`clave de veredicto prohibida "${clave}": el modelo no decide`);
    } else if (!Object.hasOwn(propiedades, clave)) {
      errors.push(`clave no permitida "${clave}"`);
    }
  }

  for (const requerida of schema.required ?? []) {
    if (!Object.hasOwn(obj, requerida)) {
      errors.push(`falta la clave requerida "${requerida}"`);
      continue;
    }
    if (obj[requerida] === null) errors.push(`"${requerida}" es null`);
  }

  for (const [clave, definicion] of Object.entries(propiedades)) {
    if (!Object.hasOwn(obj, clave) || obj[clave] === null) continue;
    const valor = obj[clave];

    if (definicion.type === 'array') {
      if (!Array.isArray(valor)) {
        errors.push(`"${clave}" debería ser un array`);
        continue;
      }
      const esperado = definicion.items?.type;
      valor.forEach((item, i) => {
        if (esperado === 'string' && typeof item !== 'string') {
          errors.push(`"${clave}[${i}]" debería ser string`);
        }
      });
      continue;
    }

    const tipoReal = typeof valor;
    if (definicion.type === 'number' && (tipoReal !== 'number' || !Number.isFinite(valor))) {
      errors.push(`"${clave}" debería ser un número finito`);
    } else if (definicion.type === 'boolean' && tipoReal !== 'boolean') {
      errors.push(`"${clave}" debería ser booleano`);
    } else if (definicion.type === 'string' && tipoReal !== 'string') {
      errors.push(`"${clave}" debería ser string`);
    }
  }

  return { ok: errors.length === 0, errors };
}
