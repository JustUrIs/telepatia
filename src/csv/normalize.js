// Normalizador de un extracto bancario crudo a `Transaction[]` del contrato.
//
// Regla de oro del módulo: **nada se descarta en silencio**. Toda fila que no
// normaliza sale por `rejected` como un `Failure`, con el motivo escrito. Un
// extracto al que le faltan tres filas sin que nadie se entere es peor que uno
// que falla ruidosamente.

import { FAILURE_CODES, isTransaction } from '../shared/contract.js';

/**
 * Sinónimos de encabezado por campo del contrato.
 *
 * `currency` y `ref` no son decoración: `isTransaction` exige una moneda de 3
 * caracteres, así que sin reconocer la columna de moneda este módulo no puede
 * emitir una sola transacción válida.
 */
const SINONIMOS = {
  date: ['fecha', 'date', 'f. valor', 'f valor', 'fecha valor'],
  description: ['concepto', 'description', 'descripcion', 'detalle'],
  amount: ['importe', 'amount', 'monto'],
  currency: ['moneda', 'currency', 'divisa'],
  ref: ['referencia', 'ref', 'comprobante'],
};

/** Campos sin los cuales no hay `Transaction` posible. */
const OBLIGATORIOS = ['date', 'description', 'amount', 'currency'];

/**
 * Año de dos dígitos: `<70` es 20xx, `>=70` es 19xx.
 * Un extracto bancario no habla de 1969, pero sí de 1999.
 */
const PIVOTE_SIGLO = 70;

/** @param {string} stage @param {string} message */
const rechazo = (message) => ({
  stage: 'csv',
  code: FAILURE_CODES.malformedRow,
  message,
});

/** Encabezado a forma comparable: sin acentos, sin dobles espacios, minúscula. */
function canonizar(texto) {
  return String(texto)
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/**
 * Mapea cada campo del contrato a su índice de columna.
 *
 * @param {string[]} header
 * @returns {Record<string, number>} Solo los campos encontrados.
 */
function mapearColumnas(header) {
  const canon = header.map(canonizar);
  /** @type {Record<string, number>} */ const columnas = {};

  for (const [campo, alias] of Object.entries(SINONIMOS)) {
    const indice = canon.findIndex((celda) => alias.includes(celda));
    if (indice !== -1) columnas[campo] = indice;
  }
  return columnas;
}

/**
 * Fecha de extracto a ISO `YYYY-MM-DD`.
 *
 * Acepta `YYYY-MM-DD`, `DD/MM/YYYY`, `DD-MM-YYYY` y `DD-MM-YY`. Valida que la
 * fecha exista de verdad: `31/02` se rechaza en vez de correrse a marzo.
 *
 * @param {string} texto
 * @returns {string|null}
 */
export function parseFecha(texto) {
  const limpio = String(texto ?? '').trim();

  let anio;
  let mes;
  let dia;

  const iso = limpio.match(/^(\d{4})-(\d{1,2})-(\d{1,2})$/);
  const dmy = limpio.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  const dmyCorto = limpio.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{2})$/);

  if (iso) {
    [, anio, mes, dia] = iso.map(Number);
  } else if (dmy) {
    [, dia, mes, anio] = dmy.map(Number);
  } else if (dmyCorto) {
    [, dia, mes] = dmyCorto.map(Number);
    const corto = Number(dmyCorto[3]);
    anio = corto < PIVOTE_SIGLO ? 2000 + corto : 1900 + corto;
  } else {
    return null;
  }

  // `Date.UTC` no valida: normaliza. Comparar de vuelta es lo que detecta el
  // 31 de febrero, que si no saldría convertido en 3 de marzo.
  const fecha = new Date(Date.UTC(anio, mes - 1, dia));
  if (
    fecha.getUTCFullYear() !== anio
    || fecha.getUTCMonth() !== mes - 1
    || fecha.getUTCDate() !== dia
  ) {
    return null;
  }

  const dd = String(dia).padStart(2, '0');
  const mm = String(mes).padStart(2, '0');
  return `${anio}-${mm}-${dd}`;
}

/**
 * Monto de extracto a número.
 *
 * El separador decimal se decide **por la posición del último separador**, no
 * por un locale global: en el mismo archivo conviven `421.820,52` y
 * `1,234.56`. Cuando aparece un solo tipo de separador una sola vez y lo siguen
 * exactamente tres dígitos, se lo toma como separador de miles — `1.000` es mil
 * pesos, no un peso.
 *
 * Paréntesis y menos, adelante o atrás, significan negativo.
 *
 * @param {string} texto
 * @returns {number|null}
 */
export function parseMonto(texto) {
  const bruto = String(texto ?? '').trim();
  if (bruto === '') return null;

  const negativo = /^\(.*\)$/.test(bruto) || /^-/.test(bruto) || /-$/.test(bruto);

  // Fuera espacios, marcas de signo ya leídas, y el token de moneda que muchos
  // bancos pegan adelante o atrás (`ARS 1.284.500,00`, `47.412,00 USD`).
  // Solo se recorta en los extremos: basura en el medio tiene que fallar.
  const limpio = bruto
    .replace(/[()\s ]/g, '')
    .replace(/^-|-$/g, '')
    .replace(/^[^\d]+/, '')
    .replace(/[^\d]+$/, '');
  if (limpio === '' || !/^[\d.,]+$/.test(limpio)) return null;

  const puntos = (limpio.match(/\./g) ?? []).length;
  const comas = (limpio.match(/,/g) ?? []).length;

  let decimal = null;
  if (puntos > 0 && comas > 0) {
    decimal = limpio.lastIndexOf('.') > limpio.lastIndexOf(',') ? '.' : ',';
  } else if (puntos + comas > 0) {
    const sep = puntos > 0 ? '.' : ',';
    const veces = puntos + comas;
    const digitosDetras = limpio.length - limpio.lastIndexOf(sep) - 1;
    if (veces === 1 && digitosDetras !== 3) decimal = sep;
  }

  // Sin separador decimal, TODO lo que hay es de miles: `1.000` es mil.
  let canonico;
  if (decimal === null) {
    canonico = limpio.replace(/[.,]/g, '');
  } else {
    const miles = decimal === '.' ? ',' : '.';
    canonico = limpio.split(miles).join('').replace(decimal, '.');
  }

  // Un `1,2,3.4.5` deja separadores de más y no es un número.
  if (!/^\d+(\.\d+)?$/.test(canonico)) return null;

  const valor = Number(canonico);
  if (!Number.isFinite(valor)) return null;
  return negativo ? -valor : valor;
}

/** Moneda a ISO de 3 letras mayúsculas, o `null`. */
export function parseMoneda(texto) {
  const limpio = String(texto ?? '').trim().toUpperCase();
  return /^[A-Z]{3}$/.test(limpio) ? limpio : null;
}

/**
 * Convierte las filas crudas de `parseCsv` en transacciones del contrato.
 *
 * @param {string[][]} rows Con el encabezado en `rows[0]`.
 * @returns {{transactions: import('../shared/contract.js').Transaction[], rejected: object[]}}
 */
export function normalize(rows) {
  if (!Array.isArray(rows)) throw new TypeError('normalize espera las filas de parseCsv');
  if (rows.length === 0) return { transactions: [], rejected: [] };

  const [header, ...datos] = rows;
  if (!Array.isArray(header)) throw new TypeError('normalize espera las filas de parseCsv');

  const columnas = mapearColumnas(header);
  const faltantes = OBLIGATORIOS.filter((campo) => columnas[campo] === undefined);

  const transactions = [];
  const rejected = [];

  // Sin una columna obligatoria no se inventa nada: caen todas las filas, cada
  // una con su motivo, para que el conteo siga cerrando aguas arriba.
  if (faltantes.length > 0) {
    const motivo = `el extracto no trae columna de ${faltantes.join(', ')}`;
    for (const fila of datos) {
      rejected.push(rechazo(`${motivo}: fila ${JSON.stringify(fila.join(' | '))} descartada`));
    }
    return { transactions, rejected };
  }

  for (const fila of datos) {
    const celda = (campo) => fila[columnas[campo]];
    const resumen = JSON.stringify(fila.join(' | '));

    if (fila.length <= Math.max(...OBLIGATORIOS.map((c) => columnas[c]))) {
      rejected.push(rechazo(`fila con menos columnas que el encabezado: ${resumen}`));
      continue;
    }

    const date = parseFecha(celda('date'));
    if (date === null) {
      rejected.push(rechazo(`fecha ilegible ${JSON.stringify(celda('date'))} en ${resumen}`));
      continue;
    }

    const amount = parseMonto(celda('amount'));
    if (amount === null) {
      rejected.push(rechazo(`importe ilegible ${JSON.stringify(celda('amount'))} en ${resumen}`));
      continue;
    }

    const currency = parseMoneda(celda('currency'));
    if (currency === null) {
      rejected.push(rechazo(`moneda ilegible ${JSON.stringify(celda('currency'))} en ${resumen}`));
      continue;
    }

    /** @type {import('../shared/contract.js').Transaction} */
    const tx = { date, description: String(celda('description') ?? '').trim(), amount, currency };

    // `ref` es opcional en el contrato: sin columna, la clave no existe.
    if (columnas.ref !== undefined) {
      const ref = String(fila[columnas.ref] ?? '').trim();
      if (ref !== '') tx.ref = ref;
    }

    if (!isTransaction(tx)) {
      rejected.push(rechazo(`fila normalizada pero invalida segun el contrato: ${resumen}`));
      continue;
    }
    transactions.push(tx);
  }

  return { transactions, rejected };
}
