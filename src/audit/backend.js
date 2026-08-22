// T-11 — Interfaz de backend de inferencia y FakeBackend.
//
// PRIMERA tarea del Bloque B: desbloquea las otras nueve. Ningún archivo del
// bloque importa @qvac/sdk directamente salvo qvac-backend.js (T-12/T-13), así
// que todo lo demás se testea en milisegundos sin un modelo de 4 GB en disco.
//
// Contrato de la interfaz:
//   init()                     -> Promise<void>    idempotente
//   ocr(imagePath)             -> Promise<OcrBlock[]>
//   extract(blocks, schema)    -> Promise<object>   JSON que cumple el schema
//   explain(checks)            -> Promise<string>
//   dispose()                  -> Promise<void>    idempotente

import { isOcrBlock } from '../shared/contract.js';

export class BackendError extends Error {
  constructor(message, { stage = 'extract', code = 'backendUnavailable', cause } = {}) {
    super(message);
    this.name = 'BackendError';
    this.stage = stage;
    this.code = code;
    if (cause) this.cause = cause;
  }
}

/**
 * Backend determinista para tests y para el harness de T-19.
 * Todo lo que devuelve es inyectable, así se pueden simular respuestas
 * inesperadas del SDK sin tener el SDK.
 */
export class FakeBackend {
  /**
   * @param {{blocks?:any[], extraction?:object|(()=>object), explanation?:string,
   *          failOn?:Set<string>|string[], latencyMs?:number}} config
   */
  constructor(config = {}) {
    this.blocks = config.blocks ?? [];
    this.extraction = config.extraction ?? {};
    this.explanation = config.explanation ?? 'Explicación determinista de prueba.';
    this.failOn = new Set(config.failOn ?? []);
    this.latencyMs = config.latencyMs ?? 0;
    this.calls = { init: 0, ocr: 0, extract: 0, explain: 0, dispose: 0 };
    this.ready = false;
  }

  #maybeFail(method, stage, code) {
    if (this.failOn.has(method)) {
      throw new BackendError(`FakeBackend: fallo inyectado en ${method}()`, { stage, code });
    }
  }

  async init() {
    this.calls.init++;
    this.#maybeFail('init', 'ocr', 'backendUnavailable');
    this.ready = true;
  }

  async ocr(imagePath) {
    this.calls.ocr++;
    this.#maybeFail('ocr', 'ocr', 'backendUnavailable');
    if (typeof imagePath !== 'string' || imagePath === '') {
      throw new BackendError('ocr() necesita una ruta de imagen', { stage: 'ocr', code: 'emptyDocument' });
    }
    const blocks = this.blocks.filter(isOcrBlock);
    return structuredClone(blocks);
  }

  async extract(blocks, schema) {
    this.calls.extract++;
    this.#maybeFail('extract', 'extract', 'malformedExtraction');
    if (!Array.isArray(blocks)) {
      throw new BackendError('extract() espera un array de bloques', { stage: 'extract', code: 'malformedExtraction' });
    }
    if (!schema || typeof schema !== 'object') {
      throw new BackendError('extract() espera un JSON Schema', { stage: 'extract', code: 'malformedExtraction' });
    }
    const value = typeof this.extraction === 'function' ? this.extraction(blocks, schema) : this.extraction;
    return structuredClone(value);
  }

  async explain(checks) {
    this.calls.explain++;
    this.#maybeFail('explain', 'verdict', 'backendUnavailable');
    if (!Array.isArray(checks)) {
      throw new BackendError('explain() espera un array de checks', { stage: 'verdict', code: 'malformedExtraction' });
    }
    return this.explanation;
  }

  async dispose() {
    this.calls.dispose++;
    this.ready = false;
  }
}
