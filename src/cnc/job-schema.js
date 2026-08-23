// Lo que el modelo extrae de los documentos de taller.
//
// Entrada: orden de trabajo y setup sheet, que son PDFs, escaneos o fotos. No
// tienen estructura, y por eso los lee un modelo.
//
// El programa `.nc` NO entra acá: es un lenguaje regular y lo parsea código
// determinista (`src/cnc/gcode.js`). Meter una alucinación en el camino crítico
// para ahorrarse un tokenizador sería un error de diseño.
//
// MISMA REGLA DURA DE SIEMPRE: no hay campo de veredicto. El modelo extrae; si
// el programa se manda a la máquina lo decide código comparando los dos
// conjuntos. Un setup sheet falsificado que diga "aprobado por ingeniería" no
// tiene dónde escribir esa aprobación.

const texto = { type: 'string' };

export const JOB_SCHEMA = {
  type: 'object',
  properties: {
    /** Identificador de la orden de trabajo. Viene del ERP. */
    workOrder: texto,
    /** Número de pieza. */
    partNumber: texto,
    /** Revisión vigente. Una sola letra decide si la pieza va al tacho. */
    revision: texto,
    /** Material del stock, como lo nombra la orden. */
    material: texto,
    /** Cantidad de piezas del lote. */
    quantity: { type: 'number' },
    /** Máquina asignada. */
    machine: texto,
    /** Número de programa esperado (O1837). */
    programNumber: texto,
    /** Offset de trabajo declarado en el setup sheet. */
    workOffset: texto,
    /** Herramientas que el setup sheet dice que hay en el carrusel. */
    tools: { type: 'array', items: texto },
    /** RPM máximas admitidas para este setup. */
    maxSpindleRpm: { type: 'number' },
    /** Avance máximo admitido, mm/min. */
    maxFeedMmMin: { type: 'number' },
  },
  required: [
    'workOrder', 'partNumber', 'revision', 'material', 'machine',
    'programNumber', 'workOffset', 'tools',
  ],
  additionalProperties: false,
};

/**
 * Claves de conclusión que este esquema no puede tener nunca.
 *
 * Un documento de taller que trae `approved: true` está tratando de decidir por
 * el operario. El modelo no tiene dónde ponerlo.
 */
export const FORBIDDEN_JOB_KEYS = [
  'approved', 'status', 'valid', 'isvalid', 'verdict', 'decision', 'ok',
  'recommendation', 'action', 'authorized', 'signedoff', 'safe', 'cleared',
];

/**
 * Valida forma y tipos. Mismo contrato de retorno que los otros validadores del
 * proyecto, para que el harness no tenga que saber de qué dominio se trata.
 *
 * @param {unknown} obj
 * @param {object} [schema]
 * @returns {{ok: boolean, errors: string[]}}
 */
export function validateJob(obj, schema = JOB_SCHEMA) {
  const errors = [];

  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['la raíz no es un objeto'] };
  }

  const propiedades = schema.properties ?? {};

  for (const clave of Object.keys(obj)) {
    if (FORBIDDEN_JOB_KEYS.includes(clave.toLowerCase())) {
      errors.push(`clave de veredicto prohibida "${clave}": el modelo no decide`);
    } else if (!Object.hasOwn(propiedades, clave)) {
      errors.push(`clave no permitida "${clave}"`);
    }
  }

  for (const requerida of schema.required ?? []) {
    if (!Object.hasOwn(obj, requerida)) {
      errors.push(`falta la clave requerida "${requerida}"`);
    } else if (obj[requerida] === null) {
      errors.push(`"${requerida}" es null`);
    }
  }

  for (const [clave, definicion] of Object.entries(propiedades)) {
    if (!Object.hasOwn(obj, clave) || obj[clave] === null) continue;
    const valor = obj[clave];

    if (definicion.type === 'array') {
      if (!Array.isArray(valor)) {
        errors.push(`"${clave}" debería ser un array`);
      } else {
        valor.forEach((item, i) => {
          if (typeof item !== 'string') errors.push(`"${clave}[${i}]" debería ser string`);
        });
      }
      continue;
    }
    if (definicion.type === 'number' && (typeof valor !== 'number' || !Number.isFinite(valor))) {
      errors.push(`"${clave}" debería ser un número finito`);
    }
    if (definicion.type === 'string' && typeof valor !== 'string') {
      errors.push(`"${clave}" debería ser string`);
    }
  }

  return { ok: errors.length === 0, errors };
}

/** Normaliza una revisión a una letra mayúscula, o `null`. */
export const normalizeRevision = (v) => {
  const m = String(v ?? '').toUpperCase().match(/\b(?:REV\.?\s*)?([A-Z])\b/);
  return m ? m[1] : null;
};

/** Normaliza un identificador de herramienta a `T<n>`, o `null`. */
export const normalizeTool = (v) => {
  const m = String(v ?? '').toUpperCase().match(/T\s*0*(\d+)/);
  return m ? `T${Number(m[1])}` : null;
};

/** Normaliza un nombre de máquina para comparar sin castigar el formato. */
export const normalizeMachine = (v) =>
  String(v ?? '').toUpperCase().replace(/[^A-Z0-9]/g, '');
