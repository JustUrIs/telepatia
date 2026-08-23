# telepatía

**El corrector que corre antes de apretar Cycle Start en una máquina de medio
millón de dólares.**

Un agente local lee la orden de trabajo y el setup sheet, los compara contra el
programa de CNC que está por cargarse, y dice en cinco segundos si el papeleo y
el programa dicen lo mismo. Todo en la máquina del técnico: sin nube, sin API
keys, sin que un solo byte salga del taller.

Y cuando el programa está aprobado, cruza a la máquina aislada **por luz** —
pantalla a cámara— en vez de por un pendrive.

---

## El problema

Antes de mandar un `.nc` a un CNC, un operario tiene cuatro cosas abiertas: la
orden de trabajo, el setup sheet, el plano y el programa. Y hace a mano una
reconciliación:

> ¿Es el archivo correcto? ¿Es Rev C? ¿Usa las herramientas que tengo montadas?
> ¿Es para esta máquina? ¿Los offsets coinciden?

A las siete de la mañana, con treinta piezas en cola, esa revisión se hace en
diagonal. Cuando falla:

| Error | Consecuencia |
|---|---|
| Rev B en vez de Rev C | el lote entero al tacho |
| Llama `T7` y en el carrusel hay `T1`, `T2`, `T3` | choque de herramienta, husillo roto |
| `G55` cuando el cero está en `G54` | la pieza entera corrida |
| RPM o avance sobre el límite del setup | herramienta partida |

Y esas máquinas están aisladas de la red a propósito, así que el archivo llega
caminando, en un pendrive — que es una computadora con firmware propio metida
adentro de un objeto que parece inofensivo.

---

## Qué hace, y quién hace qué

La decisión de diseño del proyecto es **la división de trabajo**:

```
orden de trabajo, setup sheet     →  MODELO LOCAL (no tienen estructura)
programa .nc                      →  CÓDIGO DETERMINISTA (lenguaje regular)
veredicto                         →  CÓDIGO, comparando los dos conjuntos
```

**El modelo nunca decide.** Extraer `T7` de un `.nc` es un tokenizador de cien
líneas, exacto y demostrable; meter una alucinación en ese camino para
ahorrárselo sería un error. El modelo lee lo que no tiene estructura, el código
parsea lo que sí, y el veredicto sale de comparar.

Cuatro capas, y ninguna alcanza sola:

| Capa | Frena |
|---|---|
| **Esquema** | extracciones malformadas. Y no existe el campo `approved`: el modelo no tiene dónde escribir una conclusión |
| **Grounding** | valores que el modelo no puede señalar en los píxeles del documento — alucinación o inyección |
| **Confianza** | datos críticos leídos con OCR flojo. `Rev B` contra `Rev C` es un carácter |
| **Checks deterministas** | todo lo que el papeleo y el programa no comparten |

---

## QVAC: qué modelos, dónde ocurre la inferencia

Toda la inferencia es local, vía `@qvac/sdk` 0.17.1. **Un solo archivo del
proyecto importa el SDK.**

| Rol | Modelo | Cuantización | Tamaño |
|---|---|---|---|
| OCR de los documentos | `OCR_LATIN` | — | 98 MB |
| Extracción estructurada | `QWEN3_4B_INST_Q4_K_M` | Q4_K_M | 2,50 GB |
| Plan B con poca RAM | `QWEN3_1_7B_INST_Q4` | Q4 | ~1,5 GB |

### Permalinks a la integración

Todo en [`src/audit/qvac-backend.js`](https://github.com/JustUrIs/telepatia/blob/3e2fff98e0e83a5a8c4c49365065b7ee2a3e0d0a/src/audit/qvac-backend.js):

| Qué | Línea |
|---|---|
| Import del SDK (diferido, para poder testear sin modelo) | [L85](https://github.com/JustUrIs/telepatia/blob/3e2fff98e0e83a5a8c4c49365065b7ee2a3e0d0a/src/audit/qvac-backend.js#L85) |
| `loadModel` del OCR | [L108](https://github.com/JustUrIs/telepatia/blob/3e2fff98e0e83a5a8c4c49365065b7ee2a3e0d0a/src/audit/qvac-backend.js#L108) |
| `loadModel` del LLM | [L113](https://github.com/JustUrIs/telepatia/blob/3e2fff98e0e83a5a8c4c49365065b7ee2a3e0d0a/src/audit/qvac-backend.js#L113) |
| `ocr()` — píxeles a bloques con bbox | [L136](https://github.com/JustUrIs/telepatia/blob/3e2fff98e0e83a5a8c4c49365065b7ee2a3e0d0a/src/audit/qvac-backend.js#L136) |
| `completion()` con `responseFormat: json_schema` | [L181](https://github.com/JustUrIs/telepatia/blob/3e2fff98e0e83a5a8c4c49365065b7ee2a3e0d0a/src/audit/qvac-backend.js#L181) |
| `getSystemResources()` | [L246](https://github.com/JustUrIs/telepatia/blob/3e2fff98e0e83a5a8c4c49365065b7ee2a3e0d0a/src/audit/qvac-backend.js#L246) |

Y dónde se usa: [`bin/preflight.mjs`](https://github.com/JustUrIs/telepatia/blob/3e2fff98e0e83a5a8c4c49365065b7ee2a3e0d0a/bin/preflight.mjs) ·
[`src/cnc/preflight.js`](https://github.com/JustUrIs/telepatia/blob/3e2fff98e0e83a5a8c4c49365065b7ee2a3e0d0a/src/cnc/preflight.js) (checks) ·
[`src/audit/ground.js`](https://github.com/JustUrIs/telepatia/blob/3e2fff98e0e83a5a8c4c49365065b7ee2a3e0d0a/src/audit/ground.js) (grounding).

### La gramática, y por qué importa

El texto del documento va **siempre** en un mensaje `role: 'user'` delimitado, y
nunca en `system`. Compartir canal entre instrucciones y datos es exactamente el
vector de confusión de roles. Y el `responseFormat: json_schema` fuerza la forma
por gramática, no por prompt.

---

## Hardware y latencias medidas

```
Intel i7-14650HX · 16 núcleos físicos / 24 lógicos · 34 GB RAM
NVIDIA RTX 4060 Laptop (CUDA disponible) · Windows 11 · Node 22.18
```

| Etapa | Tiempo |
|---|---|
| Carga de los dos modelos | 13–23 s |
| OCR de la orden de trabajo (850×1100) | 17,5 s |
| OCR del setup sheet | 12,6 s |
| Extracción QWEN3-4B con gramática | **7,8 s** |
| Checks deterministas + veredicto | < 50 ms |

Con la extracción ya hecha (`--job`), el pre-flight completo corre en **menos de
un segundo**.

## Entradas sucias, y dónde se rompe

El track pide entradas reales, no un PDF elegido a mano. Los documentos se
renderizan con tipografía real y se degradan a propósito:

| Variante | Datos clave recuperados | Confianza media |
|---|---|---|
| limpio | 6/6 | 0,90 |
| rotado 3° (foto a mano) | 6/6 | 0,90 |
| bajo contraste (fotocopia) | 6/6 | 0,88 |
| con ruido fuerte | **3/6** | **0,33** |

**El caso ruidoso falla, y decirlo importa más que esconderlo.** El OCR leyó
`4.0.0` como `4.0,8` y `4.3.0` como `4.340`. Pero los leyó con confianza 0,32 y
0,27 — y por eso existe la compuerta de confianza: un dato mal leído con
confianza baja es un problema que el sistema **puede ver venir**.

---

## Instalación desde un clone limpio

```bash
git clone https://github.com/JustUrIs/telepatia
cd telepatia
npm install
node scripts/pull-models.mjs --preset standard   # ~2,6 GB, una sola vez
node --test "test/*.test.js"                     # 389 tests
```

Requiere **Node ≥ 22**. Sin cuentas, sin API keys, sin variables de entorno.

## Uso

```bash
# Con los modelos: lee los documentos y decide
node bin/preflight.mjs fixtures/programs/part-1837-revB.nc

# Sin modelo, con una extracción ya hecha (instantáneo)
node bin/preflight.mjs fixtures/programs/part-1837-revC.nc \
  --job fixtures/shop/job-extracted.json
```

Códigos de salida: `0` listo · `1` revisar · `2` bloqueado.

**El modelo es opcional a propósito.** Sin él la herramienta sigue parseando el
programa, verificándolo y transfiriéndolo con su hash verificado. Lo que se pierde es la
lectura automática del papeleo, no la seguridad. Y corre en la laptop del
técnico, no en el CNC: un control de 2003 no puede correr un modelo de 4B, y
nadie quiere un modelo de lenguaje adentro de la base de cómputo confiable de
una máquina que mueve acero.

## El transporte óptico

```bash
node scripts/serve.mjs
```

Emisor y receptor en el navegador. El archivo aprobado cruza pantalla-a-cámara,
con fragmentación, paridad XOR y verificación SHA-256. **Se apaga el wifi y
sigue funcionando** — service worker, y el canal nunca usó la red.

Un pendrive es una computadora con firmware propio. Esto es luz: no hay
controlador que explotar del otro lado, y no hay canal de vuelta.

---

## Lo que NO hace

- **No simula el mecanizado.** No calcula colisiones, deflexión ni feeds contra
  material. Verifica que el papeleo y el programa digan lo mismo — un reclamo
  más chico y mucho más difícil de romper.
- El canal óptico mueve kilobytes por segundo. Un firmware de 200 MB no cruza.
- El software receptor llega al equipo aislado una primera vez por los medios
  que ya se usan; después se actualiza por luz.
- No reemplaza un data diode. Waterfall (WF FLIP) y Nexor (GuarDiode) ya
  resuelven entrada; la diferencia es que ellos abren una ventana de tiempo y
  acá se aprueba y se registra **cada artefacto, uno por uno**.

## Tests

```
389 tests · 0 fallos · ~1 s
```

Incluye un dominio anterior completo (conciliación de facturas contra extracto
bancario) que quedó como suite de regresión: es la prueba de que el motor de
grounding y veredicto es genérico y no está atado a este caso.

## Créditos

Ideas de transporte óptico estudiadas de
[decimen-optical-transfer](https://github.com/bashalarmistalt/decimen-optical-transfer)
(AGPL-3.0). El código de este repositorio es propio.

Parser de G-code: `src/cnc/gcode.js`, escrito con Codex durante el hackathon.
