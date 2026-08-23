# Plan: el producto para OT, con la IA haciendo trabajo real

**Escrito:** 2026-08-23, 03:00. **Entrega:** hoy 12:00. **Quedan ~9 h.**
**Track:** 🔷 QVAC. Premio 1: agentes locales que reemplazan trabajo de operaciones.

---

## 1. La tensión, dicha de frente

El pitch de OT es bueno y el mercado existe. Pero tiene un agujero para *este*
track:

> **Meter un parche firmado a una máquina aislada no necesita un LLM.**
> Necesita una firma criptográfica y un hash. Un modelo ahí es decoración, y el
> track descalifica la decoración: *"Local inference has to be doing real work in
> your product."*

Y del otro lado:

> **El track nombró como caso estrella exactamente lo que ya está construido y
> testeado:** conciliación de facturas contra extracto bancario, con explicación
> auditable en cinco segundos.

Tirar eso a 9 horas del cierre para reescribir el dominio entero es la peor
jugada disponible. Pero quedarse solo con facturas desperdicia el pitch, que es
mucho más grande.

### La síntesis

**El producto no es "transferencia óptica" ni "conciliación de facturas". Es
una compuerta de aprobación para documentos hostiles que tienen que cruzar un
límite de confianza.**

Los dos casos son el mismo problema con distinto disfraz:

| | Factura | Parche de OT |
|---|---|---|
| Quién escribe el documento | el proveedor, que quiere cobrar | el proveedor, o quien se haga pasar por él |
| Quién lo consume | un equipo que va a pagar | una máquina que controla algo físico |
| Qué se cruza | dinero | control de una válvula |
| Cómo se decide hoy | una persona leyendo | una persona leyendo |
| Fuente de verdad independiente | el extracto bancario | **el inventario de activos** |

**En los dos casos el atacante escribe el documento.** Y en los dos casos ya
medimos que una mentira coherente pasa el esquema, pasa el grounding y pasa la
aritmética — y solo la frena una fuente que el atacante no controla.

Eso ya está probado con el banco. Falta probarlo con el inventario de activos, y
ahí el pitch de OT deja de ser una promesa.

### Dónde la IA hace trabajo real, y no decoración

No en mover el parche. **En decidir si el parche merece cruzar.**

En OT regulado (NERC CIP, IEC 62443) no se aplica un parche porque sí. Cada
cambio a un sistema crítico exige un expediente de gestión del cambio: qué
cambia, por qué, qué CVE cierra, qué activos afecta, si requiere reinicio, cuál
es el rollback, quién aprueba. Eso lo arma hoy **una persona leyendo el aviso del
fabricante, las release notes y el boletín de CVE**, y escribiendo una nota
interna.

Eso es, palabra por palabra, lo que el track pide: *"work that today needs a team
of people reading documents and making judgment calls."*

Y **tiene que correr local por obligación, no por elegancia**: un ingeniero de
seguridad OT no puede mandar su inventario de activos y sus avisos de
vulnerabilidad a una API en la nube. Es exactamente lo que el air gap existe para
impedir. Acá "local" no es una feature: es la única forma en que el producto
puede existir.

---

## 2. Qué se construye, concretamente

### El motor no cambia

`ground.js`, `verdict.js` y el ledger son genéricos. No los tocamos. Lo único
específico del dominio es el esquema, los checks y la fuente de verdad.

| Pieza | Facturas (existe) | OT (se agrega) |
|---|---|---|
| Esquema | `INVOICE_SCHEMA` | `CHANGE_SCHEMA` |
| Documento de entrada | factura escaneada | aviso de seguridad del fabricante |
| Fuente independiente | `statement.csv` (banco) | `assets.csv` (inventario) |
| Checks aritméticos | subtotal + IVA = total | rangos de versión, formato CVE, no-downgrade |
| Ledger | factura no duplicada | **parche no reaplicado** (anti-replay) |
| Veredicto | pagar / revisar / rechazar | aplicar / revisar / rechazar |

### El esquema del cambio (`CHANGE_SCHEMA`)

Campos que un ingeniero OT necesita sí o sí, sacados del aviso:

```
vendor              fabricante que emite el aviso
advisoryId          identificador del aviso (ej. ICSA-26-123-01)
product             producto afectado
affectedVersions    rango afectado (ej. "4.0.0 - 4.2.3")
fixedVersion        versión que corrige
cveIds[]            CVE que cierra
cvssScore           severidad 0.0 - 10.0
requiresReboot      si obliga a parar el equipo
rollbackAvailable   si se puede volver atrás
prerequisites[]     qué hay que tener antes
```

Sin `approved`. Sin `recommendation`. **El modelo no tiene acceso a la variable
del veredicto** — igual que en facturas. Eso es lo que hace que una inyección
exitosa siga sin poder aprobar un parche.

### Los checks, en código y sin modelo

1. `versions_coherent` — la versión corregida está fuera del rango afectado. Un
   aviso que dice "afecta 4.0–4.5, corregido en 4.2" es un aviso falsificado o
   mal leído, y en los dos casos no se aplica.
2. `no_downgrade` — la versión corregida es mayor que la instalada. Un "parche"
   que baja la versión es un ataque de downgrade, que es cómo se reintroduce una
   vulnerabilidad ya cerrada.
3. `cve_format_valid` — `CVE-\d{4}-\d{4,}`. Barato, y corta avisos inventados.
4. `cvss_in_range` — 0.0 a 10.0.
5. `affects_installed_assets` — **el check que vale**. Cruza contra
   `assets.csv`: si el aviso dice que afecta al producto X versión Y y no tenés
   ni un activo así, o el aviso está mal o alguien te está mandando un parche
   para algo que no tenés. Las dos cosas se revisan a mano.
6. `reboot_declared_for_critical` — un activo marcado como crítico con un parche
   que exige reinicio no se auto-aprueba nunca: eso lo firma una persona.
7. `patch_not_replayed` — el ledger. El mismo `advisoryId` ya aplicado no vuelve
   a entrar. Anti-replay, que es la defensa contra reenviarte un paquete viejo y
   legítimo en un momento en que ya no lo es.

### El inventario de activos (`fixtures/assets.csv`)

La fuente de verdad que el atacante no controla. Formato de un export real de un
CMDB, sucio a propósito para que lo coma el parser de T-07/T-08:

```csv
Tag;Producto;Version;Zona;Criticidad;Ultimo parche
PLC-0231;Widget PLC;4.1.0;Zona 2;alta;15-03-26
PLC-0232;Widget PLC;4.2.3;Zona 2;alta;2026-05-02
HMI-0104;Widget HMI;3.9.1;Zona 1;media;10/01/2026
```

El mismo `parseCsv` + un `normalize` de activos. Reusa el trabajo hecho.

### El corpus adversario, en versión OT

Los mismos ataques, traducidos. Y uno nuevo que es específico de este dominio y
que es el que cierra el pitch:

- `ot-inject-approve` — el aviso trae texto dirigido al lector automático.
- `ot-downgrade` — el "parche" baja la versión. Aritmética, no modelo.
- `ot-fake-cve` — CVE con formato inválido.
- `ot-not-installed` — parche para un producto que no está en el inventario.
- **`ot-coherent-forgery`** — aviso falso **completo y coherente**: fabricante
  real, formato de CVE válido, versiones consistentes, todo anclado en los
  píxeles. Pasa esquema, grounding y aritmética.
  **Solo lo frena el inventario de activos.** Es el gemelo exacto del hallazgo
  del banco, y es lo que demuestra que la arquitectura no es una lista de
  filtros.
- `ot-control-*` — avisos legítimos que **tienen** que pasar. Sin estos el
  número no vale nada.

---

## 3. El riesgo número uno, y va primero

**El modelo real nunca corrió.** Todo lo demostrado usa `FakeBackend`.

El track dice, textual:

> *"Permalinks to the QVAC integration, direct GitHub links to the files/lines
> where inference happens. **This is what we look at first.**"*
> *"Model and hardware details: which model, which quantization, what machine,
> rough latency."*
> *"A demo that only works on one cherry-picked input gets discarded without
> further review."*

Sin una corrida real, con números medidos, sobre entradas que no elegimos de
antemano, el resto no importa. **Esto es la tarea 0.**

---

## 4. Plan de ejecución

### Tarea 0 — La IA real (3 h, ABORTABLE a las 07:00)

| # | Qué | Presupuesto |
|---|---|---|
| 0.1 | Bajar el modelo. Preset chico primero (`QWEN3_1_7B_INST_Q4`, ~1.5 GB) y el 4B en paralelo si la red aguanta | 45 min, en background |
| 0.2 | `QvacBackend.ocr()` corriendo sobre una imagen de factura de verdad | 45 min |
| 0.3 | `QvacBackend.extract()` con gramática de JSON Schema, verificando que el 1.7B la respete | 45 min |
| 0.4 | `getSystemResources()` + latencias por etapa, escritas a `docs/benchmark.md` | 30 min |
| 0.5 | Correr sobre 3 entradas que NO elegimos: foto torcida, foto con poca luz, escaneo con ruido | 15 min |

**Compuerta 07:00:** si el modelo no bajó o no corre, se declara en el README con
los números que sí tenemos y se sigue con `FakeBackend`. **No se pelea con esto
después de las 07:00.**

### Tarea 1 — La capa OT (2 h)

| # | Qué | Presupuesto |
|---|---|---|
| 1.1 | `src/audit/ot-schema.js` con `CHANGE_SCHEMA` | 20 min |
| 1.2 | `fixtures/assets.csv` + `normalizeAssets()` reusando `parseCsv` | 25 min |
| 1.3 | `src/audit/ot-reconcile.js` con los 7 checks | 40 min |
| 1.4 | `matchAsset()`: cruza el aviso contra el inventario | 20 min |
| 1.5 | Corpus OT con controles y `ot-coherent-forgery` | 35 min |

**Todo reusa `ground.js`, `verdict.js` y el ledger sin tocarlos.** Si algo de eso
hay que modificar, es señal de que me equivoqué de diseño y hay que parar.

### Tarea 2 — Entregables (2.5 h)

| # | Qué | Presupuesto |
|---|---|---|
| 2.1 | README: la tesis, las dos métricas, permalinks a donde ocurre la inferencia, modelo/hardware/latencia, setup desde clone limpio | 1 h |
| 2.2 | Guion del video de 3 min | 30 min |
| 2.3 | Grabar | 1 h |

### Colchón — 1.5 h

---

## 5. El guion del video, en borrador

Tres minutos, y el orden importa.

**0:00 – 0:25 · El problema, con una imagen**
Una planta potabilizadora. Máquinas aisladas a propósito. Y aun así, la forma
real de meterles una actualización en 2026 es un tipo caminando con un pendrive.
Natanz cayó así: el air gap no falló, falló el momento en que alguien tuvo que
cruzarlo con las manos.

**0:25 – 0:50 · Por qué nadie lo resolvió**
Hay una industria de mil millones de dólares —data diodes— dedicada a sacar
datos de forma segura. Ninguno mete datos. Es la misma puerta, vigilada de un
solo lado.

**0:50 – 1:35 · La demo del transporte**
Pantalla emitiendo, celular leyendo. **Se apaga el wifi en cámara y sigue
funcionando.** El archivo llega, SHA-256 verificado. Un pendrive es una
computadora escondida con firmware propio; esto es luz. No hay controlador que
explotar del otro lado.

**1:35 – 2:35 · La compuerta, que es donde vive la IA**
El aviso del fabricante entra al agente local. Extrae el expediente de cambio.
**Y acá está lo que importa:** cada campo tiene que poder señalarse en los
píxeles del documento. Un valor que el modelo no puede anclar no es un dato, es
una alucinación o una inyección, y va a revisión humana.
Después: el aviso falso coherente. Pasa el esquema, ancla entero, la aritmética
cierra. **Lo frena el inventario de activos**, que el atacante no controla.
Números en pantalla: 100% de bloqueo, 0% de falsos positivos.

**2:35 – 3:00 · El cierre**
Todo corre local, en un modelo de 4B, en esta máquina, sin red. No porque sea
elegante — porque un ingeniero de seguridad OT no puede mandar su inventario de
activos a una API en la nube. Es lo único que el air gap existe para impedir.

---

## 6. Lo que NO se hace

Decidido de antemano, para que nadie lo proponga a las 09:00:

- **No se tira la conciliación de facturas.** Es el caso estrella nombrado por el
  track y está terminado y testeado. Queda como el segundo dominio, y su
  existencia es la prueba de que el motor es genérico.
- **No se reescribe el motor.** Si la capa OT obliga a tocar `ground.js` o
  `verdict.js`, el diseño está mal.
- **No se pelea con el modelo después de las 07:00.**
- **No fountain codes, no grilla de QR, no auditar en el browser.** Ya medido y
  descartado.
- **No se toca el Vault Guardian** hasta que el proyecto esté entregado. Es un
  premio aparte y no puntúa el proyecto.

---

## 7. La frase

> Una compuerta que solo deja pasar lo que puede señalar en los píxeles — y que
> para lo que sí está en los píxeles, pregunta a una fuente que el atacante no
> escribió.

El transporte óptico no es el producto: es la prueba verificable de que la
compuerta corre donde tiene que correr. Se apaga el wifi en cámara y sigue
funcionando.
