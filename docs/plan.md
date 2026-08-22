# Plan de construcción — CLI de transferencia óptica sobre Pear

**Track objetivo:** 🍐 Pears Track (Aleph Hackathon 2026, sponsor Tether) — $1,000 / $500 USDt.
**Supuesto registrado:** vamos por la dirección que **reutiliza** el núcleo de
`decimen-optical-transfer` (transferencia óptica de archivos), no por el chat TUI con QR de
pairing. Si esto cambia, el plan se descarta casi entero — la decisión es ahora, no en la mitad.

---

## 1. Qué se construye

Un CLI instalable por `pear install pear://<key>` que convierte un archivo en un stream animado
de códigos QR fountain-coded, renderizado **en la terminal**. Cualquier teléfono con un receptor
Decimen (la web, o el HTML autocontenido) lo captura y reconstruye el archivo.

**El caso de uso, en una frase:** sacar un archivo de una máquina que tiene consola pero no tiene
red ni USB — un servidor headless, una VM aislada, una laptop en un entorno restringido.

**El reparto conceptual** (y la respuesta al criterio del jurado *"la arquitectura de procesos
debe alinearse lógicamente con el propósito de la herramienta"*):

| Capa | Tecnología | Propiedad que aporta |
|---|---|---|
| Distribución de la herramienta | Pear / Hyperswarm / Hypercore | sin servidores, con OTA |
| Movimiento de los datos | canal óptico (pantalla → cámara) | **sin red alguna** |

Son dos ausencias de infraestructura distintas, apiladas. Ese es el pitch.

### Alcance v1 (dentro)

- `send <archivo>` — stream animado en terminal, infinito hasta Ctrl-C.
- `export <archivo>` — APNG o secuencia PNG en ZIP (código ya escrito y sin DOM).
- `doctor` — reporta ancho/alto de terminal, versión de QR alcanzable, capacidad estimada.
- OTA por swarm, funcionando y demostrada.

### Fuera de v1 (declarado, no escondido)

- **El receptor sigue siendo un teléfono.** En una terminal no hay cámara. El binario que
  instala el jurado hace la mitad del trabajo, y eso se dice en el README y en el video, no se
  disimula.
- `decode <dir-de-pngs>` como *stretch*: factible sin cámara y sin WASM usando `jsQR` (decodificador
  QR en JS puro). Solo si Fase 0–4 cierran con tiempo de sobra.

---

## 2. Requisitos del track → dónde se cumplen

Esta tabla es la checklist de entrega. El jurado instala como usuario final, así que cada fila
tiene que ser verificable por alguien que no escribió el código.

| Requisito del track | Cómo se cumple | Fase |
|---|---|---|
| Partir del template `hello-pear-bare` | El repo se clona del template; `bin.mjs` se conserva como entrypoint | 1 |
| Desplegar con el Pear CLI | `pear touch` → `pear stage` → `pear seed` | 4 |
| Instalable con `pear install pear://<key>` | Link publicado en el README y probado en una máquina limpia | 4 |
| OTA P2P funcionando, con una actualización demostrada llegando a una copia instalada | Guion de demo: instalar v1, stagear v2, ver la copia actualizarse | 4 |
| Repo público con documentación | README + este plan + docs/ | 5 |
| Link `pear://` de instalación | En el README, arriba | 5 |
| Video de demo grabado | Guion en §9 | 5 |
| Usar la pila Pear (Bare, Hyperswarm, Hypercore, Hyperdrive) | vía `pear-runtime` embebido, como hace el template | 1, 4 |
| Categoría del track | **system utility** (el track pone el CLI `swap` como referencia) | — |

Nota de mecánica: una entrada por sponsor. Si entramos a Pears, no entramos a WDK ni QVAC.

---

## 3. Estado verificado de la superficie externa

Todo esto lo comprobé, no lo estoy recordando:

**Pear CLI (v2.5.9).** El flujo actual es `pear touch` → `pear stage <link> [dir]` →
`pear seed <link>` → `pear install <link>`, más `pear build`, `pear info`, `pear versions`.
**`pear init`, `pear run` y `pear release` fueron eliminados** — los templates se clonan a mano,
y correr la app es embebiendo la librería `pear-runtime`. Cualquier tutorial que use esos tres
comandos está viejo; no seguirlo.

**Template `hello-pear-bare`.** Estructura: `bin.mjs` (entrypoint + config del runtime),
`app.js` (gestión de recursos de update), `workers/main.js`, `scripts/make.js` (selector de
plataforma/arquitectura para el build), `test/index.js`. El `package.json` lleva un campo
`upgrade` que debe contener un link `pear://` válido creado con `pear touch`. Desarrollo con
`bare bin.mjs --no-updates`; updates se habilitan con `npm start -- --updates`.

**Paquetes disponibles en npm** (versiones al momento de escribir esto):

| Paquete | Versión | Para qué lo necesitamos |
|---|---|---|
| `pear-cli` | 2.5.9 | stage / seed / touch / install |
| `bare-zlib` | 1.4.1 | gzip + deflate (reemplaza `CompressionStream`) |
| `bare-crypto` | 1.15.3 | SHA-256 (reemplaza `crypto.subtle`) |
| `bare-tty` | 5.1.2 | tamaño de terminal, modo raw, escritura |
| `bare-fs` | 4.8.0 | leer el archivo a enviar |
| `bare-process` | 4.5.1 | argv, exit, señales |
| `hyperswarm` / `hypercore` / `hyperdrive` | 4.17.0 / 11.35.2 / 13.3.3 | los trae `pear-runtime` |

---

## 4. Qué se porta desde Decimen, verificado archivo por archivo

Revisé qué APIs de navegador usa realmente cada módulo. El resultado es el activo central de
este proyecto: **toda la mitad emisora depende del navegador en exactamente 6 líneas, en 2
archivos.**

### Porta tal cual (cero cambios)

| Archivo | Qué hace |
|---|---|
| `shared/fountain.ts` | código fountain (LTEncoder, carrusel sistemático, `dlog` determinista) |
| `shared/protocol.ts` | formato de cable v3, empaquetado de contenedor, FNV-1a |
| `shared/frame-capacity.ts` | cuántos bloques entran a qué tamaño de frame |
| `shared/progress.ts` | estimación de progreso / ETA |
| `shared/snippet.ts` | modo texto |
| `send/qr-frame.ts` | generación de QR con máscara fijada (usa el paquete `qrcode`) |
| `shared/qr-raster.ts` | rasterizado a píxeles (los `ImageData` que aparecen son comentarios) |
| `shared/apng.ts`, `shared/zip.ts` | contenedores de animación |
| `send/export.ts` | pipeline de export completo — escrito a propósito sin DOM |

### Necesita shim (las 6 líneas)

| Ubicación | API de navegador | Reemplazo |
|---|---|---|
| `protocol.ts:151` | `crypto.subtle.digest("SHA-256")` | `bare-crypto` |
| `protocol.ts:155-158` | `CompressionStream("gzip")` | `bare-zlib` |
| `protocol.ts:171-173` | `DecompressionStream("gzip")` | `bare-zlib` |
| `png.ts:126-129` | `CompressionStream("deflate")` | `bare-zlib` |

La forma correcta de hacerlo: un módulo `src/platform.ts` que exporte `digest()`, `gzip()`,
`gunzip()` y `deflate()`, y que los archivos portados importen de ahí. **No** editar la lógica
de los archivos portados — así un `git diff` contra el upstream sigue siendo legible, y una
corrección de upstream se puede traer sin pelearse con el port.

### No porta

`receive/main.ts` (1452 líneas): cámara, DOM, pool de workers, zxing en WASM. Nada de eso existe
en una terminal. Es la razón por la que el receptor sigue siendo el teléfono.

### La prueba de que el port es real

Los 142 tests del upstream ya corren toda esa cadena **en Node**, incluida la generación de QR y
un export APNG completo. No es una apuesta: es código que ya se ejecuta fuera del navegador.

### Un arreglo que hay que llevarse puesto

Encontré un bug real en `classifyFrame()` de upstream: no valida `totalLen` contra
`k * blockLen`, así que un QR fabricado de 23 bytes hace que el receptor asigne hasta 4 GB
(lo medí: asignó 4294967295 bytes desde un solo frame). El arreglo es una línea:

```ts
if (totalLen > k * blockLen || totalLen <= (k - 1) * blockLen) return { kind: "malformed" };
```

**Portar `protocol.ts` con el arreglo incluido**, y mandar el PR a upstream. Dos beneficios:
nuestro código no nace con el bug, y hay una contribución real al proyecto del que derivamos —
que es exactamente lo que hace defendible el "originalidad" ante el jurado.

---

## 5. Fase 0 — Spike de densidad (compuerta go/no-go)

**Esta fase decide si el resto del plan existe. Va primero y tiene criterio de aborto.**

El problema: un QR V40 son 177 módulos por lado. Con quiet zone son 185. Renderizado con medios
bloques ANSI (1 columna por módulo, 1 fila por 2 módulos) eso pide una terminal de
**185 × 93 caracteres**. Y decodificar módulos hechos de caracteres —con antialiasing de fuente,
celda no cuadrada y sin escala entera de módulo— es precisamente el problema que el emisor web
resuelve con mucho cuidado: hay un comentario en `send/main.ts` diciendo que el jitter de
nearest-neighbor era la diferencia entre decodificar 4/4 códigos y 0/4.

### La matemática que hay que confirmar en hardware

| Versión QR | Módulos + quiet | Terminal necesaria (medios bloques) | Bytes/frame (ECC L) | Goodput a 10 fps |
|---|---|---|---|---|
| V40 | 185 | 185 × 93 | 2953 | ~28 KB/s |
| V27 | 129 | 129 × 65 | 1465 | ~14 KB/s |
| V10 | 65 | 65 × 33 | 271 | ~2.4 KB/s |

**Consecuencia de producto que hay que aceptar desde el día uno:** esto da entre 2 y 30 KB/s,
contra los 418 KB/s del titular de Decimen. Un archivo de 1 MB a V27/10fps tarda ~70 s. Por lo
tanto el producto apunta a **payloads chicos**: claves SSH, configs, certificados, logs, seed
phrases. No videos. Positionar mal esto es la forma más rápida de que el demo decepcione.

### Dos estrategias de renderizado, en orden de preferencia

1. **Protocolo gráfico de terminal** (Kitty / WezTerm / Ghostty / iTerm2, o sixel). Se emite un
   PNG real y la terminal lo pinta con control total de píxeles: escala entera de módulo, celda
   cuadrada, sin antialiasing de fuente. Esto elimina de raíz el riesgo que el comentario de
   upstream advierte, y ya tenemos el encoder PNG portado. Cobertura limitada de terminales, que
   para un demo está perfecto.
2. **Medios bloques ANSI** (`▀`/`▄`/`█`) como fallback universal. Funciona en cualquier parte,
   pero es donde el decode se puede caer.

Hacer 1 primero. Si 1 anda, 2 es una comodidad, no un requisito.

### Criterios de aceptación de la Fase 0

- [ ] Un frame real (`packFrame` → `createFrameQr` → raster) se pinta en la terminal.
- [ ] Un teléfono con el receptor Decimen existente **decodifica ese frame estático**.
- [ ] Con el stream animado corriendo, un archivo de 100 KB llega completo y con SHA-256 OK.
- [ ] Queda anotada la versión de QR máxima decodificable de forma confiable, y a qué fps.

### Si la Fase 0 falla

No se abandona el track: se degrada el producto a la ruta **APNG**, que ya está escrita y no
tiene riesgo de renderizado. `export` escribe el archivo, el usuario lo abre con cualquier visor
de imágenes y el teléfono lo lee de la pantalla. Se pierde el caso "servidor headless" (un
headless no tiene visor) y se conserva un CLI útil y demostrable. **Decidir esto en Fase 0, no
en Fase 3.**

**Presupuesto: medio día. Si se pasa de un día, es no-go.**

---

## 6. Estructura del repo

```
.
├── bin.mjs                  # entrypoint del template, conservado
├── app.js                   # recursos de update (del template)
├── package.json             # campo `upgrade` con el link de `pear touch`
├── scripts/make.js          # build multiplataforma (del template)
├── src/
│   ├── cli.ts               # parseo de argv, subcomandos, ayuda
│   ├── platform.ts          # LOS SHIMS: digest/gzip/gunzip/deflate sobre bare-*
│   ├── render/
│   │   ├── graphics.ts      # protocolo gráfico de terminal (preferido)
│   │   ├── halfblocks.ts    # fallback ANSI
│   │   └── detect.ts        # qué soporta esta terminal + tamaño
│   ├── stream.ts            # el loop: encoder → frame → render → cadencia
│   └── commands/
│       ├── send.ts
│       ├── export.ts
│       └── doctor.ts
├── vendor/decimen/          # archivos portados, SIN editar la lógica
│   ├── protocol.ts          # + el arreglo de classifyFrame
│   ├── fountain.ts
│   ├── qr-frame.ts
│   ├── qr-raster.ts
│   ├── png.ts  apng.ts  zip.ts
│   ├── frame-capacity.ts  progress.ts  snippet.ts  export.ts
│   └── PROVENANCE.md        # commit exacto de origen + lista de cambios
├── test/
│   ├── golden.test.ts       # vectores de cable traídos de upstream
│   ├── platform.test.ts     # los shims dan los mismos bytes que el navegador
│   └── render.test.ts       # el raster que se pinta es el esperado
├── docs/
│   ├── plan.md              # este archivo
│   └── demo-script.md
├── LICENSE                  # AGPL-3.0-or-later
├── NOTICE                   # atribución a Decimen y a sus dependencias
└── README.md                # link pear:// arriba
```

Nombre de trabajo propuesto: **`lumo`** o **`beam`**. Conviene que no se llame `decimen-algo`:
somos un derivado con atribución, no el proyecto original.

---

## 7. Fases de implementación

### Fase 1 — Núcleo portable (1 día)

1. Clonar `hello-pear-bare`. Conservar `bin.mjs`, `app.js`, `scripts/make.js`, la estructura de
   test. Correr `bare bin.mjs --no-updates` y confirmar que arranca **antes** de tocar nada.
2. Copiar los archivos de §4 a `vendor/decimen/`. Escribir `PROVENANCE.md` con el hash del commit
   de origen.
3. Escribir `src/platform.ts` con los cuatro shims sobre `bare-zlib` / `bare-crypto`.
4. Redirigir esos 6 puntos de uso a `platform.ts`. Nada más.
5. Traer los vectores golden de upstream a `test/golden.test.ts` y hacerlos pasar bajo Bare.
   **Esta es la compuerta de la fase:** si los vectores golden pasan, el port es correcto y
   somos compatibles a nivel de cable con el receptor que ya existe.
6. Verificar que el paquete `qrcode` carga bajo el sistema de módulos de Bare. *Riesgo abierto:
   no lo pude confirmar sin el runtime instalado. Si no carga, la salida es fijar el generador
   de matriz QR (es puro JS) o portar solo la porción que usa `createFrameQr`.*

### Fase 2 — Renderizador de terminal (1–1.5 días)

Ya con la estrategia elegida en Fase 0.

1. `render/detect.ts`: tamaño de terminal vía `bare-tty`, detección de soporte gráfico, y de ahí
   la versión de QR máxima. Alimenta a `doctor`.
2. El renderizador elegido. Salida = un frame pintado a partir de un raster.
3. Cadencia: un loop a fps fijo con reloj monotónico. **No** intentar el flip escalonado de
   celdas del emisor web — eso requiere repintar rectángulos parciales, que un PTY no da bien.
   Grilla de un solo código en v1.
4. Manejo de resize (SIGWINCH) y restauración de la terminal al salir, incluido Ctrl-C. Una
   terminal que queda rota después de Ctrl-C es lo primero que nota un jurado.

### Fase 3 — Superficie del CLI (0.5 día)

- `send <archivo> [--fps N] [--ecc L|M|Q|H] [--version N]`
- `export <archivo> [--format apng|zip] [--fps N] [--scale N] [--cycles N]`
- `doctor`
- `--help` que se entienda sin leer el README, y errores que digan qué hacer — el upstream es un
  buen modelo acá: cuando el archivo no entra al tamaño de frame elegido, nombra el valor que sí
  funciona en lugar del mínimo aritmético.

### Fase 4 — Empaquetado Pear y OTA (1 día)

Es un requisito duro del track y es donde se pierden puntos por no ensayarlo.

1. `pear touch` → obtener el link. Ponerlo en el campo `upgrade` del `package.json` y en el README.
2. `pear stage <link>` con el proyecto.
3. `pear seed <link>` y dejarlo corriendo (un peer tiene que estar online seedeando, o el jurado
   no puede instalar).
4. `pear build` para los binarios multiplataforma via `scripts/make.js`.
5. **Ensayar la instalación en una máquina limpia** — una VM, o al menos otro usuario del sistema.
   El track dice explícitamente que el jurado instala como usuario final.
6. **Ensayar el OTA:** instalar la versión publicada, hacer un cambio visible (que el banner de
   `send` diga v2), stagear, y ver la copia instalada actualizarse. Grabar esto: es un requisito
   con nombre propio.

### Fase 5 — Entregables (0.5 día)

Ver §9.

---

## 8. Estrategia de testing

El activo acá es que **los vectores golden de upstream son un oráculo de compatibilidad**. No
testeamos contra nosotros mismos: testeamos contra bytes fijos que el receptor que ya existe en
producción sabe leer.

| Nivel | Qué prueba | Cómo |
|---|---|---|
| Vectores golden | el formato de cable no se movió en el port | bytes fijos traídos de upstream |
| Shims | `bare-zlib`/`bare-crypto` dan los mismos bytes que el navegador | comparar contra vectores capturados en Node |
| Raster | el frame pintado corresponde al raster esperado | snapshot del buffer |
| End-to-end en JS | `packFile` → frames → decodificar con `LTDecoder` → `unpackFile` → SHA-256 | sin cámara, todo en proceso |
| End-to-end real | terminal → teléfono → archivo íntegro | manual, es el demo |

El end-to-end en JS es el que da confianza barata: reconstruye el archivo sin cámara, así que
corre en CI y detecta cualquier rotura de la cadena fountain.

---

## 9. Entregables de la submission

1. **Repo público** con README que abra con: qué es, el link `pear://`, y cómo instalarlo en tres
   líneas.
2. **Permalinks directos al código** que integra la pila Pear — el jurado quiere ver la
   integración, no buscarla.
3. **Video de demo.** Guion propuesto, en este orden:
   - `pear install pear://<key>` en una máquina limpia (30 s)
   - `lumo doctor` mostrando qué densidad soporta esa terminal (10 s)
   - `lumo send secreto.key`, teléfono apuntando a la terminal, archivo recibido y SHA-256 verde (60 s)
   - **la actualización OTA llegando a la copia instalada** (30 s) ← requisito con nombre propio
   - una frase sobre el reparto: Pear distribuye la herramienta, la luz mueve los datos (10 s)
4. **Instrucciones de setup** con `.env` de ejemplo si hace falta, y qué terminales están
   soportadas.
5. **Limitaciones dichas en voz alta:** el receptor es un teléfono; el throughput es de KB/s, no
   de MB/s; qué terminales quedan afuera. El track premia honestidad sobre los límites — el
   criterio de QVAC lo dice explícito y el de Pears valora "utilidad en el mundo real", que se
   evalúa mejor cuando los límites están claros.

---

## 10. Registro de riesgos

| # | Riesgo | Probabilidad | Impacto | Mitigación |
|---|---|---|---|---|
| 1 | La densidad en terminal no alcanza para un decode confiable | media-alta | mata el producto | Fase 0 con go/no-go; fallback a APNG |
| 2 | Tearing / repintado del PTY rompe frames | media | throughput bajo | protocolo gráfico en vez de ANSI; un solo código, no grilla |
| 3 | El paquete `qrcode` no carga bajo Bare | media | 1 día perdido | fijar el generador de matriz, es JS puro |
| 4 | `pear stage/seed/install` no sale limpio en máquina ajena | media | **falla un requisito duro** | Fase 4 completa a mitad del hackathon, no al final |
| 5 | El seeder se cae y el jurado no puede instalar | baja | falla la evaluación | dejar `pear seed` corriendo en una máquina estable |
| 6 | Objeción de originalidad por derivar de un repo ajeno | media | pierde puntos | §11 |
| 7 | Tiempo: 5 fases en un hackathon corto | alta | alcance recortado | v1 es `send` + `export` + OTA. `decode` es stretch y se sacrifica primero |

El riesgo 4 es el más subestimado: es puramente de plomería, no tiene nada de intelectualmente
interesante, y es el que descalifica.

---

## 11. Licencia, atribución y originalidad

`decimen-optical-transfer` es **AGPL-3.0-or-later** y tiene CLA. Consecuencias concretas:

- El derivado **también es AGPL-3.0-or-later**. Poner el `LICENSE` correcto desde el primer commit.
- `NOTICE` con atribución a Decimen (y su cadena: `node-qrcode`, y zxing-cpp/Apache-2.0 si en algún
  momento se toca el decoder).
- `vendor/decimen/PROVENANCE.md` con el commit exacto de origen y la lista de cambios. Esto no es
  burocracia: es lo que le permite a un juez ver en diez segundos qué escribimos nosotros.

Sobre originalidad, y conviene ser honesto internamente: **derivar de un proyecto ajeno de 17.5k
líneas, muy pulido, puede jugar en contra** si no queda cristalino qué se construyó durante el
evento. Lo que lo vuelve defendible:

- El aporte propio es real y nombrable: el renderizador de terminal, la capa de shims para Bare,
  el CLI, y toda la integración Pear/OTA. Nada de eso existe en upstream.
- Un PR a upstream con el arreglo de `classifyFrame` — encontrado y verificado por nosotros —
  demuestra que entendemos el código que reutilizamos.
- El `PROVENANCE.md` y el `NOTICE` hacen la separación explícita en lugar de dejarla implícita.

**Verificar antes de empezar:** si no sos el autor de `decimen-optical-transfer` (el repo es de
`bashalarmistalt` / Evan Crawley), avisale. No es obligación legal más allá de la AGPL, pero un
"derivé tu proyecto para un hackathon y te mando un fix" es la diferencia entre un aliado y una
queja pública a mitad del evento.

---

## 12. Secuencia y presupuesto

En días de trabajo desde el arranque, no en fechas:

| Día | Fase | Compuerta |
|---|---|---|
| 0.5 | **Fase 0** — spike de densidad | **go/no-go. Si falla, pivote a APNG hoy** |
| 1.5 | Fase 1 — núcleo portable | los vectores golden pasan bajo Bare |
| 3 | Fase 2 — renderizador | un archivo de 100 KB llega íntegro al teléfono |
| 3.5 | Fase 3 — CLI | `--help` se entiende sin el README |
| 4.5 | **Fase 4** — Pear + OTA | instalación limpia en máquina ajena + OTA grabada |
| 5 | Fase 5 — entregables | video grabado, README con el link |

Colchón deliberado: si algo se pasa, lo que se sacrifica es el fallback ANSI y el `decode`
stretch — nunca la Fase 4, que es un requisito del track.

---

## 13. Primeros tres comandos

```bash
git clone https://github.com/holepunchto/hello-pear-bare lumo && cd lumo
rm -rf .git && git init
bare bin.mjs --no-updates    # confirmar que el template arranca antes de tocar nada
```

Y en paralelo, la Fase 0: pintar un frame de Decimen en la terminal y ver si un teléfono lo lee.
Todo lo demás depende de esa respuesta.
