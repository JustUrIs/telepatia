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
  try {
    const raw = readFileSync(path, 'utf8');
    const parsed = JSON.parse(raw);
    if (parsed === null || typeof parsed !== 'object' || Array.isArray(parsed)) return {};
    return parsed;
  } catch {
    // No existe, o quedó corrupto: se trata como vacío. Un ledger ilegible no
    // debe tumbar una auditoría; a lo sumo pierde la detección de duplicados.
    return {};
  }
}

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
 * @param {{checks:any[], ungrounded:any[], matched:any, invoiceNumber?:string,
 *          docId?:number|string, ledgerPath?:string, now?:string,
 *          persist?:boolean, explanation?:string|null}} input
 * @returns {import('../shared/contract.js').Verdict & {explanation?:string|null}}
 */
export function buildVerdict(input) {
  const {
    checks = [], ungrounded = [], matched = null,
    invoiceNumber, docId, ledgerPath = LEDGER_PATH,
    now = new Date().toISOString(), persist = true, explanation = null,
  } = input ?? {};

  if (!Array.isArray(checks)) throw new TypeError('buildVerdict espera checks[]');
  if (!Array.isArray(ungrounded)) throw new TypeError('buildVerdict espera ungrounded[]');

  const all = [...checks];

  // ---- Check de duplicado, contra el ledger local.
  const ledger = readLedger(ledgerPath);
  if (typeof invoiceNumber === 'string' && invoiceNumber !== '') {
    const prior = ledger[invoiceNumber];
    all.push({
      id: 'invoice_not_duplicate',
      ok: !prior,
      expected: 'no vista antes',
      actual: prior ? `ya vista el ${prior.seenAt} (docId ${prior.docId})` : 'primera vez',
      evidence: [],
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
  if (persist && verdict === 'pass' && typeof invoiceNumber === 'string' && invoiceNumber !== '') {
    ledger[invoiceNumber] = {
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
