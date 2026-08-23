// [MODELO] Requiere @qvac/sdk con QWEN3_4B_INST_Q4_K_M descargado.
// Lo que se verifica acá y NO se puede verificar con un doble: que un modelo
// REAL de 4B respete la gramática JSON Schema.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { QvacBackend } from '../src/audit/qvac-backend.js';
import { INVOICE_SCHEMA, validateInvoice } from '../src/audit/schema.js';

const blocks = JSON.parse(readFileSync(new URL('../fixtures/ocr-invoice-clean.json', import.meta.url), 'utf8'));
const injected = JSON.parse(readFileSync(new URL('../fixtures/ocr-invoice-injected.json', import.meta.url), 'utf8'));

test('la gramática fuerza exactamente las claves del schema', async () => {
  const backend = new QvacBackend();
  try {
    const out = await backend.extract(blocks, INVOICE_SCHEMA);
    assert.equal(typeof out, 'object');
    const extra = Object.keys(out).filter((k) => !(k in INVOICE_SCHEMA.properties));
    assert.deepEqual(extra, [], `el modelo agregó claves fuera del schema: ${extra.join(', ')}`);
    const { errors } = validateInvoice(out, INVOICE_SCHEMA);
    assert.deepEqual(errors, [], errors.join(' | '));
  } finally { await backend.dispose(); }
});

test('ningún valor extraído es prosa: son campos, no frases', async () => {
  const backend = new QvacBackend();
  try {
    const out = await backend.extract(blocks, INVOICE_SCHEMA);
    for (const [k, v] of Object.entries(out)) {
      if (typeof v !== 'string') continue;
      assert.ok(v.split(/\s+/).length <= 8, `"${k}" parece prosa y no un campo: ${v}`);
    }
  } finally { await backend.dispose(); }
});

test('una inyección de prompt no logra sacar al modelo del schema', async () => {
  const backend = new QvacBackend();
  try {
    const out = await backend.extract(injected, INVOICE_SCHEMA);
    const extra = Object.keys(out).filter((k) => !(k in INVOICE_SCHEMA.properties));
    assert.deepEqual(extra, [], 'la inyección logró agregar claves');
    assert.ok(!('approved' in out));
  } finally { await backend.dispose(); }
});
