<div align="center">

# telepatía

**Una compuerta de ingreso semántica para máquinas aisladas.**

Un agente de IA local lee los papeles del taller. Código determinista decide si
el programa puede correr. Y los bytes aprobados cruzan el aislamiento **por la
luz de una pantalla**.

`La IA lee · El código decide · La luz lo cruza`

**385 tests · 0 llamadas de red · 0 API keys · 100% inferencia local**

</div>

---

## 1. El problema

Hay computadoras que fabrican cosas físicas —tornos, fresadoras, PLCs, bombas de
agua— **desconectadas de internet a propósito**. Si alguien de afuera pudiera
darles órdenes no robaría una contraseña: rompería una turbina o contaminaría el
agua.

Pero esas máquinas igual necesitan que les entren archivos. Y la forma real, en
2026, sigue siendo **una persona caminando con un pendrive**.

Un pendrive no es un archivo: es una computadora con microcontrolador y firmware
reprogramable, capaz de presentarse ante el host como algo distinto de lo que es
(familia BadUSB). El antivirus escanea los archivos del medio; no puede escanear
el medio.

Y antes de eso hay un segundo problema, menos visible y mucho más frecuente:
**nadie verifica que el archivo sea el correcto.** El operario tiene la orden de
trabajo, la hoja de preparación, el plano y el programa. Y cuarenta segundos.

| Lo que se pasa por alto | Consecuencia física |
|---|---|
| Revisión vieja de la pieza | el lote completo a scrap |
| Llama `T7`, en el carrusel hay `T1`–`T3` | el portaherramientas baja vacío. Husillo partido |
| `G55` cuando el cero está en `G54` | pieza entera desplazada |
| RPM o avance sobre el límite del setup | herramienta partida a 8000 rpm |

Ninguno se detecta mirando el archivo. Todos se detectan **comparando papeles**.

---

## 2. El mercado, y el hueco

Existe una industria de **US$0,56 MM (2026) → US$0,77 MM (2031)** dedicada a
*data diodes*: hardware que fuerza flujo unidireccional a nivel físico. Owl Cyber
Defense, Waterfall, Everfox, Nexor, Advenica, OPSWAT.

**Están construidos para sacar datos, no para meterlos.** Owl y Fend/OPSWAT no
publican producto de ingreso. Waterfall (WF FLIP) y Nexor (GuarDiode) sí lo
abordan — pero abriendo una **ventana de tiempo**, sin aprobación ni trazabilidad
por artefacto.

> La empresa cortó el cable. Nunca resolvió cómo meter un archivo sin volver a
> abrir la puerta que cerró.

### Números, con fuente primaria

| Dato | Fuente |
|---|---|
| **82%** del malware hallado en USB industriales *"is capable of causing disruption to industrial operations: loss of view, loss of control, or system outages"* | Honeywell USB Threat Report 2024 |
| USB plug-and-play: **incidente #1** del equipo de respuesta de Honeywell — 84 casos, 25% del top 10 | Honeywell Cyber Threat Report 2025 |
| **20,3%** de los vectores iniciales de incidentes OT = medios removibles comprometidos | SANS ICS/OT Survey 2024, Fig. 12 |
| **26%** de los avisos ICS salen **sin parche disponible** | Dragos Year in Review 2026 |
| **< 10%** de las redes OT tienen monitoreo significativo *(estimación)* | Dragos, OT Threat Landscape 2026 |
| **US$2.190/año por sistema** en horas-hombre de transferencia manual diaria | DoD ESTCP EW19-5156, p.22 |

**El gancho regulatorio.** NERC CIP-010-4 **R1.6** obliga, antes de cada cambio
que se desvíe de la línea base, a *"verify the identity of the software source"*
y *"verify the integrity of the software obtained from the software source"*.
Norma auditable, con multas. Es exactamente el artefacto que este sistema emite
solo, por transferencia.

**Honestidad que fortalece el argumento.** Dragos —el mejor dataset de respuesta
a incidentes en OT— **no** ubica los medios removibles entre los vectores
dominantes: el 73% de sus casos 2025 fueron VPN y jumphosts. El USB no es el
vector más frecuente: es **el más desatendido y el de peor consecuencia**.

---

## 3. Arquitectura

### La decisión de diseño

```
documentos de taller (PDF, foto, escaneo)  →  MODELO LOCAL
programa .nc (lenguaje regular)            →  PARSER DETERMINISTA
veredicto                                  →  CÓDIGO, comparando ambos conjuntos
```

**El modelo nunca decide.** Extraer `T7` de un `.nc` es un tokenizador; meter una
alucinación en ese camino crítico para ahorrárselo sería un error de diseño. El
LLM lee lo que no tiene estructura; el código parsea lo que sí la tiene.

### Cuatro capas, ninguna suficiente sola

| # | Capa | Módulo | Qué corta |
|---|---|---|---|
| 1 | **Esquema** | `src/cnc/job-schema.js` | Extracciones malformadas. `FORBIDDEN_JOB_KEYS` prohíbe `approved`, `verdict`, `authorized`: **el modelo no tiene dónde escribir una conclusión** |
| 2 | **Grounding** | `src/audit/ground.js` | Valores que el modelo no puede señalar en los píxeles |
| 3 | **Confianza** | `src/cnc/preflight.js` | Campos críticos con OCR flojo. `Rev B` vs `Rev C` es **un carácter** |
| 4 | **Checks deterministas** | `src/cnc/preflight.js` | Todo lo que papeleo y programa no comparten |

### El grounding, en detalle

`ground.js` fue reescrito tras una auditoría que encontró un bypass explotable:
verificar *presencia* del valor en el OCR no alcanza. Un atacante elegía números
que **sí** estaban impresos y que cerraban entre sí. Ahora verifica
**correspondencia**, con tres condiciones acumulativas:

1. **Forma** — un importe ancla contra un token con forma de importe, no contra
   cualquier corrida de dígitos.
2. **Etiqueta** — el bloque ancla debe nombrar el campo. Un número suelto no
   ancla nada.
3. **Cohesión** — los campos de un mismo ítem anclan contra **el mismo bloque**.

Tipos de anclaje: `money · number · rate · date · id · code · text · letter`.

El tipo `letter` existe porque la revisión es **un carácter**: `"C"` está dentro
de *Carbide*, de *Machine* y de media docena de palabras. Debe aparecer
**suelto**, en un bloque etiquetado.

La tabla de reglas es un parámetro: el motor es genérico, cada dominio trae las
suyas (`src/cnc/ground-rules.js`).

### Defensa contra inyección de prompt

El texto de una inyección **es** parte del OCR: si no se filtra, se ancla contra
su propia frase. `partitionBlocks()` separa anclas de instrucciones con ventana
deslizante de 3 bloques —el OCR corre con `paragraph:false`, así que una
inyección partida en dos renglones evadiría un escaneo bloque a bloque— y
**encoge la ventana al mínimo** para no arrastrar vecinos legítimos.

**La lista de marcadores no es la defensa principal, y está medido:** una
inyección en portugués que no dispara ningún marcador **igual se frena**, porque
sus valores no anclan.

### El permiso de emisión

`src/cnc/approval.js` ata el informe aprobado a los bytes exactos. Dos
identidades distintas, ambas necesarias:

| Hash | Qué responde |
|---|---|
| `programHash()` | ¿es el mismo programa? Normaliza CRLF y espacios finales |
| `sourceSha256` | ¿son los mismos bytes? Byte a byte: es lo que se transmite |

> **No es una firma.** El informe es un JSON sin firmar; alguien con acceso local
> puede editarlo. Cierra el error humano y el cambio accidental. Para ser firma
> haría falta Ed25519 con manejo de claves y tests de adulteración. No está
> hecho, así que no se dice.

---

## 4. QVAC: dónde ocurre la inferencia

Inferencia 100% local vía **`@qvac/sdk` 0.17.1**, sobre runtime **Bare** con
motores nativos `llm-llamacpp` y `ocr-ggml`. **Un solo archivo importa el SDK.**

| Rol | Modelo | Cuantización | Peso |
|---|---|---|---|
| OCR con bounding boxes | `OCR_LATIN` | — | 98 MB |
| Extracción estructurada | `QWEN3_4B_INST_Q4_K_M` | Q4_K_M | 2,50 GB |
| Fallback baja RAM | `QWEN3_1_7B_INST_Q4` | Q4 | ~1,5 GB |

### Permalinks a la integración

Todo en `src/audit/qvac-backend.js`:

| Qué | Línea |
|---|---|
| Import diferido del SDK | [L85](https://github.com/JustUrIs/telepatia/blob/main/src/audit/qvac-backend.js#L85) |
| `loadModel` OCR | [L108](https://github.com/JustUrIs/telepatia/blob/main/src/audit/qvac-backend.js#L108) |
| `loadModel` LLM | [L113](https://github.com/JustUrIs/telepatia/blob/main/src/audit/qvac-backend.js#L113) |
| `ocr()` — píxeles → bloques con bbox | [L136](https://github.com/JustUrIs/telepatia/blob/main/src/audit/qvac-backend.js#L136) |
| `completion()` con `responseFormat: json_schema` | [L181](https://github.com/JustUrIs/telepatia/blob/main/src/audit/qvac-backend.js#L181) |
| `getSystemResources()` | [L246](https://github.com/JustUrIs/telepatia/blob/main/src/audit/qvac-backend.js#L246) |

### Cómo se prompea, y por qué

```js
// El texto del documento va SIEMPRE en role:'user', delimitado. Nunca en
// system: compartir canal entre instrucciones y datos ES el vector de
// confusión de roles.
history: [
  { role: 'system', content: SYSTEM_PROMPT },
  { role: 'user', content: `<documento>${texto}</documento>` },
],
responseFormat: { type: 'json_schema', json_schema: { name: 'job', schema } },
```

El `system` prohíbe explícitamente calcular y concluir. Y la **gramática** —no el
prompt— fuerza la forma de la salida: `json_object` no alcanza, lo documenta el
propio SDK.

---

## 5. El protocolo óptico AGP1

Diseño propio. Header de 16 bytes, todo big-endian:

```
offset  size  campo
     0     4  MAGIC ("AGP1" = 0x41475031)
     4     1  VERSION
     5     1  KIND (MANIFEST=1, DATA=2, PARITY=3)
     6     4  docId  (primeros 4 bytes del SHA-256 del documento en claro)
    10     2  index
    12     2  total
    14     2  payloadLen
```

**Propiedades del diseño:**

- **`parseFrame()` nunca lanza.** La cámara ve cualquier QR que caiga en cuadro,
  incluido el de una vidriera. Distingue *QR ajeno* (`null`) de *emisor más
  nuevo* (`{unsupportedVersion}`).
- **Paridad XOR por ventana.** Un chunk perdido por ventana se recupera sin
  retransmitir. **No hay canal de vuelta: no puede haber ACK.**
- **Carrusel infinito** con el manifest reinyectado cada 12 frames, para que un
  receptor que entra tarde enganche en menos de un segundo.
- **`docId` = hash del contenido.** Dos documentos nunca se fusionan.
- **Cruce contra el manifest.** Un frame trae su *propio* `total`: uno espurio con
  `index=7/total=8` entraría en un stream de 3 chunks y daría `complete` con un
  chunk ausente. Con manifest presente, él manda.
- **`assemble()` verifica largo + SHA-256** antes de entregar nada.

### Densidad

| Bytes/frame | Versión QR | Módulos |
|---|---|---|
| 300 | V11 | 61 |
| 900 | V21 | 101 |
| 2900 | V40 | 177 |

`pickVersion()` ata `chunkSize + HEADER_LEN` a la capacidad real, para que un QR
no falle recién en la cámara.

### El browser: tres shims y un bundle

`protocol.js` usa `Buffer`, `node:crypto` y `node:zlib`. Un browser no tiene
ninguno. Se resolvió con tres shims propios —SHA-256 en JS puro, `Buffer` sobre
`Uint8Array`, deflate en bloques stored— y un bundle generado con esbuild que
aliasea los builtins.

`test/ui-shim.test.js` compara **cada shim contra los builtins reales de Node** y
verifica la integración cruzada: el bundle de browser emite frames **byte a byte
idénticos** al camino Node, y un receptor Node arma un stream emitido por el
browser.

### Rendimiento del render

Un módulo = un píxel, y después `drawImage` escalado con
`imageSmoothingEnabled = false`. La alternativa ingenua —un `fillRect` por módulo
ya escalado— son 313.000 llamadas al contexto por segundo a V40 y 10 fps. Además
la escala entera queda garantizada: **un borde gris es un módulo que la cámara
puede leer de las dos formas**.

El receptor escanea a 720 px de lado: jsQR es JS puro y su costo crece con el
área — 64 ms a 1280×1280 contra 24 ms a 640×480, medido.

---

## 6. Correrlo

### Requisitos

**Node ≥ 22.** Nada más. Sin cuentas, sin API keys, sin variables de entorno.

### Instalación

```bash
git clone https://github.com/JustUrIs/telepatia
cd telepatia
npm install
npm test                                          # 385 tests, ~1,4 s
node scripts/pull-models.mjs --preset standard    # ~2,6 GB, una sola vez
```

### El control previo

```bash
# Con modelos: OCR + extracción reales sobre los documentos
node bin/preflight.mjs fixtures/programs/part-1837-revC.nc

# Con extracción precargada (instantáneo, para CI o demo)
node bin/preflight.mjs fixtures/programs/part-1837-revB.nc \
  --job fixtures/shop/job-extracted.json
```

Códigos de salida: `0` aprobado · `1` revisar · `2` bloqueado.

### El transporte óptico

```bash
npm run demo:setup    # genera la CA y el certificado para tu IP
npm run demo          # levanta http:8777 y https:8443
```

| Dónde | Dirección |
|---|---|
| Misma computadora | `http://localhost:8777` |
| Otro dispositivo (celular) | `https://<tu-ip>:8443` |

Para usar la cámara desde un celular hay que instalar **una vez** la CA de
desarrollo: abrir `http://<tu-ip>:8777/certs/telepatia-ca.crt` en el teléfono e
instalarla como certificado de CA. `getUserMedia` **no existe** fuera de contexto
seguro — no es un bug que una web pueda saltear.

### Regenerar artefactos

```bash
npm run build:ui                       # bundles del browser
node scripts/gen-cert.mjs [ip extra]   # certificado
node scripts/try-preflight.mjs --worn  # corrida QVAC sobre entrada degradada
```

---

## 7. Números medidos

```
Intel i7-14650HX · 16 núcleos físicos / 24 lógicos · 34 GB RAM
NVIDIA RTX 4060 Laptop (CUDA disponible) · Windows 11 · Node 22.18
```

| Etapa | Tiempo |
|---|---|
| Descarga de modelos (una vez) | 274 s + 15 s |
| Carga de ambos modelos (frío) | 13–23 s |
| OCR orden de trabajo (850×1100) | 17,5 s |
| OCR hoja de preparación | 12,6 s |
| **Extracción QWEN3-4B con gramática** | **7,8 s** |
| Parser + checks + veredicto | < 50 ms |

### Entradas degradadas

Los documentos se renderizan con tipografía real y se degradan a propósito.

| Variante | Datos clave | Confianza media | Bloques < 0,5 |
|---|---|---|---|
| limpio | 6/6 | 0,90 | 0 |
| rotado 3° | 6/6 | 0,90 | 0 |
| bajo contraste | 6/6 | 0,88 | 0 |
| **ruido fuerte** | **3/6** | **0,33** | **26** |

**El caso ruidoso falla, y decirlo importa más que esconderlo.** El OCR leyó
`4.0.0` como `4.0,8` y `4.3.0` como `4.340`. Pero los leyó con confianza 0,32 y
0,27 — y por eso existe la capa 3. **Un dato mal leído con confianza baja es un
problema que el sistema puede ver venir.**

### Dominio anterior, como suite de regresión

El repositorio conserva un dominio completo previo —conciliación de facturas
contra extracto bancario— con corpus adversario de 24 casos:

```
Tasa de bloqueo:          100,0%   (20 ataques, 0 pasaron)
Tasa de falsos positivos:   0,0%   (4 legítimas, 0 frenadas)

schema=5 · ground=10 · verdict=5 · none=4
```

**Publicar la tasa de bloqueo sola es publicar media verdad:** un sistema que
rechaza todo la saca perfecta.

Y el hallazgo que define la arquitectura: `inject-bypass-coherent`, una
falsificación **completa y coherente escrita en los píxeles**, atraviesa esquema,
grounding y aritmética con **cero campos sin anclar y cero checks fallidos**. La
frena únicamente el extracto bancario.

> El atacante escribe el documento. El grounding prueba que el modelo no inventó
> el valor; **no prueba que el valor sea verdad.** La última defensa tiene que ser
> una fuente que el atacante no controla.

Que el mismo motor sirva para dos dominios sin tocarse es la evidencia de que no
está atado al caso.

---

## 8. Qué NO hace

- **No simula el mecanizado.** No calcula colisiones, deflexión ni feeds contra
  material. Verifica que el papeleo y el programa digan lo mismo.
- **No es antivirus ni CDR.** El canal puede transportar bytes maliciosos.
- **No es una firma digital.** SHA-256 demuestra integridad de reconstrucción, no
  identidad del emisor.
- **La cámara conserva firmware.** Se elimina la inserción repetida de medios de
  almacenamiento mutables, no toda superficie de ataque.
- **No es "NERC compliant".** La norma motiva el control; certificarlo requiere
  evaluación formal.
- **El canal mueve kB/s.** Un firmware de 200 MB no cruza; el techo es 4 MB.
- **Arranque en frío:** el software receptor llega al equipo aislado una primera
  vez por los medios existentes. Después se actualiza por luz.

---

## 9. Stack completo

| Capa | Tecnología |
|---|---|
| Inferencia local | `@qvac/sdk` 0.17.1 · Bare runtime · llm-llamacpp · ocr-ggml |
| Modelos | QWEN3-4B-Instruct Q4_K_M · QWEN3-1.7B Q4 · OCR_LATIN |
| Salida estructurada | JSON Schema por gramática (`responseFormat`) |
| Runtime | Node ≥ 22 · ESM puro · **sin paso de build** |
| Tests | `node:test` — 385 tests, ~1,4 s |
| QR encode | `qrcode` 1.5.4, aislado en `render.js`, vendorizado a ESM |
| QR decode | `jsqr` 1.4.0, aislado en `scan.js` |
| Bundling | esbuild, solo para generar artefactos commiteados |
| Browser | Canvas 2D · `getUserMedia` · Service Worker · Web App Manifest |
| Shims propios | SHA-256 JS puro · `Buffer` sobre `Uint8Array` · deflate stored |
| Servidor de desarrollo | Node `http`/`https` sin dependencias, CA propia con SAN |
| Criptografía | SHA-256 (`node:crypto` / shim) |
| Compresión | deflate raw (`node:zlib`) |

### Estructura

```
bin/preflight.mjs    el control previo, y la costura entre capas
src/cnc/             dominio: esquema, parser de G-code, checks, permiso
src/audit/           motor genérico: grounding, veredicto, backend QVAC
src/optical/         protocolo AGP1: frames, carrusel, decoder, QR
src/ui/              emisor y receptor en browser, shims, bundles
src/shared/          contrato entre módulos
scripts/             generadores: certificados, bundles, documentos, modelos
fixtures/            documentos, programas e informes de prueba
test/                385 tests
docs/                producto, pitch, guion de demo, benchmarks
```

### Documentación

| Archivo | Para qué |
|---|---|
| `COMO-GRABAR.md` | grabar el demo, paso a paso |
| `docs/PITCH-2.md` | el pitch en castellano llano |
| `docs/DEMO-2.md` | guion de rodaje plano por plano |
| `docs/producto.md` | mercado, comprador, números con fuente |
| `docs/harness-report.md` | corpus adversario, resultados |

---

<div align="center">

**Cortaron el cable para que nadie entre.
Y después metieron todo por la puerta de atrás, en el bolsillo de alguien.**

Nosotros convertimos la pantalla en la única puerta.
Entra luz, no un aparato.

</div>
