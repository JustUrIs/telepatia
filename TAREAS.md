# TAREAS — Auditoría air-gapped de facturas con QVAC

**Track:** 🔷 QVAC Track (Aleph Hackathon 2026, sponsor Tether).
**Caso de uso:** un equipo emisor sin red publica facturas como carrusel de QR; una app local
las escanea, las reconstruye, las audita con QVAC contra un extracto bancario CSV, y emite un
dictamen de conciliación. El documento se trata como **entrada hostil**: puede llevar inyección
de prompt, y la defensa se mide.

**Recordatorio de mecánica:** una entrada por sponsor. Elegir QVAC archiva el plan de Pears
que vive en la rama `plan`.

---

## 1. Decisiones de stack congeladas

No se discuten durante el hackathon. Cambiar una de estas a mitad de camino es la forma más
rápida de perder medio día.

| Decisión | Valor | Por qué |
|---|---|---|
| Lenguaje | **JavaScript ESM puro** (`.js`, sin TypeScript) | cero paso de build; los tipos viven en JSDoc + validadores runtime |
| Runtime | **Node ≥ 22** | `node --test` incorporado, `node:zlib`, `node:crypto` |
| Test runner | **`node --test`** | cero dependencias, arranca en milisegundos |
| Inferencia | **`@qvac/sdk` 0.17.1** | verificado en npm; API confirmada leyendo el paquete |
| Modelo LLM | `QWEN3_4B_INST_Q4_K_M` (fallback `QWEN3_1_7B_INST_Q4`) | dentro del rango 1–4B que pide el track |
| Modelo OCR | `OCR_LATIN` | OCR nativo del SDK; el track prohíbe VisionPsy |
| QR encode | **`qrcode` 1.5.4** (MIT) | verificado |
| QR decode | **`jsqr` 1.4.0** (Apache-2.0) | verificado; JS puro, sin WASM |
| Protocolo óptico | diseño propio "AGP1" | ver §3 |

Las dos librerías QR viven **aisladas** en `src/optical/render.js` y `src/optical/scan.js`.
Ningún otro archivo las importa. El protocolo es nuestro; el dibujo del cuadrado no.

---

## 2. Auditoría multi-agente — hallazgos y qué cambió

Pasé el borrador de 20 tareas por tres lentes antes de congelarlo. Los hallazgos no son
decorativos: cinco de ellos cambiaron la lista.

### Lente 1 — Arquitecto de Software

| Hallazgo | Severidad | Resolución |
|---|---|---|
| No existía tarea para el contrato compartido. Ambos devs habrían codificado contra interfaces distintas y la integración fallaba el último día. | **crítico** | El contrato se congela en §3 de este documento, no en una tarea. Nadie espera a nadie. |
| El track **exige** reportar hardware y latencias como entregable, y no había tarea que lo produjera. | alto | Absorbido en **T-20**, usando `getSystemResources()` del SDK. |
| Faltaba liberar recursos del modelo (`unloadModel`, `close`). Un worker filtrado mata la demo en vivo. | alto | Requisito explícito en **T-12**. |
| La detección de facturas duplicadas necesitaba un ledger persistente que nadie definía. | medio | Ledger en `runs/ledger.json`, definido en el contrato y consumido por **T-18**. |

### Lente 2 — Lead QA

| Hallazgo | Severidad | Resolución |
|---|---|---|
| **Ninguna** tarea del Bloque B podía cumplir la regla del test de 5 segundos: todas necesitaban un modelo de 4 GB descargado. | **crítico** | **T-11** crea `FakeBackend` y es la **primera** tarea del Bloque B. Solo T-12, T-13 y T-20 tocan el SDK real; las otras siete corren en milisegundos. |
| Sin fixtures golden, cada test necesitaba un modelo. | crítico | Siete fixtures congelados en §3. |
| El track premia explícitamente "entradas sucias reales, no un PDF limpio elegido a mano", y no había cobertura de eso. | alto | **T-19** cubre corpus sucio **y** adversario, con métricas separadas. |
| El test end-to-end no era tarea de nadie — el fallo clásico de una lista paralelizada. | alto | **T-10** cierra el e2e del lado A, **T-20** el del pipeline completo. |

### Lente 3 — Dev Fullstack

| Hallazgo | Severidad | Resolución |
|---|---|---|
| No estaba definido cómo llega el documento reconstruido al pipeline: ¿path, buffer, stream? | alto | Contrato: se escribe en `runs/<docId>/document.bin` y el pipeline recibe el **path** (`ocr()` acepta path). |
| Sin superficie de error definida, la UI no sabía qué mostrar ante SHA-256 fallido o campo sin anclar. | alto | El contrato define `Failure` y **T-10** obliga a renderizar los tres casos. |
| Las librerías QR estaban sin nombrar: dos devs elegían distinto. | medio | Fijadas y verificadas en §1. |
| `Transaction[]` lo produce el Bloque A (T-08) y lo consume el Bloque B (T-17): dependencia cruzada que rompe la regla de oro. | **crítico** | T-17 codifica contra `fixtures/statement-normalized.json`, nunca contra el código de T-08. |

**Veredicto de cobertura:** con estos cambios, las 20 tareas cubren los 17 archivos de `src/`,
los 20 de `test/`, y los 4 entregables que exige el track. Cero dependencias cruzadas de código
entre bloques.

---

## 3. Contrato congelado (la regla anti-bloqueo)

Esto es lo que hace posible que dos personas codifiquen desde el minuto uno.

> **El contrato NO se copia de este documento: ya vive en `src/shared/contract.js`, en la rama.**
> Una versión anterior de esta sección tenía el código pegado y se desincronizó del archivo real
> (le faltaban `FAILURE_CODES`, `docIdHex`, `toCents`, `isCheckResult`, `isFailure`, y su
> `runPaths` escribía en `runs/1960806794` donde el archivo escribe en `runs/74df898a`). Dos devs
> habrían construido contratos distintos. **La fuente de verdad es el archivo**; abajo va solo el
> índice de lo que exporta.

| Export | Para qué | Lo usa |
|---|---|---|
| `STAGES` | etapas del pipeline, en orden (incluye `csv`) | T-08, T-20 |
| `FAILURE_CODES` | códigos de fallo que la UI sabe renderizar | T-08, T-10 |
| `docIdHex` / `runPaths` | rutas canónicas de una corrida | T-04, T-10, T-18 |
| `LEDGER_PATH` | ledger de duplicados | T-18 |
| `toCents` | dinero en centavos enteros | T-16 |
| `BACKEND_METHODS` / `isBackend` | interfaz de inferencia | T-11, T-12 |
| `isOcrBlock` / `isTransaction` / `isCheckResult` / `isVerdict` / `isFailure` | validadores de forma | todos |

Ambos bloques importan de ahí y de ningún otro lado cruzado.

```js
// src/shared/contract.js
// Contrato congelado entre Bloque A (óptico/CSV/UI) y Bloque B (QVAC/auditoría).
// Nadie modifica este archivo sin avisar al otro dev. Los tipos son JSDoc; los
// validadores existen para que los tests puedan afirmar forma sin dependencias.

/** @typedef {{ text: string, bbox: [number,number,number,number], confidence: number }} OcrBlock */
/** @typedef {{ date: string, description: string, amount: number, currency: string, ref?: string }} Transaction */
/** @typedef {{ value: string|number, bbox: [number,number,number,number], confidence: number }} GroundedField */
/** @typedef {{ key: string, value: unknown, reason: string }} Ungrounded */
/** @typedef {{ id: string, ok: boolean, expected: unknown, actual: unknown, evidence: GroundedField[] }} CheckResult */
/** @typedef {{ verdict: 'pass'|'fail'|'review', checks: CheckResult[], ungrounded: Ungrounded[], matched: Transaction|null }} Verdict */
/** @typedef {{ stage: string, code: string, message: string }} Failure */

/** Etapas del pipeline, en orden. Las usan las métricas y la UI. */
export const STAGES = ['scan', 'assemble', 'ocr', 'extract', 'ground', 'reconcile', 'match', 'verdict'];

/** Dónde vive todo lo de una corrida. `docId` en hex de 8 chars. */
export const runPaths = (docId) => ({
  dir: `runs/${docId}`,
  document: `runs/${docId}/document.bin`,
  ocr: `runs/${docId}/ocr.json`,
  verdict: `runs/${docId}/verdict.json`,
  metrics: `runs/${docId}/metrics.json`,
});

/** Ledger de facturas ya vistas, para detectar duplicados. */
export const LEDGER_PATH = 'runs/ledger.json';

/** Interfaz que TODO backend de inferencia debe cumplir. FakeBackend (T-11) y
 *  QvacBackend (T-12/T-13) son intercambiables sin tocar el resto. */
export const BACKEND_METHODS = ['init', 'ocr', 'extract', 'explain', 'dispose'];

export function isOcrBlock(v) {
  return !!v && typeof v.text === 'string' && Array.isArray(v.bbox)
    && v.bbox.length === 4 && v.bbox.every(Number.isFinite)
    && typeof v.confidence === 'number';
}

export function isTransaction(v) {
  return !!v && typeof v.date === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v.date)
    && typeof v.description === 'string' && Number.isFinite(v.amount)
    && typeof v.currency === 'string' && v.currency.length === 3;
}

export function isVerdict(v) {
  return !!v && ['pass', 'fail', 'review'].includes(v.verdict)
    && Array.isArray(v.checks) && Array.isArray(v.ungrounded);
}

export function isBackend(v) {
  return !!v && BACKEND_METHODS.every((m) => typeof v[m] === 'function');
}
```

### Fixtures congelados

Los crea quien llegue primero (son datos, no código) y ambos bloques los consumen. Sin estos,
la regla de oro no se sostiene.

| Archivo | Contenido | Lo consume |
|---|---|---|
| `fixtures/document-small.bin` | **36.000 B incompresibles** (xorshift32, semilla fija). A `chunkSize=900` → 40 chunks y 5 ventanas. **No lo reemplaces por datos compresibles**: la versión anterior era una rampa que `deflateRaw` bajaba a 883 B, o sea `total=1`, y volvía tautológicos los tests de T-02, T-03 y T-04 | T-02, T-03, T-04, T-09 |
| `fixtures/ocr-invoice-clean.json` | `OcrBlock[]` de una factura legible | T-14, T-15, T-16 |
| `fixtures/ocr-invoice-dirty.json` | igual, con ruido de OCR real (`O`↔`0`, cortes) | T-19 |
| `fixtures/ocr-invoice-injected.json` | igual, con inyección de prompt embebida | T-19 |
| `fixtures/statement.csv` | extracto bancario crudo y sucio | T-07, T-08 |
| `fixtures/statement-normalized.json` | `Transaction[]` canónico | **T-17** (rompe la dependencia cruzada) |
| `fixtures/verdict-pass.json`<br>`fixtures/verdict-fail.json`<br>`fixtures/verdict-review.json` | **un archivo por estado**, cada uno coherente con la regla de T-18 (check en `false` → `fail`; `ungrounded` o sin match → `review`; todo bien → `pass`) | **T-10** (rompe la dependencia cruzada) |

---

## 4. Las 20 tareas

Convención de test: todos se corren con `node --test <archivo>` y deben terminar en menos de
5 segundos. Los tres que tocan el SDK real están marcados **[MODELO]**, viven en
`test-model/` y se corren aparte — así la suite rápida nunca depende de un modelo descargado.

> **Verificado en Node 22:** `node --test test/` con el directorio pelado **falla**
> (`MODULE_NOT_FOUND`: lo interpreta como módulo a ejecutar). Hay que usar glob citado.
> Y `--test-skip-pattern` filtra por **nombre de test, no por archivo**, así que no sirve
> para excluir los tests de modelo: de ahí la separación por directorio.

---

### BLOQUE A — Dev 1: óptico, CSV, UI

#### `[T-01]` Header del protocolo AGP1: empaquetado y parseo
- **Asignado a:** Dev 1 / Bloque A
- **Archivos:** crear `src/optical/protocol.js`, `test/t01-header.test.js`
- **Especificación técnica:** constantes `MAGIC` (0x41475031 = `"AGP1"`), `VERSION = 1`,
  `HEADER_LEN = 16`, `KIND = {MANIFEST:1, DATA:2, PARITY:3}`. Función interna
  `packHeader(kind, docId, index, total, payloadLen)` → `Buffer` de 16 bytes big-endian, con
  **este layout exacto** (el orden no era deducible, y sin él dos implementaciones divergen):
  offset 0 `u32` magic · 4 `u8` version · 5 `u8` kind · 6 `u32` docId · 10 `u16` index ·
  12 `u16` total · 14 `u16` payloadLen.
  Export `parseFrame(bytes)` → `{kind, docId, index, total, payload}` | `{unsupportedVersion}` |
  `null`. **Nunca lanza**: el receptor ve cualquier QR que caiga en cuadro, incluido el de una
  vidriera. Rechaza si `bytes.length !== HEADER_LEN + payloadLen`.
- **Test de aceptación:** `node --test test/t01-header.test.js` — verifica round-trip de header,
  que un buffer con magia distinta dé `null`, que un truncado dé `null`, y que una versión 2 dé
  `{unsupportedVersion: 2}`.

#### `[T-02]` Empaquetado de documento: chunking, manifest y compresión
- **Asignado a:** Dev 1 / Bloque A
- **Archivos:** editar `src/optical/protocol.js`, crear `test/t02-encode.test.js`
- **Especificación técnica:** `encodeDocument(document, {name, mime, chunkSize=900, parityWindow=8, compress=true})`
  → `{docId, manifest, frames:{manifest, data[], parity[]}}`. `docId` = primeros 4 bytes del
  SHA-256 del documento **en claro** leídos como u32 BE. Comprime con `deflateRawSync` **solo si
  el resultado es más chico**. Manifest en JSON: `{v, sha256, length, bodyLength, chunkSize,
  total, parityWindow, compression, name, mime}`, con estos formatos: `v = 1`; `sha256` en
  **hex minúscula de 64 chars, del documento EN CLARO** (no del cuerpo comprimido);
  `compression` es `0` = ninguna, `1` = `deflateRaw`; `length` es el largo en claro y
  `bodyLength` el del cuerpo emitido. Como `docId` son los primeros 4 bytes de ese sha256 leídos
  como u32 BE, vale siempre `sha256.slice(0,8) === docIdHex(docId)`. Lanza si el documento está
  vacío o si `total > 65535`.
- **Test de aceptación:** `node --test test/t02-encode.test.js` — con `fixtures/document-small.bin`
  verifica `total === ceil(bodyLength/chunkSize)`, que el manifest parsea, que un documento de
  ceros comprime (`compression === 1`) y que uno aleatorio no.

#### `[T-03]` Paridad XOR por ventana y orden de emisión del carrusel
- **Asignado a:** Dev 1 / Bloque A
- **Archivos:** editar `src/optical/protocol.js`, crear `test/t03-carousel.test.js`
- **Especificación técnica:** en `encodeDocument`, generar un frame `PARITY` por ventana de
  `parityWindow` chunks: XOR de los chunks de la ventana **rellenados a `chunkSize`**. Export
  `carousel({frames})` como **generador infinito**: manifest primero, después data intercalada
  con la paridad de su ventana. El **ciclo** queda definido así, y de acá sale el `cycleFrames`
  que T-09 reporta: `cycleFrames = 1 + total + ceil(total / parityWindow)`. Encima de eso, el
  manifest se **reinyecta cada 12 frames emitidos** (contando TODOS los frames, no solo los de
  data) para que un receptor que entra tarde engancha rápido.
- **Test de aceptación:** `node --test test/t03-carousel.test.js` — toma los primeros 200 frames
  del generador, verifica que el primero sea `MANIFEST`, que aparezca un `MANIFEST` al menos
  cada 12, que todo índice de data del 0 al total-1 aparezca en un ciclo, y que la paridad de la
  ventana 0 sea el XOR de sus chunks.

#### `[T-04]` Receptor: deduplicación, recuperación XOR y verificación SHA-256
- **Asignado a:** Dev 1 / Bloque A
- **Archivos:** editar `src/optical/protocol.js`, crear `test/t04-decoder.test.js`
- **Especificación técnica:** clase `FrameDecoder` con `push(bytes)`, getters `complete` y
  `progress` (**fracción `0..1`**), `assemble()` → `{document, manifest}` (descomprime con
  `inflateRawSync` si `manifest.compression === 1`), `reset()`, y `stats`
  `{accepted, duplicate, foreign, recovered}`. Un `docId` distinto **reinicia todo** (dos
  documentos nunca se fusionan, porque el docId sale del hash del contenido). `#recover()` en
  bucle: si a una ventana le falta exactamente un chunk y tenemos su paridad, el faltante es el
  XOR; truncar al largo real (el último chunk es más corto). `assemble()` lanza si el largo o el
  SHA-256 no coinciden.
  **Tres validaciones que parecen de más y no lo son** — cada una es un agujero que una auditoría
  encontró en esta misma tarea: (a) una vez que hay manifest, todo frame se cruza contra él
  (`f.total === manifest.total`, `index < manifest.total`, y el largo de payload esperado), porque
  un frame trae su PROPIO `total` y uno espurio con `index=7/total=8` entra en un stream de 3
  chunks y deja `complete` en `true` con un chunk ausente; (b) el manifest se acepta solo si
  `sha256.slice(0,8)` coincide con el `docId` que lo transporta, o un manifest forjado que llega
  primero gana y el legítimo se descarta como duplicado; (c) los contadores de `stats`
  **sobreviven al `reset()`**, o las métricas de campo no sirven para nada.
- **Test de aceptación:** `node --test test/t04-decoder.test.js` — alimenta todos los frames
  desordenados y verifica que el documento reconstruido sea idéntico al original; después repite
  **omitiendo un chunk de cada ventana** y verifica que `stats.recovered > 0` y que el documento
  sigue saliendo bien; y que un byte alterado haga lanzar a `assemble()`.

#### `[T-05]` Adaptador de renderizado QR
- **Asignado a:** Dev 1 / Bloque A
- **Archivos:** crear `src/optical/render.js`, `test/t05-render.test.js`
- **Especificación técnica:** único archivo que importa `qrcode`. Export
  `frameToMatrix(frameBytes, {ecc='L', version})` → `{size, data: Uint8Array}` usando modo
  **byte** (los frames son binarios, no texto: nada de base64, que infla 33%). Export
  `matrixToPng(matrix, scale)` → `Buffer`. Export `pickVersion(chunkSize)` → la versión mínima
  de QR que aguanta `chunkSize + 16` bytes al ECC dado, para que `chunkSize` de T-02 y la
  capacidad real no se desincronicen.
  **Verificado ejecutando la lib, para que no lo descubras vos:** 916 B en modo byte a ECC L
  entran en **V21 = 101 módulos** (V21 tope 929 B; V20 no alcanza). El API público de `qrcode` no
  expone ni el render de una matriz ya hecha ni la tabla de capacidades, así que hace falta
  deep-import de API privada — comprobado que funciona: `qrcode/lib/renderer/png.js` →
  `renderToBuffer({modules:{size,data}}, {scale, margin})`, y `qrcode/lib/core/version.js` +
  `mode.js` + `error-correction-level.js` → `getCapacity(21, ECLevel.L, Mode.BYTE) === 929`.
  No hay campo `exports` en su package.json, así que está permitido, pero es API sin garantía de
  semver: que no salga de este archivo.
- **Test de aceptación:** `node --test test/t05-render.test.js` — verifica que `frameToMatrix`
  de un frame de 916 bytes dé una matriz cuadrada de **lado 101**, que `matrixToPng` empiece con
  la firma PNG `89 50 4E 47` y que su ancho declarado corresponda a lado × escala + quiet zone,
  y que `pickVersion(900)` devuelva **21**, cuya capacidad byte (929) es ≥ 916.

#### `[T-06]` Adaptador de escaneo QR
- **Asignado a:** Dev 1 / Bloque A
- **Archivos:** crear `src/optical/scan.js`, `test/t06-scan.test.js`
- **Especificación técnica:** único archivo que importa `jsqr`. Export
  `scanRgba(data, width, height)` → `Uint8Array | null` con los bytes crudos del frame
  (`inversionAttempts: 'dontInvert'` por velocidad). Acepta `Uint8Array` **y
  `Uint8ClampedArray`** — que es lo que devuelve `getImageData`; excluirlo hace que el tipo
  nativo del canvas falle en silencio. Export `ScanLoop` con **esta firma**, que T-10 consume:
  `new ScanLoop(provider, decoder)` donde `provider` es `() => ({rgba, width, height} | null)`
  síncrono (`null` = sin señal) y `decoder` es `{push(bytes) => boolean, complete: boolean}`;
  métodos `.tick() => boolean`, `.run(maxTicks) => boolean`, `.stop()`; y
  `.stats = {frames, hits, misses, novel, providerErrors}`. **Prohibido**
  que este archivo conozca el layout del header — solo mueve bytes.
- **Test de aceptación:** `node --test test/t06-scan.test.js` — round-trip sin cámara: renderiza
  un frame con T-05, lo convierte a RGBA en memoria, lo pasa por `scanRgba` y verifica que los
  bytes salgan **idénticos** a los que entraron.

#### `[T-07]` Parser de CSV bancario tolerante a entrada sucia
- **Asignado a:** Dev 1 / Bloque A
- **Archivos:** crear `src/csv/parse.js`, `test/t07-csv-parse.test.js`
- **Especificación técnica:** parser propio, stdlib sola (nada de `csv-parse`). Export
  `parseCsv(text, {delimiter})` → `string[][]`. Debe manejar: campos entre comillas con el
  delimitador adentro, comillas escapadas (`""`), CRLF y LF mezclados, BOM al inicio, líneas
  vacías, y última línea sin salto. Export `sniffDelimiter(text)` → `','` | `';'` | `'\t'`
  por frecuencia en las primeras 5 líneas. **No** interpreta semántica: eso es T-08.
- **Test de aceptación:** `node --test test/t07-csv-parse.test.js` — sobre `fixtures/statement.csv`
  verifica el número de filas y que una fila con coma dentro de comillas quede en un solo campo;
  más casos unitarios de BOM, CRLF y `""`.

#### `[T-08]` Normalizador de transacciones a forma canónica
- **Asignado a:** Dev 1 / Bloque A
- **Archivos:** crear `src/csv/normalize.js`, `test/t08-normalize.test.js`
- **Especificación técnica:** `normalize(rows)` → `{transactions: Transaction[], rejected: Failure[]}`.
  Mapea encabezados por sinónimos: `fecha|date|f. valor`, `importe|amount|monto`,
  `concepto|description|detalle`, **`moneda|currency|divisa`** y **`referencia|ref|comprobante`**
  — los dos últimos son obligatorios: `isTransaction` exige `currency` de 3 chars, así que sin
  ese sinónimo la tarea no puede pasar su propio test. Si la columna de moneda no existe, la fila
  va a `rejected`; no se inventa un default. Fechas: acepta `DD/MM/YYYY`, `YYYY-MM-DD`, `DD-MM-YY` y
  normaliza a ISO `YYYY-MM-DD`, con **pivote de siglo 70** para `DD-MM-YY` (`<70` → 20xx,
  `>=70` → 19xx; el fixture fija `15-07-26` → `2026-07-15`). Montos: acepta `1.234,56` y `1,234.56` — **decide por la
  posición del último separador**, no por locale global; paréntesis y sufijo `-` significan
  negativo. Toda fila que no normalice va a `rejected` con motivo, **nunca se descarta en
  silencio**. Cada rechazo es un `Failure` del contrato: `{stage: 'csv', code:
  FAILURE_CODES.malformedRow, message}` — esa etapa y ese código existen precisamente para esto.
  La salida debe pasar `isTransaction`.
- **Test de aceptación:** `node --test test/t08-normalize.test.js` — verifica que
  `1.234,56` y `1,234.56` den ambos `1234.56`, que `(50,00)` dé `-50`, que las tres formas de
  fecha den ISO, que toda salida pase `isTransaction`, y que una fila con fecha basura aparezca en
  `rejected` con un `Failure` que pase `isFailure`. **Y la aserción que sostiene toda la
  paralelización:** `assert.deepEqual(normalize(parseCsv(statement.csv)).transactions, ...)` contra
  `fixtures/statement-normalized.json`. Sin eso, el Bloque A puede emitir `{fecha, monto}` donde el
  Bloque B espera `{date, amount}`, los dos bloques pasan todos sus tests, y el desfase aparece el
  último día.

#### `[T-09]` UI del emisor: elegir archivo y emitir el carrusel
- **Asignado a:** Dev 1 / Bloque A
- **Archivos:** crear `src/ui/sender.html`, `src/ui/sender.js`, `test/t09-sender.test.js`
- **Especificación técnica:** página con selector de archivo, selector de `chunkSize`/fps, y un
  `<canvas>` que pinta el carrusel. Export **testeable sin DOM**: `planEmission(fileBytes, opts)`
  → `{docId, totalFrames, cycleFrames, secondsPerCycle}` y `nextFrame(state)`. Todo el acceso al
  DOM aislado en `mount()`, que los tests no llaman. Wake lock si existe, y contador de vuelta
  actual del ciclo en pantalla.
- **Test de aceptación:** `node --test test/t09-sender.test.js` — verifica que
  `planEmission` sobre `fixtures/document-small.bin` reporte `totalFrames` coherente con T-02 y
  `secondsPerCycle` = `cycleFrames / fps`, y que 3 llamadas sucesivas a `nextFrame` devuelvan
  frames distintos.

#### `[T-10]` UI del receptor: cámara, progreso y render del dictamen
- **Asignado a:** Dev 1 / Bloque A
- **Archivos:** crear `src/ui/receiver.html`, `src/ui/receiver.js`, `test/t10-receiver.test.js`
- **Especificación técnica:** `getUserMedia` + `ScanLoop` de T-06 + `FrameDecoder` de T-04.
  Barra de progreso alimentada por `decoder.progress`. Al completar, **ofrece el documento al usuario**
  con un `<a download>` sobre un blob URL, usando el basename de `runPaths(docId).document` como
  nombre sugerido. `runPaths` es la convención de rutas del Bloque B, que sí corre en Node; el
  navegador no escribe en el filesystem y esta tarea no monta File System Access API. Export testeable `renderVerdict(verdict)` → estructura de vista, y
  `renderFailure(failure)`. **Obligatorio cubrir los tres estados** (`pass`/`fail`/`review`) más
  los tres fallos: SHA-256 no coincide, campos sin anclar, y stream de versión no soportada.
  Consume `fixtures/verdict-{pass,fail,review}.json` — **nunca** importa nada del Bloque B.
- **Test de aceptación:** `node --test test/t10-receiver.test.js` — sobre
  los tres fixtures de verdict verifica que **cada uno pase `isVerdict`** (aserción golden: si el
  Bloque B cambia la forma del `Verdict`, se rompe acá y no el último día), que `renderVerdict`
  produzca una fila por check con su evidencia, que los tres estados den título y tono distintos,
  que marque visualmente los `ungrounded`, y que `renderFailure` de tres códigos dé tres mensajes
  distintos y no vacíos — incluido que un `code` inexistente como `'toString'` **no** devuelva una
  función (`Object.hasOwn`, no indexación cruda).

---

### BLOQUE B — Dev 2: QVAC, extracción, conciliación

#### `[T-11]` Interfaz de backend de inferencia y FakeBackend
- **Asignado a:** Dev 2 / Bloque B
- **Archivos:** crear `src/audit/backend.js`, `test/t11-backend.test.js`
- **Especificación técnica:** **primera tarea del bloque, desbloquea las otras nueve.** Define
  la interfaz `{init(), ocr(imagePath), extract(blocks, schema), explain(checks), dispose()}`.
  Implementa `FakeBackend`: `ocr()` devuelve el fixture que se le configure, `extract()` devuelve
  un objeto fijo o el que se le inyecte, `explain()` devuelve texto determinista. Debe pasar
  `isBackend` del contrato. **Ningún** otro archivo del bloque importa `@qvac/sdk` directamente.
- **Test de aceptación:** `node --test test/t11-backend.test.js` — verifica que `FakeBackend`
  pase `isBackend`, que `ocr()` devuelva bloques que pasen `isOcrBlock`, y que dos llamadas con
  la misma entrada den salida idéntica (determinismo).

#### `[T-12]` QvacBackend: carga de modelos y OCR real **[MODELO]**
- **Asignado a:** Dev 2 / Bloque B
- **Archivos:** crear `src/audit/qvac-backend.js`, `test-model/t12-qvac-ocr.test.js`
- **Especificación técnica:** único archivo que importa `@qvac/sdk`. `init()` hace
  `loadModel({modelSrc: OCR_LATIN, modelConfig:{langList:['en','es'], magRatio:1.5,
  lowConfidenceThreshold:0.5}})` y `loadModel({modelSrc: QWEN3_4B_INST_Q4_K_M})`, con
  `onProgress` reportando la descarga. `ocr(path)` usa `const {blocks} = ocr({modelId, image:
  path, options:{paragraph:false}})` y mapea a `OcrBlock[]`. **`dispose()` es obligatorio**:
  `unloadModel({modelId})` para cada modelo y `close()`. Un worker filtrado mata la demo en vivo.
- **Test de aceptación:** `node --test test-model/t12-qvac-ocr.test.js` (corre aparte, requiere modelo
  descargado) — hace OCR sobre una imagen de factura y verifica que devuelva ≥1 bloque que pase
  `isOcrBlock`; después `dispose()` y verifica que el proceso salga solo sin colgarse.

#### `[T-13]` QvacBackend: extracción con gramática JSON Schema **[MODELO]**
- **Asignado a:** Dev 2 / Bloque B
- **Archivos:** editar `src/audit/qvac-backend.js`, crear `test-model/t13-extract.test.js`
- **Especificación técnica:** `extract(blocks, schema)` usa
  `completion({modelId, history, stream:true, responseFormat:{type:'json_schema',
  json_schema:{name:'invoice', schema}}})` y consume la superficie canónica
  `run.events` / `await run.final` (el ejemplo del SDK marca `tokenStream`/`text` como legacy).
  **El texto del documento va SIEMPRE en un mensaje `role:'user'` delimitado con
  `<documento>…</documento>`, nunca en `system`** — eso es lo que habilita la confusión de roles.
  El `system` prohíbe explícitamente calcular y concluir.
- **Test de aceptación:** `node --test test-model/t13-extract.test.js` (corre aparte) — sobre
  `fixtures/ocr-invoice-clean.json` verifica que la salida sea JSON válido, que contenga
  exactamente las claves del schema y ninguna extra, y que ningún valor sea una frase en prosa.

#### `[T-14]` Schema de factura y validador
- **Asignado a:** Dev 2 / Bloque B
- **Archivos:** crear `src/audit/schema.js`, `test/t14-schema.test.js`
- **Especificación técnica:** `INVOICE_SCHEMA` — JSON Schema con
  `invoiceNumber, issueDate, dueDate, supplierName, supplierTaxId, currency, lineItems[]
  {description, quantity, unitPrice, amount}, subtotal, taxRate, taxAmount, total`, todo
  `additionalProperties: false` y `required` explícito (la gramática del SDK solo fuerza las
  claves que declares). Export `validateInvoice(obj)` → `{ok, errors[]}` con validación de tipos
  propia, sin dependencias. Nada de conclusiones en el schema: **no hay campo `approved`**.
- **Test de aceptación:** `node --test test/t14-schema.test.js` — verifica que un objeto válido
  pase, que uno con clave extra falle, que uno con `total` string falle, y que el schema **no**
  contenga ningún campo de veredicto (`assert` sobre las claves).

#### `[T-15]` Compuerta de grounding: anclar cada campo a su evidencia
- **Asignado a:** Dev 2 / Bloque B
- **Archivos:** crear `src/audit/ground.js`, `test/t15-ground.test.js`
- **Especificación técnica:** **la pieza que diferencia el proyecto.**
  `groundFields(fields, blocks)` → `{grounded, ungrounded}`. Todo valor extraído debe aparecer en
  el texto de algún `OcrBlock`; si aparece, se le adjunta `bbox` y `confidence`; si no, va a
  `ungrounded` con motivo. Normalización: minúsculas, colapso de espacios, quitar símbolos de
  moneda. Los **números se comparan numéricamente**, no textualmente (`1.234,50` y `1234.5` son
  el mismo valor, con tolerancia 0.005). No es un prompt pidiendo que no invente: es una
  verificación.
- **Test de aceptación:** `node --test test/t15-ground.test.js` — sobre
  `fixtures/ocr-invoice-clean.json`: un campo presente queda en `grounded` **con bbox**; un
  `total: 99999` inventado cae en `ungrounded`; y `1.234,50` en el OCR ancla contra el valor
  numérico `1234.5`.

#### `[T-16]` Motor de conciliación interna de la factura
- **Asignado a:** Dev 2 / Bloque B
- **Archivos:** crear `src/audit/reconcile.js`, `test/t16-reconcile.test.js`
- **Especificación técnica:** funciones **puras, cero llamadas al modelo**.
  `reconcileInvoice(grounded)` → `CheckResult[]` con los checks:
  `items_sum_subtotal`, `subtotal_plus_tax_equals_total`, `tax_rate_plausible`
  (0 ≤ tasa ≤ 0.30), `currency_consistent`, `dates_ordered` (emisión ≤ vencimiento),
  `issue_date_not_future`. Comparación de dinero **en centavos enteros**, nunca floats
  (`Math.round(x*100)`), tolerancia ±1 centavo por redondeo. Cada check lleva la `evidence` de
  los campos que usó.
- **Test de aceptación:** `node --test test/t16-reconcile.test.js` — una factura consistente da
  todos los checks en `ok:true`; alterar `total` en 1 unidad hace fallar **solo**
  `subtotal_plus_tax_equals_total`; una tasa de 0.85 hace fallar solo `tax_rate_plausible`; y
  `0.1 + 0.2` como subtotal+tax contra `0.3` **no** falla (prueba de la aritmética en centavos).

#### `[T-17]` Matching de factura contra transacciones del extracto
- **Asignado a:** Dev 2 / Bloque B
- **Archivos:** crear `src/audit/match.js`, `test/t17-match.test.js`
- **Especificación técnica:** `matchTransaction(grounded, transactions)` →
  `{matched: Transaction|null, candidates: {tx, score, reasons[]}[]}`. Puntaje por: monto exacto
  (peso alto), monto dentro de ±1%, fecha dentro de ±5 días del vencimiento, número de factura
  presente en la descripción, moneda igual. Devuelve `matched` **solo** si el mejor puntaje pasa
  un umbral y le saca margen al segundo — un empate es `review`, no una adivinanza.
  **Consume `fixtures/statement-normalized.json`, jamás el código de T-08.**
- **Test de aceptación:** `node --test test/t17-match.test.js` — sobre el fixture normalizado:
  una factura con monto y referencia exactos matchea; una con monto duplicado en dos
  transacciones devuelve `matched: null` con dos candidatos empatados; una sin monto cercano da
  `candidates: []`.

#### `[T-18]` Ensamblador de dictamen y ledger de duplicados
- **Asignado a:** Dev 2 / Bloque B
- **Archivos:** crear `src/audit/verdict.js`, `test/t18-verdict.test.js`
- **Especificación técnica:** `buildVerdict({checks, ungrounded, matched, ledgerPath})` → `Verdict`.
  Reglas, **en código, sin modelo**: cualquier check en `false` → `fail`; algún `ungrounded` o
  `matched === null` → `review`; todo bien → `pass`. Agrega el check
  `invoice_not_duplicate` leyendo `LEDGER_PATH` (`{invoiceNumber: {seenAt, docId}}`) y lo
  actualiza **solo** si el veredicto es `pass`. Salida debe pasar `isVerdict`. Escribe
  `runPaths(docId).verdict`.
- **Test de aceptación:** `node --test test/t18-verdict.test.js` — con un ledger temporal:
  entrada limpia da `pass` y escribe el ledger; repetir la misma factura da `fail` por
  `invoice_not_duplicate`; un `ungrounded` fuerza `review` y **no** toca el ledger; toda salida
  pasa `isVerdict`.

#### `[T-19]` Corpus adversario y sucio, con métricas
- **Asignado a:** Dev 2 / Bloque B
- **Archivos:** crear `src/audit/harness.js`, `fixtures/attacks/*.json`, `test/t19-harness.test.js`
- **Especificación técnica:** el entregable que más pesa en "evidencia, no vibras". Corpus de
  ≥12 casos en dos familias: **sucios** (ruido de OCR, columnas desalineadas, fotos torcidas,
  totales cortados) y **adversarios** (inyección directa, inyección en el campo descripción,
  instrucción en blanco sobre blanco, factura que se auto-aprueba). `runHarness(backend, corpus)`
  → tabla por caso `{id, family, blockedBy: 'schema'|'ground'|'verdict'|null, verdict}`.
  Reporta **tasa de bloqueo por capa defensiva**, no un número global: la capa que corta cada
  ataque es la información útil. Corre con `FakeBackend` para poder medir en CI.
- **Test de aceptación:** `node --test test/t19-harness.test.js` — verifica que el corpus tenga
  ≥12 casos con las dos familias presentes, que `runHarness` devuelva una fila por caso, y que
  **ningún** caso adversario termine en `verdict: 'pass'`.

#### `[T-20]` Pipeline end-to-end, explicación y reporte de hardware **[MODELO]**
- **Asignado a:** Dev 2 / Bloque B
- **Archivos:** crear `src/audit/explain.js`, `src/audit/pipeline.js`, `test-model/t20-pipeline.test.js`
- **Especificación técnica:** `runPipeline({documentPath, transactions, backend})` encadena
  ocr → extract → ground → reconcile → match → verdict, cronometrando **cada etapa de `STAGES`**
  y escribiendo `runPaths(docId).metrics`. `explain(checks)` hace la **única** llamada al modelo
  para redactar prosa a partir de checks **ya resueltos** — si falla, el dictamen sigue siendo
  válido y se marca `explanation: null`. Agrega `getSystemResources()` del SDK al reporte:
  el track exige specs de hardware y latencias como entregable.
- **Test de aceptación:** `node --test test-model/t20-pipeline.test.js` — con `FakeBackend` corre el
  pipeline completo sobre los fixtures y verifica que produzca un `Verdict` que pase `isVerdict`,
  que `metrics.json` tenga una entrada por cada etapa de `STAGES`, y que forzar el fallo de
  `explain()` deje `explanation: null` **sin** cambiar el veredicto.

---

## 5. Línea de corte y riesgos

Si el tiempo aprieta, se corta en este orden. Está decidido de antemano para que nadie improvise
a las 3 AM.

| Orden | Qué se corta | Qué se pierde | Qué NO se pierde |
|---|---|---|---|
| 1º | **T-06** (escaneo con cámara) | la demo en vivo con cámara | el protocolo se demuestra archivo a archivo con T-04 |
| 2º | **T-09 / T-10** (UI) | presentación linda | todo corre por CLI, que para el video alcanza |
| 3º | **T-17** (matching contra extracto) | la conciliación bancaria | la auditoría interna de la factura (T-16) sigue en pie |

**Nunca se cortan:** T-11 (bloquea el bloque entero), T-15 (es el diferenciador),
T-19 (es el criterio que más puntúa), T-20 (contiene entregables exigidos por el track).

| Riesgo | Mitigación |
|---|---|
| Descarga del modelo de 4 GB en la red del venue | descargar **el día anterior**; `QWEN3_1_7B_INST_Q4` como plan B |
| `chunkSize` de T-02 no entra en el QR elegido | `pickVersion()` en T-05 los ata; es un test, no una convención |
| Los fixtures se escriben tarde y ambos bloques se frenan | son la **primera** hora del proyecto, antes de T-01 y T-11 |
| Un modelo de 1.7B ignora el JSON Schema | `json_schema` fuerza por gramática, no por prompt; el ejemplo del SDK documenta que `json_object` **no** alcanza |

---

## 6. Definición de "hecho"

Una tarea está cerrada cuando:

1. Su test de aceptación pasa con el comando exacto que dice la tarea.
2. `node --test 'test/*.test.js'` completo sigue en verde (no rompió a nadie).
3. No importa nada del otro bloque (los cruces van por fixture, siempre).
4. Los archivos que dice "crear" existen en las rutas exactas indicadas.

Suite rápida (sin modelo) — la que corre en cada commit:

```bash
node --test 'test/*.test.js'
```

Suite con modelo, aparte y a mano:

```bash
node --test 'test-model/*.test.js'
```

Todo junto, incluido lo que necesita modelo:

```bash
node --test
```
