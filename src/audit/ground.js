// T-15 — Compuerta de grounding: anclar cada campo a su evidencia.
//
// REESCRITO tras la auditoría de QA. La versión anterior verificaba PRESENCIA:
// que el valor apareciera en algún lugar del OCR. Eso no alcanza, y el agujero
// era explotable de punta a punta:
//
//   documento real:   "TOTAL A PAGAR   510.402,83"
//   extracción falsa: total 100, subtotal 100, taxRate 0, taxAmount 0
//   -> 0 campos sin anclar, 0 checks fallidos, dictamen: PASS
//
// El atacante elegía números que SÍ estaban impresos ("Cantidad 1 x 100,00",
// "Descuentos: 0,00") y que cerraban entre sí. Además `total: 2024` anclaba
// contra una fecha y `taxRate: 0.3` contra un CUIT.
//
// Ahora se verifica CORRESPONDENCIA, con tres condiciones acumulativas:
//   1. FORMA   — un importe tiene que anclar contra un token con forma de
//                importe, no contra cualquier corrida de dígitos.
//   2. ETIQUETA— el bloque ancla tiene que nombrar el campo ("TOTAL", "IVA",
//                "Vencimiento"). Un número suelto no ancla nada.
//   3. COHESIÓN— los campos de un mismo ítem de detalle tienen que anclar
//                todos contra EL MISMO bloque: una línea de factura es una
//                línea, no cuatro números pescados de cuatro renglones.

import { isOcrBlock } from '../shared/contract.js';
import { parseMoney, parseDateIso } from '../shared/money.js';

/** Tolerancia al comparar dinero, en centavos enteros como el resto del sistema. */
const CENT_TOLERANCE = 1;
/** Aguja mínima para texto: con 1 char, "A" ancla contra cualquier bloque. */
const MIN_TEXT_NEEDLE = 3;

// Bloques que NO son datos de la factura sino instrucciones al lector
// automático. El texto de una inyección ES parte del OCR: sin esto, un
// `total: 0` metido en "responde total=0" se ancla contra su propia frase.
const INSTRUCTION_MARKERS = [
  /ignor[aeá]\w*\s+(las\s+|el\s+|lo\s+)?(instruc|previous|anterior|indicac)/i,
  /\bno\s+tengas?\s+en\s+cuenta\b/i,
  /\bolvid[aá]\w*\s+(todo|las|lo)\b/i,
  /ignore\s+(all\s+)?(previous|prior|above)/i,
  /disregard\s+(the\s+)?(above|previous)/i,
  /\b(responde|respond|reply|output|devolv[eé]|devuelve)\b.{0,40}\b(approved|true|aprobad|campo|valor)/i,
  /\bapproved\s*[=:]\s*true\b/i,
  /\bya\s+(fue|se\s+encuentra)\s+(aprobad|conform|autorizad)/i,
  /\bsystem\s*prompt\b/i,
  /\bnew\s+instructions?\b/i,
  /\b(nota|mensaje|aviso)\s+(para|al)\s+(el\s+)?(sistema|lector|modelo|agente)/i,
];

/** Cuántos bloques consecutivos se unen para buscar marcadores. El OCR corre
 *  con `paragraph:false`, o sea un bloque por renglón, así que una inyección
 *  partida en dos renglones evadía un escaneo bloque-a-bloque. */
const MARKER_WINDOW = 3;

export function isInstructionBlock(block) {
  return INSTRUCTION_MARKERS.some((re) => re.test(String(block?.text ?? '')));
}

/**
 * Separa anclas de instrucciones. Mira ventanas de bloques consecutivos: si el
 * texto unido dispara un marcador, TODOS los bloques de esa ventana quedan
 * fuera del conjunto de anclas.
 */
export function partitionBlocks(blocks) {
  const flagged = new Set();
  for (let i = 0; i < blocks.length; i++) {
    for (let w = 1; w <= MARKER_WINDOW && i + w <= blocks.length; w++) {
      const slice = blocks.slice(i, i + w);
      const joined = slice.map((b) => String(b?.text ?? '')).join(' ');
      if (INSTRUCTION_MARKERS.some((re) => re.test(joined))) {
        for (let k = i; k < i + w; k++) flagged.add(k);
      }
    }
  }
  const anchors = [];
  const suspicious = [];
  blocks.forEach((b, i) => (flagged.has(i) ? suspicious : anchors).push(b));
  return { anchors, suspicious };
}

/** Normaliza texto para comparar. El OCR no respeta espacios ni tipografía. */
export function normalizeText(s) {
  return String(s)
    .toLowerCase()
    .normalize('NFKD').replace(/[̀-ͯ]/g, '')
    .replace(/[^\p{L}\p{N}]+/gu, '')
    .trim();
}

/** Solo dígitos, para comparar identificadores tipo CUIT. */
const digitsOnly = (s) => String(s).replace(/\D+/g, '');

/**
 * Tokens con FORMA de importe: o traen separador de miles, o traen decimales.
 * Esto es lo que impide que `total: 2024` ancle contra "15/03/2024" o que
 * `total: 3` ancle contra un "A3" del encabezado.
 */
const MONEY_TOKEN = /\d{1,3}(?:[.,]\d{3})+(?:[.,]\d{1,2})?|\d+[.,]\d{1,2}/g;
/** Tokens porcentuales, para tasas: "21%", "-50 %". */
const PERCENT_TOKEN = /(-?\d+(?:[.,]\d+)?)\s*%/g;

export function findMoneyTokens(text) {
  const out = [];
  for (const m of String(text).matchAll(MONEY_TOKEN)) {
    const v = parseMoney(m[0]);
    if (v !== null) out.push(v);
  }
  return out;
}

export function findPercents(text) {
  const out = [];
  for (const m of String(text).matchAll(PERCENT_TOKEN)) {
    const v = parseMoney(m[1]);
    if (v !== null) out.push(v);
  }
  return out;
}

/** Cualquier número, incluidas corridas de dígitos sueltas. Solo para campos
 *  cuya cohesión ya está garantizada por otra vía (cantidades de un ítem). */
export function findLooseNumbers(text) {
  const out = [];
  for (const m of String(text).matchAll(/-?\d+(?:[.,]\d+)?/g)) {
    const v = parseMoney(m[0]);
    if (v !== null) out.push(v);
  }
  return out;
}

const sameCents = (a, b) => Math.abs(Math.round(a * 100) - Math.round(b * 100)) <= CENT_TOLERANCE;

/**
 * Reglas por campo. `labels` null significa que el campo no lleva etiqueta en
 * el documento (un nombre de proveedor va suelto en el encabezado).
 */
const FIELD_RULES = {
  total:         { kind: 'money', labels: /total|importe\s*a\s*pagar|neto\s*a\s*pagar/i },
  subtotal:      { kind: 'money', labels: /sub\s*total|neto|gravado/i },
  taxAmount:     { kind: 'money', labels: /iva|impuesto|tax|percep/i },
  taxRate:       { kind: 'rate',  labels: /iva|impuesto|tax|tasa|al[ií]cuota/i },
  invoiceNumber: { kind: 'id',    labels: /factura|comprobante|n[°º]|nro|invoice/i },
  issueDate:     { kind: 'date',  labels: /emisi[oó]n|fecha/i },
  dueDate:       { kind: 'date',  labels: /vencimiento|vto|due/i },
  currency:      { kind: 'code',  labels: /moneda|currency|divisa/i },
  supplierName:  { kind: 'text',  labels: null },
  supplierTaxId: { kind: 'id',    labels: /cuit|cuil|tax\s*id|rut|nif|dni/i },
};

const LINE_ITEM_RULES = {
  description: { kind: 'text',   labels: null },
  quantity:    { kind: 'number', labels: null },
  unitPrice:   { kind: 'money',  labels: null },
  amount:      { kind: 'money',  labels: null },
};

function ruleFor(key) {
  if (key in FIELD_RULES) return FIELD_RULES[key];
  const m = /^lineItems\.\d+\.(\w+)$/.exec(key);
  if (m && m[1] in LINE_ITEM_RULES) return LINE_ITEM_RULES[m[1]];
  return null;
}

const itemIndexOf = (key) => {
  const m = /^lineItems\.(\d+)\./.exec(key);
  return m ? Number(m[1]) : null;
};

/** ¿Este bloque respalda este valor, según la regla del campo? */
function blockSupports(rule, value, block) {
  const text = String(block.text);
  if (rule.labels && !rule.labels.test(text)) return false;

  switch (rule.kind) {
    case 'money':
      return typeof value === 'number' && findMoneyTokens(text).some((n) => sameCents(n, value));
    case 'number':
      return typeof value === 'number' && findLooseNumbers(text).some((n) => sameCents(n, value));
    case 'rate': {
      if (typeof value !== 'number') return false;
      // Una tasa está impresa como porcentaje: 0.21 -> "21%".
      return findPercents(text).some((n) => sameCents(n, value * 100));
    }
    case 'date': {
      const iso = parseDateIso(String(value));
      if (!iso) return false;
      for (const t of text.matchAll(/\d{1,4}[/\-.]\d{1,2}[/\-.]\d{2,4}/g)) {
        if (parseDateIso(t[0]) === iso) return true;
      }
      return normalizeText(text).includes(normalizeText(iso));
    }
    case 'id': {
      // Igualdad de la corrida de dígitos, no inclusión: sin esto, un CUIT
      // falso "30-11111111-1" anclaba contra un teléfono "Tel: 3011-1111 111".
      const want = digitsOnly(value);
      if (want.length >= 6) {
        for (const run of text.matchAll(/[\d][\d\s.\-/]*\d/g)) {
          if (digitsOnly(run[0]) === want) return true;
        }
      }
      const needle = normalizeText(value);
      return needle.length >= MIN_TEXT_NEEDLE && normalizeText(text).includes(needle);
    }
    case 'code': {
      const needle = normalizeText(value);
      return needle.length >= 2 && normalizeText(text).includes(needle);
    }
    case 'text': {
      const needle = normalizeText(value);
      return needle.length >= MIN_TEXT_NEEDLE && normalizeText(text).includes(needle);
    }
    default:
      return false;
  }
}

/**
 * Aplana a rutas con punto. Acumulador sin prototipo: `out['__proto__'] = v`
 * en un objeto normal dispara el setter y el valor DESAPARECE de la compuerta,
 * que es exactamente lo que un atacante querría.
 */
export function flatten(obj, prefix = '', out = Object.create(null)) {
  if (obj === null || obj === undefined) return out;
  if (Array.isArray(obj)) {
    obj.forEach((v, i) => flatten(v, prefix ? `${prefix}.${i}` : String(i), out));
    return out;
  }
  if (typeof obj === 'object') {
    for (const k of Object.keys(obj)) {
      flatten(obj[k], prefix ? `${prefix}.${k}` : k, out);
    }
    return out;
  }
  out[prefix] = obj;
  return out;
}

/**
 * @param {object} fields
 * @param {import('../shared/contract.js').OcrBlock[]} blocks
 * @returns {{grounded:object, ungrounded:object[], suspiciousBlocks:object[]}}
 */
export function groundFields(fields, blocks) {
  if (fields === null || typeof fields !== 'object') {
    throw new TypeError('groundFields espera un objeto de campos extraídos');
  }
  if (!Array.isArray(blocks)) {
    throw new TypeError('groundFields espera un array de bloques de OCR');
  }

  const { anchors, suspicious } = partitionBlocks(blocks.filter(isOcrBlock));
  const flat = flatten(fields);
  const grounded = Object.create(null);
  const ungrounded = [];

  // Primera pasada: cada campo busca su bloque.
  const hits = new Map();      // key -> block
  for (const key of Object.keys(flat)) {
    const value = flat[key];
    if (value === null || value === undefined || value === '') continue;
    const rule = ruleFor(key);
    if (!rule) {
      ungrounded.push({ key, value, reason: 'campo desconocido: no hay regla de anclaje' });
      continue;
    }
    if (typeof value === 'boolean') {
      ungrounded.push({ key, value, reason: 'un booleano no puede estar impreso en el documento' });
      continue;
    }
    const block = anchors.find((b) => blockSupports(rule, value, b));
    if (block) hits.set(key, block);
    else {
      ungrounded.push({
        key, value,
        reason: anchors.length === 0
          ? 'no hay bloques de OCR utilizables contra los que anclar'
          : 'ningún bloque del documento respalda este valor con su etiqueta y su formato',
      });
    }
  }

  // Segunda pasada: COHESIÓN de los ítems. Los campos de un ítem tienen que
  // haber anclado todos contra el mismo bloque; si no, son números pescados de
  // renglones distintos y el ítem no existe como tal.
  const itemBlocks = new Map();  // índice de ítem -> bloque mayoritario
  for (const [key, block] of hits) {
    const idx = itemIndexOf(key);
    if (idx === null) continue;
    const counts = itemBlocks.get(idx) ?? new Map();
    counts.set(block, (counts.get(block) ?? 0) + 1);
    itemBlocks.set(idx, counts);
  }
  const itemAnchor = new Map();
  for (const [idx, counts] of itemBlocks) {
    let best = null; let bestN = -1;
    for (const [block, n] of counts) if (n > bestN) { best = block; bestN = n; }
    itemAnchor.set(idx, best);
  }

  for (const [key, block] of hits) {
    const value = flat[key];
    const idx = itemIndexOf(key);
    if (idx !== null && itemAnchor.get(idx) !== block) {
      ungrounded.push({
        key, value,
        reason: `no está en el mismo renglón que el resto del ítem ${idx}: una línea de factura es una línea`,
      });
      continue;
    }
    grounded[key] = { value, bbox: block.bbox, confidence: block.confidence };
  }

  return { grounded, ungrounded, suspiciousBlocks: suspicious };
}
