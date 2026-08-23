// T-18 — Ensamblador de dictamen y ledger de duplicados.
//
// Las reglas viven acá, en código, y en ningún prompt. El modelo no tiene
// acceso a la variable del veredicto: eso es lo que hace que una inyección de
// prompt exitosa siga sin poder aprobar una factura.

import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname } from 'node:path';
import { LEDGER_PATH, isVerdict, runPaths, docIdHex } from '../shared/contract.js';

/** Lee el ledger tolerando ausencia y corrupción. Nunca lanza. */
export function readLedger(path = LEDGER_PATH) {
  let raw;
  try {
    raw = readFileSync(path, 'utf8');
  } catch {
    return { entries: Object.create(null), readable: true }; // no existe: primera corrida
  }
  try {
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) {
      return { entries: Object.create(null), readable: false };
    }
    // Sin prototipo: una clave "__proto__" en el archivo no debe tocar
    // Object.prototype al copiarla.
    const entries = Object.create(null);
    for (const k of Object.keys(parsed)) entries[k] = parsed[k];
    return { entries, readable: true };
  } catch {
    // EXISTE pero no se puede leer. Fail-CLOSED: un ledger truncado por una
    // escritura interrumpida hacía que una factura ya aprobada volviera a
    // pasar. No saber si es duplicada no es lo mismo que saber que no lo es.
    return { entries: Object.create(null), readable: false };
  }
}

/** Clave canónica del ledger. Sin esto, `INV-001`, `inv-001` y `INV-001 ` eran
 *  tres facturas distintas: doble pago con un espacio de diferencia. */
export const ledgerKey = (invoiceNumber) =>
  String(invoiceNumber).toUpperCase().replace(/[^A-Z0-9]/g, '');

function writeLedger(ledger, path) {
  try {
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, JSON.stringify(ledger, null, 2) + '\n');
    return true;
  } catch {
    return false;
  }
}

/**
 * `persist` gobierna el artefacto `runs/<id>/verdict.json`. El registro en el
 * ledger de duplicados va aparte, en `persistLedger`, porque son dos decisiones
 * distintas: el pipeline apaga el artefacto (lo escribe él al final, ya
 * enriquecido con la explicación) pero SÍ tiene que registrar la factura. Con
 * un solo flag, apagar el artefacto apagaba también el ledger y el check de
 * duplicado no podía dispararse nunca por el camino del pipeline.
 *
 * @param {{checks:any[], ungrounded:any[], matched:any, invoiceNumber?:string,
 *          docId?:number|string, ledgerPath?:string, now?:string,
 *          persist?:boolean, persistLedger?:boolean, explanation?:string|null}} input
 * @returns {import('../shared/contract.js').Verdict & {explanation?:string|null}}
 */
export function buildVerdict(input) {
  const {
    checks = [], ungrounded = [], matched = null,
    invoiceNumber, docId, ledgerPath = LEDGER_PATH,
    now = new Date().toISOString(), persist = true, explanation = null,
  } = input ?? {};
  // Por defecto sigue a `persist`: quien no sepa de esta distinción no cambia
  // de comportamiento.
  const persistLedger = input?.persistLedger ?? persist;

  if (!Array.isArray(checks)) throw new TypeError('buildVerdict espera checks[]');
  if (!Array.isArray(ungrounded)) throw new TypeError('buildVerdict espera ungrounded[]');

  const all = [...checks];

  // ---- Check de duplicado, contra el ledger local.
  const { entries: ledger, readable } = readLedger(ledgerPath);
  const key = typeof invoiceNumber === 'string' && invoiceNumber.trim() !== ''
    ? ledgerKey(invoiceNumber) : null;
  if (key !== null && key !== '') {
    const prior = Object.hasOwn(ledger, key) ? ledger[key] : null;
    all.push({
      id: 'invoice_not_duplicate',
      ok: readable && !prior,
      expected: 'no vista antes',
      actual: !readable ? 'ledger ilegible: no se puede descartar un duplicado'
        : prior ? `ya vista el ${prior.seenAt} (docId ${prior.docId})` : 'primera vez',
      evidence: [],
      ...(readable ? {} : { note: 'un ledger corrupto no abre la puerta: fail-closed' }),
    });
  } else {
    all.push({
      id: 'invoice_not_duplicate',
      ok: false,
      expected: 'número de factura anclado',
      actual: null,
      evidence: [],
      note: 'sin número de factura no se puede descartar un duplicado',
    });
  }

  // ---- Reglas del dictamen. En este orden, y sin excepciones.
  // Un check malformado (sin `ok`, o con `ok:'true'`) cuenta como FALLO, no
  // hace lanzar: antes la excepción salía por runPipeline sin métricas.
  for (const c of all) if (typeof c?.ok !== 'boolean') { c.ok = false; c.note = (c.note ?? '') + ' [check malformado]'; }
  const failed = all.filter((c) => c.ok !== true);
  let verdict;
  if (failed.length > 0) verdict = 'fail';
  else if (ungrounded.length > 0 || matched === null) verdict = 'review';
  else verdict = 'pass';

  const result = { verdict, checks: all, ungrounded, matched };
  if (explanation !== undefined) result.explanation = explanation;

  if (!isVerdict(result)) {
    throw new Error('buildVerdict produjo algo que no cumple el contrato Verdict');
  }

  // ---- El ledger se toca SOLO si la factura pasó. Una en revisión puede
  // volver legítimamente después de intervención humana.
  if (persistLedger && verdict === 'pass' && key !== null && key !== '') {
    ledger[key] = {
      seenAt: now,
      docId: docId === undefined ? null : (typeof docId === 'string' ? docId : docIdHex(docId)),
    };
    writeLedger(ledger, ledgerPath);
  }

  if (persist && docId !== undefined) {
    try {
      const paths = runPaths(docId);
      mkdirSync(paths.dir, { recursive: true });
      writeFileSync(paths.verdict, JSON.stringify(result, null, 2) + '\n');
    } catch {
      // No poder escribir el artefacto no invalida el dictamen en memoria.
    }
  }

  return result;
}
