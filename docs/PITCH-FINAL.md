# telepatía — pitch final

## La tesis

> The air gap did not eliminate ingress. It made ingress invisible.
> Telepatía makes every artifact understood before it crosses.

No venderlo como «transferencia por QR». Eso es el momento mágico del demo,
pero no es la compañía. El producto es una **compuerta semántica de ingreso para
máquinas aisladas**:

1. IA local lee el papeleo no estructurado.
2. Código determinista verifica el programa y decide.
3. Luz transporta el artefacto aprobado sin montar almacenamiento removible.

El secreto contrariano para un jurado tipo Peter Thiel es que el air gap no
eliminó la entrada: tercerizó la entrada a un humano con un USB. Para un jurado
tipo Jony Ive, la experiencia completa se reduce a una acción comprensible:
**antes de mover acero, verde o rojo; si es verde, apuntar una cámara.**

## Guion hablado en inglés

Este texto tiene aproximadamente 330 palabras. A 120–125 palabras por minuto,
con las pausas visuales del QR, ocupa tres minutos. No acelerarlo: el silencio de
dos o tres segundos mientras aparece el resultado forma parte del pitch.

> AI should never control a half-million-dollar machine. It should stop the
> wrong file before Cycle Start.
>
> Today, a CNC operator manually reconciles work orders and setup sheets against
> G-code. One character — Revision B instead of C — can scrap 24 parts or crash
> a spindle.
>
> The air-gap paradox: disconnecting the network never removed the need to put
> work in. It outsourced ingress to a human carrying a USB — the path Stuxnet
> exploited.
>
> The stakes are physical. Automotive downtime can cost 2.3 million dollars per
> hour. Honeywell found 82 percent of blocked USB threats could disrupt OT.
>
> Telepatía is an AI preflight gate, followed by an optical input channel.
>
> QVAC OCR and local Qwen3 4B read this worn paperwork, extracting revision,
> machine, tools, offset, and limits. Each value points to evidence; low
> confidence stops approval.
>
> This became possible now because quantized local models can read messy
> industrial documents on ordinary hardware without crossing the security
> boundary.
>
> But the model never decides. Deterministic code parses G-code and compares both
> sets. AI reads ambiguity; code owns the safety verdict.
>
> Here is Revision C: ready. Now Revision B: blocked — wrong revision, missing
> T7, wrong work offset, overspeed, and excessive feed. Five mistakes caught
> before steel moves.
>
> Now the magic. Wi-Fi is off. The approved file becomes dynamic QR frames. A
> fixed camera rebuilds it with parity and verifies SHA-256. No network. No USB.
> Just light.
>
> Data diodes move telemetry out; guards and kiosks control files in. We ask:
> does this payload match the physical job? The QR is not the moat.
> Machine-specific policies, grounded failure cases, and integrator distribution
> can compound with every deployment.
>
> A plant's work orders map what it makes and where it is vulnerable. Cloud
> inference defeats the boundary.
>
> We start with CNC shops through industrial integrators, then expand to PLC
> configurations, security patches, energy, water, and defense.
>
> The air gap did not eliminate ingress. It made ingress invisible. Telepatía
> makes it understood: AI reads it, code decides, and light carries it across.

## Las respuestas que el pitch tiene que sobrevivir

### ¿Qué hace la IA que no puede hacer código normal?

Lee fotos, escaneos y fotocopias gastadas de órdenes de trabajo y setup sheets,
y los convierte en un registro estructurado. Eso es trabajo real y hoy lo hace
un operario. El G-code, en cambio, sí tiene gramática: por eso lo parsea código.
Usar un LLM para ambas cosas sería menos seguro, no más inteligente.

### ¿Por qué QVAC y por qué local?

Porque el papeleo y el inventario de una planta describen qué produce, qué
máquinas posee y cuáles son sus límites. Son un mapa operativo y de
vulnerabilidades. `OCR_LATIN` y `QWEN3_4B_INST_Q4_K_M` corren mediante
`@qvac/sdk` en la laptop del técnico, sin API keys ni nube. El prototipo midió
4,1 s para la extracción estructurada después del OCR.

### ¿Qué ocurre cuando el modelo se equivoca?

No tiene acceso al veredicto. El esquema ni siquiera contiene un campo
`approved`. Cada valor debe anclarse a evidencia OCR; un dato crítico sin
evidencia o con baja confianza fuerza revisión. En ruido severo el benchmark
recuperó 3/6 campos con confianza 0,33: no fingimos éxito, falla de manera
visible.

### ¿Cuál es el moat si cualquiera puede generar QR?

El QR no es el moat. El foso se construye con los paquetes de reglas por dominio,
los casos de evaluación grounded, la integración al proceso de change management
y la distribución mediante integradores OT. El protocolo puede ser abierto; la
confianza mejora cuando es auditable. Hoy existe el primer policy pack CNC y un
harness adversarial: el corpus, las integraciones y el canal comercial todavía son
una hipótesis de moat que hay que ganar. Como los documentos son sensibles, no
prometer un data flywheel central: casos reales solo se incorporan con permiso o
anonimización.

### ¿Por qué ahora y no hace cinco años?

Porque modelos locales cuantizados ya pueden convertir documentos industriales
imperfectos en estructura utilizable sobre hardware común, sin cruzar el límite de
seguridad. La novedad no es el QR aislado: es poder verificar significado en el
edge antes de transferir el artefacto, a un costo y tamaño de modelo compatibles
con la laptop del técnico.

### ¿Qué tracción existe?

Existe evidencia de ejecución, no tracción comercial: prototipo CNC end-to-end,
canal óptico, harness adversarial y 384 tests no-modelo en la suite integrada del
demo. Todavía no hay clientes, pilotos ni ingresos documentados. El próximo hito
es un design partner que permita medir falso approve, tasa de review, tiempo
agregado y errores evitados.

### ¿Quién compra?

El usuario es el ingeniero CNC/OT; el comprador es el responsable de planta,
ciberseguridad o compliance; el canal es el integrador industrial que ya instala
controles, segmentación y monitoreo. La hipótesis comercial es licencia anual por
sitio más paquetes de políticas por dominio. No presentar precio como validado:
todavía es una hipótesis.

### ¿No hacen esto los data diodes?

Algunos sí permiten ingreso. Nexor GuarDiode importa y sanitiza; Waterfall WF
FLIP invierte físicamente la orientación durante mantenimiento. Honeywell SMX
protege flujos con USB. La diferencia defendible no es «nadie mete datos»:
Telepatía agrega aprobación semántica artefacto por artefacto sobre hardware
común. Complementa diodos y CDR; no pretende reemplazarlos.

### ¿El canal óptico impide que entre malware?

No. Puede transportar bytes maliciosos igual que cualquier canal. Elimina el
medio removible que se conecta en cada trabajo y restringe el flujo a píxeles en
una sola dirección, pero la sanitización de contenido requiere AV/CDR y la
autenticidad requiere firma. El valor actual es pre-flight semántico + transporte
óptico íntegro, no «antivirus mágico».

### ¿SHA-256 autentica al proveedor?

No. El prototipo verifica que el archivo reconstruido sea idéntico al emitido.
No prueba quién lo emitió. Firma de manifiestos/artefactos y PKI son el siguiente
paso de hardening. No afirmar en cámara que el prototipo «firma» archivos ni que
ya satisface por completo NERC CIP-010 R1.6.

### ¿Una cámara no tiene firmware y drivers?

Sí. La diferencia es una cámara fija, aprobada y acotada a un flujo de píxeles,
en lugar de insertar para cada trabajo almacenamiento removible, mutable y
montable. La superficie no se vuelve cero; se reduce y se vuelve estable.

### ¿Qué tamaño puede mover?

Kilobytes por segundo. Es ideal para G-code, configuraciones, manifiestos,
scripts y claves. No es la vía correcta para firmware de 200 MB. Esta limitación
define la cuña y evita vender ciencia ficción falsa.

### ¿Por qué hablar de Stuxnet?

Como lección, no como dato forense inventado: un sistema aislado sigue
necesitando ingreso. Symantec documentó la propagación de Stuxnet por unidades
removibles y su rastro a contratistas iraníes; no existe prueba forense pública
de qué pendrive específico cruzó a Natanz. La frase segura es: **«Natanz mostró
que aislar la red no elimina el problema del ingreso»**.

### ¿Por qué encaja con el track?

QVAC hace el trabajo indispensable que el operario hoy realiza sobre entradas
sucias: OCR y extracción estructurada local. Hay modelos, cuantización, hardware
y latencias medidos. El modelo no está decorando el QR y tampoco invade el
veredicto de seguridad. El producto demuestra privacidad, resiliencia offline y
fallo cerrado en hardware de consumo.

## Lo que no se dice en cámara

- «Nadie puede meter datos a un air gap».
- «El QR garantiza que el archivo es seguro».
- «SHA-256 prueba quién envió el archivo».
- «Ya cumplimos NERC CIP-010».
- «Stuxnet entró a Natanz por este pendrive concreto».
- «La cámara no tiene drivers ni firmware».
- «La IA detecta colisiones o simula mecanizado».

## Fuentes para las dos cifras habladas

- [Siemens, *The True Cost of Downtime 2024*](https://assets.new.siemens.com/siemens/assets/api/uuid%3A1b43afb5-2d07-47f7-9eb7-893fe7d0bc59/TCOD-2024_original.pdf): USD 2,3 millones por hora de downtime automotriz.
- [Honeywell, *2024 USB Threat Report*](https://hcenews.honeywell.com/rs/093-RAU-212/images/Honeywell_Gard_USB_Threat_Report_2024.pdf): 82% de las amenazas bloqueadas eran capaces de disrupción OT.
- [QVAC SDK](https://qvac.tether.io/dev/sdk/): inferencia local y funcionamiento offline una vez descargados los modelos.
- [NERC CIP-010-4](https://www.nerc.com/standards/reliability-standards/cip/cip-010-4): identidad de la fuente e integridad del software son requisitos distintos.
- [Nexor GuarDiode](https://www.nexor.com/guardiode) y [Waterfall WF FLIP](https://waterfall-security.com/wp-content/uploads/2023/11/WF-Flip-Brochure-digital.pdf): evidencia de que sí existen soluciones de ingreso.
- [Broadcom/Symantec, *W32.Stuxnet Dossier*](https://community.broadcom.com/symantecenterprise/communities/community-home/librarydocuments/viewdocument?CommunityKey=1ecf5f55-9545-44d6-b0f4-4e4a7f5f5e68&DocumentKey=1a29f93b-41f8-4265-a7d1-44c3c94d3b52&tab=librarydocuments): propagación por medios removibles y objetivo de sabotaje industrial.
