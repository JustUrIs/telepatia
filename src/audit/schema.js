// T-14 — Schema de factura y validador.
//
// La gramática del SDK solo fuerza las claves que declares, así que `required`
// y `additionalProperties:false` son load-bearing, no adorno.
//
// REGLA DURA: no hay campo de veredicto. Ni `approved`, ni `status`, ni
// `isValid`. El modelo extrae; el veredicto lo calcula código determinista
// (T-16/T-18). Si algún día alguien agrega un campo de conclusión acá, el test
// de T-14 lo rechaza.

const money = { type: 'number' };
const text = { type: 'string' };

export const INVOICE_SCHEMA = {
  type: 'object',
  properties: {
    invoiceNumber: text,
    issueDate: text,
    dueDate: text,
    supplierName: text,
    supplierTaxId: text,
    currency: { type: 'string' },
    lineItems: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: text,
          quantity: { type: 'number' },
          unitPrice: money,
          amount: money,
        },
        required: ['description', 'quantity', 'unitPrice', 'amount'],
        additionalProperties: false,
      },
    },
    subtotal: money,
    taxRate: { type: 'number' },
    taxAmount: money,
    total: money,
  },
  required: [
    'invoiceNumber', 'issueDate', 'dueDate', 'supplierName', 'supplierTaxId',
    'currency', 'lineItems', 'subtotal', 'taxRate', 'taxAmount', 'total',
  ],
  additionalProperties: false,
};

/** Términos que delatan un campo de conclusión colándose al schema. */
export const FORBIDDEN_KEYS = ['approved', 'status', 'isvalid', 'valid', 'verdict', 'decision', 'ok'];

/**
 * Validador de tipos propio, sin dependencias. No valida el JSON Schema
 * completo: valida ESTE schema, que es lo que necesitamos.
 * @returns {{ok:boolean, errors:string[]}}
 */
export function validateInvoice(obj, schema = INVOICE_SCHEMA) {
  const errors = [];
  if (obj === null || typeof obj !== 'object' || Array.isArray(obj)) {
    return { ok: false, errors: ['la raíz no es un objeto'] };
  }
  const props = schema.properties ?? {};

  for (const key of schema.required ?? []) {
    if (!(key in obj)) errors.push(`falta la clave requerida "${key}"`);
  }
  if (schema.additionalProperties === false) {
    for (const key of Object.keys(obj)) {
      if (!(key in props)) errors.push(`clave no permitida "${key}"`);
    }
  }

  for (const [key, spec] of Object.entries(props)) {
    if (!(key in obj)) continue;
    const value = obj[key];
    if (value === null) { errors.push(`"${key}" es null`); continue; }
    if (spec.type === 'string' && typeof value !== 'string') {
      errors.push(`"${key}" debería ser string, es ${typeof value}`);
    } else if (spec.type === 'number') {
      if (typeof value !== 'number' || !Number.isFinite(value)) {
        errors.push(`"${key}" debería ser number finito, es ${typeof value === 'number' ? value : typeof value}`);
      }
    } else if (spec.type === 'array') {
      if (!Array.isArray(value)) { errors.push(`"${key}" debería ser array`); continue; }
      value.forEach((item, i) => {
        const sub = validateInvoice(item, spec.items);
        for (const e of sub.errors) errors.push(`${key}[${i}]: ${e}`);
      });
    }
  }
  return { ok: errors.length === 0, errors };
}

/** Todas las claves del schema, aplanadas a rutas con punto. */
export function schemaKeys(schema = INVOICE_SCHEMA, prefix = '') {
  const out = [];
  for (const [key, spec] of Object.entries(schema.properties ?? {})) {
    const path = prefix ? `${prefix}.${key}` : key;
    out.push(path);
    if (spec.type === 'array' && spec.items?.properties) {
      out.push(...schemaKeys(spec.items, `${path}[]`));
    }
  }
  return out;
}
