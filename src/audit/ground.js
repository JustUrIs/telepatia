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
  const text = (i) => String(blocks[i]?.text ?? '');
  const matches = (from, len) => {
    const joined = [];
    for (let k = from; k < from + len; k++) joined.push(text(k));
    const s = joined.join(' ');
    return INSTRUCTION_MARKERS.some((re) => re.test(s));
  };

  const flagged = new Set();
  for (let i = 0; i < blocks.length; i++) {
    for (let w = 1; w <= MARKER_WINDOW && i + w <= blocks.length; w++) {
      if (!matches(i, w)) continue;
      // ENCOGER AL MÍNIMO. Sin esto la ventana arrastra vecinos legítimos: en la
      // factura de prueba, "Moneda: ARS" quedaba marcado como sospechoso solo
      // por estar pegado a la inyección, y con él se iban los renglones de
      // detalle. Un filtro que se come datos buenos es peor que no tenerlo.
      let from = i;
      let len = w;
      while (len > 1 && matches(from + 1, len - 1)) { from++; len--; }
      while (len > 1 && matches(from, len - 1)) { len--; }
      for (let k = from; k < from + len; k++) flagged.add(k);
      break; // la ventana mínima desde `i` ya está registrada
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

  const keys = Object.keys(flat);
  const usable = [];
  for (const key of keys) {
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
    usable.push({ key, value, rule, item: itemIndexOf(key) });
  }

  const noAnchor = (key, value) => ungrounded.push({
    key, value,
    reason: anchors.length === 0
      ? 'no hay bloques de OCR utilizables contra los que anclar'
      : 'ningún bloque del documento respalda este valor con su etiqueta y su formato',
  });

  // ---- Campos de nivel superior: cada uno busca su bloque por etiqueta.
  for (const f of usable.filter((x) => x.item === null)) {
    const block = anchors.find((b) => blockSupports(f.rule, f.value, b));
    if (block) grounded[f.key] = { value: f.value, bbox: block.bbox, confidence: block.confidence };
    else noAnchor(f.key, f.value);
  }

  // ---- Ítems de detalle, en DOS fases. El orden importa: `quantity` es un
  // número suelto sin etiqueta ("2"), así que buscándolo primero ancla contra
  // el "02" de "Vencimiento: 02/09/2026" y arrastra al ítem entero. Primero se
  // fija el RENGLÓN del ítem con sus campos específicos (importes y
  // descripción, que traen formato propio), y después los sueltos se buscan
  // SOLO dentro de ese renglón.
  const SPECIFIC = new Set(['money', 'text']);
  const byItem = new Map();
  for (const f of usable.filter((x) => x.item !== null)) {
    if (!byItem.has(f.item)) byItem.set(f.item, []);
    byItem.get(f.item).push(f);
  }

  for (const [idx, fields] of byItem) {
    // Fase 1: el renglón del ítem es el bloque que respalda más campos específicos.
    const votes = new Map();
    for (const f of fields.filter((x) => SPECIFIC.has(x.rule.kind))) {
      for (const b of anchors) {
        if (blockSupports(f.rule, f.value, b)) { votes.set(b, (votes.get(b) ?? 0) + 1); break; }
      }
    }
    let anchor = null; let bestN = 0;
    for (const [b, n] of votes) if (n > bestN) { anchor = b; bestN = n; }

    if (!anchor) {
      for (const f of fields) noAnchor(f.key, f.value);
      continue;
    }

    // Fase 2: todo campo del ítem tiene que estar en ESE renglón.
    for (const f of fields) {
      if (blockSupports(f.rule, f.value, anchor)) {
        grounded[f.key] = { value: f.value, bbox: anchor.bbox, confidence: anchor.confidence };
      } else {
        ungrounded.push({
          key: f.key, value: f.value,
          reason: `no está en el renglón del ítem ${idx}: una línea de factura es una línea`,
        });
      }
    }
  }

  return { grounded, ungrounded, suspiciousBlocks: suspicious };
}
