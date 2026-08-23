// Parseo de dinero y fechas tolerante a locale. Utilidad compartida: la usan
// el normalizador de CSV (Bloque A) y la compuerta de grounding (Bloque B).
// No es código de ningún bloque, es vocabulario común.

/**
 * Parsea un monto en es-AR (`1.234,56`) o en-US (`1,234.56`) sin adivinar por
 * locale global: decide por la POSICIÓN del último separador.
 * Acepta paréntesis y sufijo/prefijo `-` como negativo.
 * @returns {number|null} null si no es un monto reconocible.
 */
export function parseMoney(raw) {
  if (typeof raw === 'number') return Number.isFinite(raw) ? raw : null;
  if (typeof raw !== 'string') return null;

  let s = raw.trim()
    .replace(/[\s\u00a0\u202f]/g, '')
    .replace(/(ARS|USD|EUR|\$|€|US\$)/gi, '');
  if (s === '') return null;

  let negative = false;
  if (/^\(.*\)$/.test(s)) { negative = true; s = s.slice(1, -1); }
  if (s.endsWith('-')) { negative = true; s = s.slice(0, -1); }
  if (s.startsWith('-')) { negative = true; s = s.slice(1); }
  if (s.startsWith('+')) s = s.slice(1);

  if (!/^[\d.,]+$/.test(s)) return null;
  if (!/\d/.test(s)) return null;

  const lastDot = s.lastIndexOf('.');
  const lastComma = s.lastIndexOf(',');
  let decimalSep = null;

  if (lastDot >= 0 && lastComma >= 0) {
    decimalSep = lastDot > lastComma ? '.' : ',';
  } else if (lastDot >= 0 || lastComma >= 0) {
    const sep = lastDot >= 0 ? '.' : ',';
    const idx = Math.max(lastDot, lastComma);
    const after = s.length - idx - 1;
    const occurrences = s.split(sep).length - 1;
    // Un separador único seguido de exactamente 3 dígitos es de miles
    // ("1.000" = mil). Con otra cantidad de dígitos, es decimal ("0.5").
    decimalSep = (after === 3 && occurrences === 1) ? null : (after <= 2 ? sep : null);
  }

  let normalized;
  if (decimalSep === null) {
    normalized = s.replace(/[.,]/g, '');
  } else {
    const thousands = decimalSep === '.' ? ',' : '.';
    normalized = s.split(thousands).join('').replace(decimalSep, '.');
  }

  const n = Number(normalized);
  if (!Number.isFinite(n)) return null;
  return negative ? -n : n;
}

/** Todos los montos plausibles dentro de un texto libre (línea de OCR). */
export function findMoney(text) {
  if (typeof text !== 'string') return [];
  const out = [];
  for (const m of text.matchAll(/\(?-?\d[\d.,]*\)?%?/g)) {
    const token = m[0].replace(/%$/, '');
    const value = parseMoney(token);
    if (value !== null) out.push(value);
  }
  return out;
}

/**
 * Normaliza fecha a ISO `YYYY-MM-DD`. Acepta DD/MM/YYYY, YYYY-MM-DD, DD-MM-YY.
 * Ambigüedad DD/MM vs MM/DD: se resuelve como DD/MM (convención es-AR), salvo
 * que el primer campo sea > 12, que la desambigua sola.
 * @returns {string|null}
 */
export function parseDateIso(raw) {
  if (typeof raw !== 'string') return null;
  const s = raw.trim();

  let m = /^(\d{4})-(\d{1,2})-(\d{1,2})$/.exec(s);
  if (m) return iso(+m[1], +m[2], +m[3]);

  m = /^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{2}|\d{4})$/.exec(s);
  if (m) {
    let [, a, b, y] = m;
    let day = +a, month = +b;
    if (day > 12 && month <= 12) { /* DD/MM inequívoco */ }
    else if (month > 12 && day <= 12) { day = +b; month = +a; } // era MM/DD
    let year = +y;
    if (y.length === 2) year += year < 70 ? 2000 : 1900;
    return iso(year, month, day);
  }
  return null;
}

function iso(year, month, day) {
  if (!Number.isInteger(year) || year < 1900 || year > 2200) return null;
  if (!Number.isInteger(month) || month < 1 || month > 12) return null;
  if (!Number.isInteger(day) || day < 1 || day > 31) return null;
  // Rechaza 31/02 y compañía verificando el round-trip.
  const d = new Date(Date.UTC(year, month - 1, day));
  if (d.getUTCFullYear() !== year || d.getUTCMonth() !== month - 1 || d.getUTCDate() !== day) return null;
  return `${String(year).padStart(4, '0')}-${String(month).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
}
