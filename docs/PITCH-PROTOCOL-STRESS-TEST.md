# Telepatía — Pitch Protocol stress test local

> Este documento usa el schema público de Pitch Protocol como checklist de inversor.
> **No es una aplicación y ningún dato de Telepatía fue enviado a Pitch Protocol.**
> Las respuestas marcadas como hipótesis o faltantes no deben convertirse en hechos en el
> pitch.

Schema consultado el 2026-08-23:
<https://api.pitchprotocol.vc/v1/applications/schema>

## Intento de crítica externa

Se creó un pitch **privado** en Pitchr para un panel con Peter Thiel, Jony Ive y
Linus Torvalds:
<https://pitchr.studio/pitch/3ce2e3c1-c4fe-4fa2-93ac-22c91b18937b>.

Los tres panelistas respondieron que el servicio de IA no estaba disponible. Por lo tanto,
**no hubo crítica, score ni veredicto externo** y ninguna conclusión de este documento se
atribuye al panel. No crear más pitches hasta que Pitchr recupere el servicio.

## Verificación técnica de esta iteración

- `npm test` antes del fix: exit 0, **0 tests** en Windows por las comillas simples del
  glob. Era un falso verde.
- `node --test "test/*.test.js"` con dependencias instaladas: **370 pass, 0 fail**.
- `npm test` después del fix portable: **370 pass, 0 fail**, 1,1 s en la corrida
  verificada.
- `npm run test:model` después del mismo fix sí descubre la suite. Dos casos de factura se
  saltean por fixture ausente y el test de hardware pasa; luego la suite no emitió avance
  durante aproximadamente cinco minutos y fue interrumpida manualmente. **No contar la
  suite de modelo como verde.** Investigar/capturar el golden run por separado.

## Veredicto ejecutivo

El pitch explica muy bien **qué construimos**, **por qué la arquitectura AI + código es
correcta** y **por qué el QR dinámico importa físicamente**. Sus huecos no son técnicos;
son los que un inversor usa para distinguir un gran demo de una compañía:

1. No hay todavía evidencia de que un responsable de planta pagaría por esta solución.
2. “Integradores industriales” es una hipótesis de canal, no distribución validada.
3. El moat tiene buenos componentes, pero todavía no existe acumulación demostrada.
4. `Why now` faltaba dentro del guion hablado; esta iteración ya lo agregó y ahora
   necesita el golden run que respalde su costo/latencia sobre hardware común.
5. No hay datos suficientes para mercado, equipo, ronda o tracción comercial. No
   inventarlos para completar un formulario que no vamos a enviar.
6. Antes de decir que “solo cruza lo aprobado”, hay que ligar el reporte del preflight a
   los bytes que el emisor acepta. Hoy son dos pasos separados.

### Autoevaluación interna — no es un score de Pitch Protocol

| Dimensión | Estado | Evidencia o hueco |
|---|---|---|
| Problema | fuerte | error físico + USB/air-gap paradox + costo |
| Producto | fuerte | preflight real y transporte óptico funcionando |
| Core insight | fuerte | el air gap tercerizó el ingreso a un humano con USB |
| Arquitectura AI | fuerte | AI estructura; código decide; grounding/confianza |
| Diferencial | fuerte pero debe matizarse | capa semántica antes del canal; existen guards de ingreso |
| Why now | medio-fuerte | ya está en el pitch; falta consolidar mediciones del golden run |
| ICP/comprador | medio-bajo | roles plausibles, ninguna entrevista documentada |
| Tracción | bajo | prototipo y tests, sin usuarios/pilotos/ingresos |
| Distribución | bajo | integradores como hipótesis |
| Moat actual | bajo-medio | componentes correctos, todavía no acumulados |
| Moat potencial | fuerte | policies + evaluación + workflow + confianza/distribución |
| Seguridad de claims | medio | SHA/firma e integración preflight/emisor requieren precisión |

## Convención de evidencia

- **CONSTRUIDO:** existe en el repositorio y puede demostrarse.
- **MEDIDO:** existe un artefacto reproducible con hardware/commit/input.
- **FUENTE EXTERNA:** dato de una fuente primaria citada.
- **HIPÓTESIS:** dirección plausible aún no validada con clientes.
- **FALTANTE:** requiere respuesta o evidencia del equipo; no completar por intuición.

## Mock application legible

### Company

- **Name:** Telepatía. — **CONSTRUIDO**
- **Stage:** `prototype`. — **CONSTRUIDO**
- **Category:** Local AI safety gate for air-gapped industrial operations. — descripción
  propuesta
- **Sectors:** `security`, `ai`, `hardware`. — clasificación propuesta
- **Customer type:** `b2b`. — **HIPÓTESIS**
- **Location / country:** **FALTANTE**. No hace falta para el hackathon pitch, pero sí para
  cualquier conversación real de inversión.

### One-liner — 157/200 caracteres

> Telepatía stops wrong files before they reach air-gapped industrial machines: local AI
> reads the job, code verifies it, and light carries the approved bytes.

Esta versión nombra el resultado antes que la tecnología. Para máxima precisión mientras
no exista el binding preflight/emisor, reemplazar `approved bytes` por `verified file`.

### What are you building?

> Telepatía is a semantic ingress gate for isolated industrial systems. On the engineering
> side of an air gap, QVAC OCR and a local quantized model convert worn work orders and
> setup sheets into structured, grounded job requirements. Deterministic parsers compare
> those requirements with the machine program and return approve, review, or block. For
> approved artifacts, a sender fragments the file into dynamic QR frames with parity; a
> fixed camera on the isolated side reconstructs the original bytes and verifies SHA-256.
> The CNC prototype catches wrong revision, tooling, work offset, spindle and feed before
> Cycle Start. The architecture can later extend to PLC logic, robot programs, recipes and
> maintenance packages.

**Fuente:** implementación y fixtures del repositorio. **Precisión pendiente:** hoy el
preflight y el sender existen, pero el reporte todavía no restringe el archivo elegible.

### Problem

> Industrial machines still need programs, configurations and maintenance artifacts even
> when their networks are isolated. Plants often bridge that last mile with removable
> media and manual reconciliation. Existing controls can inspect media or constrain a
> transfer channel, but they usually cannot answer whether this exact program agrees with
> this exact physical job. A one-character revision error can become scrap, downtime or
> equipment damage; the same manual ingress path also expands the removable-media attack
> surface.

**Fuente:** caso CNC construido + Siemens/Honeywell para contexto. El ejemplo de 24 partes
o crash de spindle es escenario de demo, no un incidente real de cliente.

### Core insight

> The air gap did not eliminate ingress; it made ingress invisible. It moved the final
> security decision from a network control to a human carrying a file and comparing messy
> paperwork under time pressure. Securing the pipe is necessary but insufficient when the
> highest-risk question is semantic: does the payload match the physical job? Local AI can
> now read the ambiguous documents without exporting sensitive plant context, while
> deterministic code can own the safety verdict. The optical channel then makes the last
> mile visible, narrow and independent of removable storage.

Esta es la respuesta más fuerte del pitch. Debe aparecer temprano y con lenguaje simple.

### Who wants this most?

> Initial hypothesis: CNC job shops and regulated plants that keep production equipment
> isolated, change programs frequently, still use removable media, and experience a high
> cost from loading the wrong revision. The daily user is a CNC or OT engineer; the likely
> economic buyer is a plant manager, operations leader or OT security owner; an industrial
> integrator may influence or deliver the purchase.

**HIPÓTESIS.** Falta descubrir cuál dolor abre presupuesto: scrap/quality, downtime,
cybersecurity compliance o simplificación operativa. No presentar cuatro compradores a la
vez como si ya estuvieran validados.

### Why do you win even if others know this?

> The QR protocol is reproducible and is not the moat. The defensible system compounds in
> machine- and workflow-specific policy packs, parsers and evaluation cases; grounded
> evidence of real failure modes and false positives; integration at the exact approval
> point before a program reaches the machine; and distribution through trusted industrial
> integrators. An open transport protocol can improve auditability while the proprietary
> value sits in domain policy, deployment knowledge and trust. Today we have the first CNC
> policy pack and adversarial test harness; the corpus, integrations and channel are a moat
> hypothesis still to be earned.

**Privacidad:** no asumir un data flywheel central. Datos de plantas air-gapped no pueden
salir automáticamente. El corpus solo puede crecer con casos sintéticos, permiso explícito
o evidencia anonimizada; de otro modo el valor acumula dentro del despliegue del cliente.

### What changed recently that makes this work now?

> Quantized local models can now extract structured meaning from imperfect industrial
> documents on ordinary hardware, with no cloud API and with evidence/confidence available
> to a deterministic gate. Commodity cameras, browsers and QR libraries also make a
> practical optical last mile possible without custom transfer hardware. The new
> capability is not the QR by itself; it is affordable semantic verification at the edge
> before the transfer occurs.

**CONSTRUIDO parcialmente / MEDICIÓN por consolidar.** Grabar un golden run único y no
mezclar download, cold load, OCR y warm inference.

### Traction

Respuesta honesta hoy:

> Prototype, no commercial traction claimed. The repository contains an end-to-end CNC
> preflight, an optical fragmentation/parity/SHA transport and an adversarial harness. On
> the current Windows environment, 370 non-model tests pass once dependencies are
> installed and the test glob is invoked correctly. Physical transfer reliability and
> customer demand still need to be measured.

**CONSTRUIDO y MEDIDO**, salvo la parte física aún pendiente. Tests no equivalen a
tracción; usarlos como prueba de ejecución, nunca como adopción.

### Team

- Founder names, roles, backgrounds, LinkedIn, full-time status: **FALTANTE**.
- How founders met and why this team has an unfair right to win: **FALTANTE**.

Para el pitch de hackathon hacen falta una sola oración sobre quién construyó qué y por
qué el equipo puede seguir. No inventar experiencia industrial que no existe.

### Raise

**NO APLICA.** No completar monto, ronda, runway, burn o valuation: el equipo no quiere
aplicar y no suministró esta información.

## Campos opcionales que sí mejoran el pitch

### Hardest part / what we most want to be wrong about

> Our biggest product risk is not QR throughput. It is whether plants will trust and adopt
> a new approval step while the system maintains extremely low false approvals and an
> operationally acceptable review rate on messy documents. The next proof is a physical
> pilot with real programs, operator observation and measured false-approve/false-review
> rates.

Esta respuesta muestra madurez. El riesgo secundario es autenticidad/gestión de claves,
que debe resolverse antes de claims high-assurance.

### Market size

**FALTANTE.** No convertir el costo por hora de downtime en TAM. Para dimensionar mercado
se necesitan número de sitios/celdas elegibles, presupuesto comparable, precio plausible
y una estrategia de expansión. El pitch de tres minutos puede omitir TAM si el formato no
lo exige.

### How users find you

> Hypothesis: industrial automation and OT security integrators introduce Telepatía during
> segmentation, machine commissioning and change-control projects. The direct path starts
> with a design-partner CNC shop where the founder can observe the workflow and quantify
> prevented errors/review time.

**HIPÓTESIS.** Siguiente evidencia: tres conversaciones con operadores, tres con
responsables de planta/OT y dos con integradores.

### How you make money

> Hypothesis: annual software license per site or protected cell, plus domain policy packs,
> integration and support. Commodity camera/display hardware is customer-supplied or sold
> through an integrator; the long-term gross margin should come from software and policy,
> not proprietary QR hardware.

No presentar pricing hasta contrastarlo con presupuesto y costo de integración.

## Las preguntas que probablemente haría un fondo

### 1. ¿Quién tuvo este problema la semana pasada?

Hoy no tenemos una historia de cliente documentada. Respuesta correcta: construimos a
partir de un workflow industrial verificable y ahora necesitamos design partners. No
inventar “clientes esperando”.

### 2. ¿Por qué una planta no agrega un checkbox a su procedimiento existente?

Porque el cuello de botella no es recordar el procedimiento, sino leer y reconciliar
entradas heterogéneas bajo presión y conservar evidencia. Pero hay que demostrar que la
automatización reduce errores sin aumentar demasiado las revisiones.

### 3. ¿Por qué no comprar Nexor, Waterfall, Honeywell u OPSWAT?

Porque protegen arquitectura, medios o contenido con productos maduros. Telepatía no debe
competir afirmando que ellos no importan archivos: entra antes, verificando que el
artefacto coincida con el trabajo físico. Puede integrarse con un guard/CDR existente.

### 4. ¿Por qué AI?

Porque las órdenes y setup sheets son fotos, fotocopias y layouts variables. No usar AI
para G-code ni para decidir; esa parte es determinista.

### 5. ¿Qué ocurre cuando el OCR confunde B con C?

Grounding y confianza pueden forzar revisión; después código compara valores. Aún falta
medir falso approve y falso review sobre un corpus CNC representativo. El demo sucio
muestra fallo visible, no perfección.

### 6. ¿Un atacante no puede editar el JSON de aprobación?

Sí, mientras no exista recibo firmado o un proceso integrado. El P0 del demo liga el hash
del archivo al reporte para cerrar cambios accidentales; firma/PKI es hardening posterior.
No confundir ambos niveles.

### 7. ¿Por qué luz en vez de un diode/guard?

Porque ofrece un último metro simple, visible y sin medios montables para artefactos
pequeños. No reemplaza toda arquitectura high-assurance ni sirve para cientos de MB.

### 8. ¿Qué se vuelve mejor con cada cliente si sus datos no pueden salir?

Policy packs, parsers, integraciones y evaluación sintética/generalizable. Casos reales
solo se incorporan con permiso/anonimización. La confianza y el canal de integradores
también acumulan sin extraer datos operativos.

### 9. ¿Quién paga?

Hipótesis: operaciones/plant manager cuando domina scrap/downtime; OT security cuando
domina el control de ingreso. Customer discovery debe elegir el buyer primario.

### 10. ¿Cuál es el evento que obliga a comprar ahora?

Hoy está abierto. Candidatos a validar: renovación de segmentación, auditoría, nueva celda,
incidente de medio removible o programa equivocado. Sin trigger no hay proceso comercial.

### 11. ¿Qué parte no puede copiar un vendor incumbente?

Puede copiar QR y eventualmente features. La defensa debe ser velocidad y profundidad de
policy packs, evidencia de calidad, integración en workflow y distribución confiable. Hoy
es tesis, no hecho consumado.

### 12. ¿Qué demuestra este demo y qué no?

Demuestra inferencia local, checks deterministas y transporte óptico íntegro de archivos
pequeños. No demuestra autenticidad de origen, ausencia de malware, adopción de clientes,
certificación ni confiabilidad industrial a escala.

## Cambios que debe provocar en el pitch de tres minutos

### Agregar explícitamente `why now`

Después de mostrar QVAC:

> This became possible now because quantized local models can read messy industrial
> documents on ordinary hardware without crossing the security boundary.

### Nombrar el moat sin apropiarse del QR

Después de la comparación competitiva:

> The QR is not the moat. Machine-specific policy packs, grounded failure cases, and
> integrator distribution compound with every deployment.

Usar `can compound` mientras no haya despliegues reales; cambiar a `compound` solamente
cuando exista evidencia.

### Mantener el cierre

> The air gap did not eliminate ingress. It made ingress invisible. Telepatía makes it
> understood: AI reads it, code decides, and light carries it across.

### No agregar al pitch hablado

- TAM sin base.
- Precio no validado.
- Cantidad de clientes/pilotos inexistentes.
- Certificación o compliance.
- Firma/autenticidad antes de implementarla.
- “Data moat” que implique extraer documentos del air gap.

## Plan de evidencia que más mejora una conversación de inversión

| Prioridad | Prueba | Métrica |
|---|---|---|
| P0 | ligar preflight al archivo emitido | 0 emisiones con hash/reporte inválido |
| P0 | golden run QVAC | tiempos por etapa + output + evidencia + commit |
| P0 | cinco transferencias físicas | 5/5 byte-identical, tiempo y reintentos |
| P0 | test command portable | `npm test` ejecuta 370, no 0 |
| P1 | 6 entrevistas de problema | frecuencia, workaround, costo, buyer y trigger |
| P1 | corpus CNC representativo | false approve, false review y cobertura de campos |
| P1 | 2 entrevistas con integradores | integración, procurement y objeciones |
| P2 | piloto design partner | errores detenidos, tiempo añadido, tasa de review |
| P2 | recibo firmado/threat model | adulteración detectada extremo a extremo |

## Conclusión

La tesis que sobrevive el schema es fuerte:

> Industrial security has focused on the boundary. Telepatía verifies meaning at the
> moment a digital artifact becomes physical action.

El demo puede ganar el hackathon sin tracción comercial si demuestra esa tesis con
honestidad. Para convertirlo en compañía, el próximo activo no es otro feature: es
evidencia de que un operador confía en la compuerta y un buyer paga por instalarla.
