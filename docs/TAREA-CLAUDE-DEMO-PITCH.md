# Orden de trabajo para Claude: demo y pitch de Telepatía

> Objetivo: convertir el prototipo actual en una demostración de tres minutos que sea
> visualmente inolvidable, técnicamente honesta y repetible bajo presión. Esta lista no
> autoriza una reescritura. Priorizar el camino feliz del demo, cerrar brechas que dañen
> credibilidad y conservar todo lo que ya funciona.

## Estado integrado al 2026-08-23

No rehacer estos puntos; verificar sobre el commit más nuevo y continuar con la evidencia:

- **DONE:** el preflight incluye `contexto.sourceSha256` de los bytes crudos.
- **DONE:** el sender exige reporte `approve`, valida el SHA exacto y falla cerrado ante
  archivo/reporte cambiado, review, block o JSON inválido.
- **DONE:** el receiver reconoce reportes CNC y no muestra copy de facturas en ese flujo.
- **DONE:** bundles/tests y cache offline fueron actualizados por el trabajo paralelo.
- **DONE:** el runner rápido usa un glob portable en Windows; la suite integrada contiene
  384 casos.
- **DONE:** `.nc` queda fijado a LF para que Git no invalide `sourceSha256` según el OS.
- **PENDIENTE:** cinco transferencias físicas, golden run QVAC, recursos audiovisuales,
  ensayo cronometrado y auditoría final de claims.

El reporte sigue siendo JSON sin firma. El binding exacto ya existe; autenticidad del
autor/PKI sigue siendo roadmap.

## 0. Qué tiene que poder creer el jurado al terminar

En tres minutos el jurado debe haber visto, no solamente oído, esta cadena:

1. QVAC lee localmente una orden de trabajo y un setup sheet imperfectos.
2. El modelo convierte documentos desordenados en datos estructurados y muestra la
   evidencia de dónde salió cada dato.
3. Código determinista —no el LLM— decide si el G-code coincide con el trabajo físico.
4. Rev C pasa y Rev B queda bloqueada con cinco diferencias concretas.
5. Los bytes exactos aprobados cruzan el air gap por QR dinámicos, sin USB, nube, Wi-Fi
   ni conexión de red entre equipos.
6. El receptor reconstruye el archivo y verifica su SHA-256 antes de permitir guardarlo.

La frase que ordena todo el producto es:

> AI reads it. Code decides. Light carries it across.

No presentar Telepatía como “un QR para archivos”. El producto es una compuerta de
ingreso semántica para sistemas aislados; el canal óptico es la prueba física y memorable
de esa tesis.

## 1. Leer antes de tocar código

- `README.md`
- `docs/tarea-codex-gcode.md`
- `docs/plan-qvac-ot.md`
- `docs/PITCH-FINAL.md`
- `docs/DEMO-3-MINUTOS.md`
- `src/ui/sender.html`, `src/ui/sender.js`
- `src/ui/receiver.html`, `src/ui/receiver.js`
- `bin/preflight.mjs`
- `src/cnc/gcode.js`, `src/cnc/preflight.js`
- tests de UI, CNC, encoder, decoder y sender en `test/`

Si los dos documentos de pitch todavía no están en la rama activa, están en el worktree
`C:\Users\justu\Downloads\Hackathon Aleph\telepatia-codex-pitch\docs\`.

## 2. Reglas de convivencia y seguridad del repositorio

Hay otros agentes trabajando al mismo tiempo. Antes de hacer cambios:

1. Ejecutar `git status --short --branch` y `git worktree list`.
2. Crear un worktree y una rama propios desde el commit más nuevo de la rama acordada.
3. No hacer `git reset --hard`, `git checkout --`, `git clean`, stash global ni pull
   sobre el checkout de otro agente.
4. No modificar archivos con cambios ajenos sin inspeccionar el diff y coordinar.
5. Preferir cambios pequeños y aislados. No cambiar dependencias, protocolo o estructura
   global si el demo puede resolverse con una capa fina de integración.
6. Regenerar bundles solamente después de modificar sus fuentes; nunca editar bundles a
   mano.
7. Hacer commits pequeños por tema y entregar hash, rama, archivos y pruebas ejecutadas.

## 3. Hechos actuales que no se deben ocultar

Estos son hallazgos del estado actual, no necesariamente defectos de diseño definitivo:

- El receptor conserva copy y lógica visibles del caso anterior de facturas. En un demo
  CNC aparecen términos como “factura” y `invoice_not_duplicate`. Eso es P0.
- El preflight genera un dictamen, pero hoy el emisor permite seleccionar cualquier
  archivo. Un reporte aprobado no está ligado al archivo que se emite. Eso es P0 para la
  narrativa del workflow.
- El manifiesto óptico usa SHA-256 para verificar reconstrucción íntegra. No existe hoy
  una firma digital del artefacto ni autenticación criptográfica de su origen.
- `programHash()` normaliza CRLF y espacios finales. El SHA del transporte identifica los
  bytes crudos. Son dos identidades distintas y ambas pueden ser útiles; no confundirlas.
- `--job` usa una extracción precargada. No ejecuta OCR ni tiene bloques reales para
  grounding/confianza. Es modo replay, no inferencia QVAC en vivo.
- Hay números de tiempo provenientes de ejecuciones diferentes. No mezclar carga fría,
  descarga de modelos, inferencia caliente y replay como si fueran una sola medición.
- `G91 G28 Z0` ya está tratado como un patrón realista: puede generar advertencia del
  parser, pero no debe bloquear por sí solo. No reintroducir ese falso positivo.

## 4. P0: cerrar el camino feliz sin inventar seguridad

### 4.1 Ligar aprobación y archivo emitido

Implementar el mecanismo más pequeño y testeable que garantice en la UI que el archivo
seleccionado coincide byte por byte con el evaluado. Propuesta mínima:

1. En `bin/preflight.mjs`, calcular además un `sourceSha256` sobre los bytes crudos del
   `.nc` y guardarlo en el reporte. Conservar `contexto.hash` como hash normalizado para
   identidad semántica/reproducibilidad.
2. En el emisor, permitir seleccionar el `.nc` y su reporte de preflight.
3. Validar defensivamente el esquema mínimo del reporte, `veredicto === "approve"` y
   `sourceSha256 === SHA-256(bytes seleccionados)`.
4. Mantener deshabilitado “Emitir” si falta reporte, el veredicto es `review`/`block`, el
   hash difiere o el JSON es inválido.
5. Invalidar el permiso inmediatamente al cambiar archivo, texto o reporte. No debe quedar
   aprobación vieja en memoria/UI.
6. Mostrar filename, veredicto, hash abreviado y estado “exact bytes match”.
7. La CTA del demo puede decir: **Send approved program by light**.

Importante: esta validación cierra errores y cambios accidentales dentro del workflow,
pero un JSON no firmado puede ser alterado por un atacante local. No llamarla “firma”,
“autenticación de origen” ni “garantía criptográfica de aprobación”. Si no se implementa
una cadena Ed25519 completa con manejo de claves, verificación en emisor y receptor, tests
de adulteración y documentación del threat model, eliminar esas palabras del producto y
de la presentación.

Criterios de aceptación:

- Rev C + reporte Rev C aprobado y coincidente habilita emisión.
- Rev B bloqueada no habilita emisión.
- Rev C + reporte aprobado de otro archivo no habilita emisión.
- Cambiar un solo byte después del preflight invalida el permiso.
- Cambiar de archivo limpia el recibo anterior y detiene cualquier carrusel activo.
- JSON truncado, campos con tipos incorrectos y hashes mal formados fallan de forma
  segura, sin excepción visible ni emisión.

Si cerrar esta unión obliga a una reescritura riesgosa, no simularla. Mantener CLI y canal
óptico como dos prototipos explícitamente separados y decirlo en el demo. Una limitación
honesta es mejor que un control visual que no controla nada.

### 4.2 Convertir la UI en una experiencia CNC coherente

La pantalla del receptor no puede hablar de facturas después de recibir G-code.

- Hacer el renderer domain-aware por tipo/estructura o agregar una vista CNC aislada.
- Preservar el caso de facturas y sus tests si sigue siendo parte del repositorio.
- Para `.nc`, mostrar solamente:
  - programa/filename;
  - bytes y frames recuperados;
  - paridad recuperada, si ocurrió;
  - SHA-256 verificado;
  - preview monoespaciada del G-code;
  - acción de guardar;
  - estado offline.
- La palabra correcta es **transfer integrity verified**. No mostrar “safe”,
  “authenticated” o “malware-free”.
- En emisor, mostrar un bloque compacto con:
  - `APPROVED`, `REVIEW` o `BLOCKED`;
  - trabajo, parte, revisión y programa;
  - hash coincidente/no coincidente;
  - nombre del archivo;
  - razón concreta cuando no se puede emitir.
- No hacer scroll durante el golden path. Texto legible a dos metros, contraste alto,
  estados perceptibles sin depender solo del color y botones grandes.
- Mantener estética industrial, sobria y precisa. Evitar dashboards genéricos, gradientes
  decorativos, métricas irrelevantes y animaciones que compitan con el QR.
- Preparar copy inglés para el pitch internacional; si se agrega selector ES/EN, no
  romper IDs ni selectores que usan los tests.

### 4.3 Mostrar el preflight como evidencia, no como magia del LLM

Preparar una superficie o salida legible que separe visualmente:

- **AI extraction:** valores, bounding boxes/fragmentos de origen y confianza.
- **Deterministic checks:** esperado vs. actual para cada regla.
- **Verdict:** approve, review o block.

Para Rev B deben verse las cinco discrepancias principales sin leer logs diminutos:
revisión, herramientas, offset, RPM y feed. Para Rev C debe verse un pase limpio. El
modelo propone estructura; el código tiene la última palabra. Nunca decir que el LLM
“certifica” la seguridad.

### 4.4 Probar que el canal es realmente offline

- Sender y receiver deben estar precargados y funcionar con Wi-Fi apagado.
- El receptor necesita HTTPS/certificado válido para cámara; usar el soporte actual de IP
  adicional y preparar los certificados antes del ensayo.
- Después de readiness offline, confirmar en DevTools que no hay requests de red.
- No usar un video de QR en lugar del carrusel real durante el demo principal.
- Ajustes iniciales recomendados para la puesta en escena: 300 bytes/frame y 2 fps. El
  fixture pequeño actual produce aproximadamente dos data frames, una paridad y un
  manifest; el ciclo completo es corto y visualmente comprensible.
- Cámara fija, autofocus/exposición bloqueados cuando sea posible, brillo de pantalla alto
  y notificaciones desactivadas.

## 5. P0: evidencia QVAC reproducible

Crear un único “golden run” real y conservar juntos todos sus artefactos:

- commit exacto;
- fecha/hora y equipo;
- versión de Node, SDK, OCR y LLM;
- modelos usados;
- estado de red;
- si los modelos ya estaban descargados/cargados;
- inputs exactos;
- stdout/stderr;
- JSON de extracción;
- reporte final;
- tiempo de carga, OCR, extracción y verificación por separado;
- video de pantalla sin cortes durante la inferencia.

Separar siempre:

- **cold setup/download**;
- **cold model load**;
- **warm inference**;
- **replay precargado (`--job`)**.

Usar `--job` para ensayos rápidos solo si la UI o el presentador muestran claramente
“recorded extraction replay”. En escenario: enseñar un clip corto del golden run real y
después continuar con el replay determinista si el tiempo del modelo excede el demo.

No elegir el mejor número de ejecuciones distintas. Reportar el run completo elegido y,
si se hacen varias mediciones, mediana y rango sobre el mismo hardware.

## 6. P0: auditar todos los claims

Buscar en README, comentarios, UI, pitch y demo:

```text
firmado | signature | authentic | safe | malware | compliance | compliant
air-gapped | guaranteed | zero | only | impossible | NERC
```

Corregir en particular las frases actuales que dicen que el programa se transfiere
“firmado” o que cada artefacto “se firma”. Hoy no es verdad.

Límites que el pitch debe poder admitir sin ponerse a la defensiva:

- El canal óptico puede transportar bytes maliciosos; Telepatía no es antivirus ni CDR.
- SHA-256 demuestra integridad de reconstrucción, no identidad del emisor.
- La cámara conserva firmware/driver. El claim defendible es que se elimina la inserción
  repetida de medios de almacenamiento mutables, no que desaparece toda superficie.
- NERC CIP puede motivar controles de identidad/integridad, pero el prototipo no debe
  llamarse “NERC compliant” sin evaluación y certificación.

## 7. P1: pulido de UI/UX para escenario

Hacer solamente después de P0 y tests verdes.

- Home/landing con tres verbos y una línea por paso:
  1. **Understand** — QVAC reads messy work instructions locally.
  2. **Verify** — deterministic code compares them with the CNC program.
  3. **Transfer** — approved bytes cross the air gap through light.
- Botón o modo `Demo reset` que deje sender y receiver en estado inicial sin recargar
  datos viejos.
- Modo pantalla completa; cursores y controles secundarios ocultables.
- Estados con icono + palabra + color. Nada crítico depende solo de verde/rojo.
- Errores recuperables con instrucciones precisas: cámara denegada, certificado no
  confiable, QR fuera de foco, archivo/reporte no coincidente.
- En receiver, congelar por unos segundos el momento final con nombre, SHA y
  `VERIFIED` para que el jurado lo vea.
- Agregar subtítulos ingleses al clip QVAC y captions grandes a los dos fallos Rev B.
- Si se tocan assets offline, confirmar que quedan servidos/cachados por el mecanismo
  existente. No asumir que hay service worker si el proyecto no lo tiene: probarlo.

## 8. P2: solo si sobra tiempo y sin arriesgar el demo

- Recibo de aprobación firmado con Ed25519, clave privada protegida fuera de la UI y clave
  pública fijada/verificable en receptor.
- Envelope que transporte programa + recibo firmado conservando el `.nc` original para
  la máquina.
- Política versionada y policy packs para otros artefactos OT: PLC logic, recipes,
  firmware y robot programs.
- Export de un audit trail compacto y legible.
- Métricas de una prueba física de 20 transferencias con luz/ángulo/distancias variables.

No hacer estas tareas si reducen confiabilidad, legibilidad o tiempo de ensayo.

## 9. Recursos que hay que producir o conseguir

### 9.1 Artefactos de software

- [ ] Rev C y Rev B finales en `fixtures/programs/`.
- [ ] Orden y setup sheet limpios más variantes reales: foto, gastado, rotado, bajo
      contraste y ruido severo.
- [ ] Golden-run QVAC: video, logs, JSON, reporte y metadata de hardware.
- [ ] Reportes replay de Rev C y Rev B generados por el commit de demo.
- [ ] Sender y receiver empaquetados offline y bundles regenerados.
- [ ] Certificados para las IP exactas de los dos equipos.
- [ ] Carpeta `demo/` o `runs/demo/` con un README de un solo comando por etapa.
- [ ] Copia local de todos los assets críticos; nada del demo depende de CDN.
- [ ] Checksums de los fixtures y outputs usados en escena.

### 9.2 Capturas y material visual

- [ ] Clip 1080p del QVAC real: documentos → extracción → evidencia.
- [ ] Clip/screenshot de Rev C aprobada.
- [ ] Clip/screenshot de Rev B bloqueada y sus cinco discrepancias.
- [ ] Clip de QR dinámicos en emisor y progreso del receptor.
- [ ] Frame final: `SHA-256 VERIFIED`, filename y bytes.
- [ ] Una sola gráfica competitiva, no una tabla ilegible.
- [ ] Subtítulos `.srt` o `.vtt` en inglés para clips.
- [ ] Teleprompter del pitch con marcas de tiempo y palabras de énfasis.
- [ ] Backup MP4 de la demo completa, sin usarlo salvo contingencia.

### 9.3 Equipo físico: confirmar con el equipo humano

Claude no puede adquirir esto físicamente; debe dejar checklist, responsable y estado.

- [ ] Laptop emisor con QVAC/modelos/fixtures ya disponibles offline.
- [ ] Laptop receptor con cámara funcional y certificado confiado.
- [ ] Trípode o soporte fijo para la cámara.
- [ ] Cargadores, adaptadores y alargue.
- [ ] Mouse/clicker y teclado de respaldo.
- [ ] Micrófono probado; grabación local de respaldo.
- [ ] Brillo, resolución y scaling anotados.
- [ ] Wi-Fi/Bluetooth apagables frente al jurado.
- [ ] USB rojo como prop narrativo, sin conectarlo a ningún equipo del demo.
- [ ] Copia del repo/fixtures/video en almacenamiento de contingencia.

## 10. Pruebas obligatorias

Ejecutar al inicio y al final:

```powershell
npm test
npm run test:model
node scripts/bundle-ui.mjs
npm test
```

Agregar cobertura específica para:

- approved + mismo `sourceSha256` habilita emisión;
- block/review nunca habilitan emisión;
- reporte aprobado + archivo distinto bloquea;
- cambiar archivo invalida aprobación y carrusel;
- JSON adulterado o malformado falla cerrado;
- cálculo browser/node de SHA-256 coincide en archivos vacíos, pequeños y binarios;
- receiver `.nc` no ejecuta ni muestra lógica de factura;
- renderer previo de facturas sigue funcionando, si aún se soporta;
- labels ES/EN no rompen selectores;
- encoder/decoder conserva identidad byte a byte y filename;
- pérdida recuperable por paridad;
- cámara denegada y cámara inexistente muestran recuperación clara.

Smoke tests del preflight:

```powershell
node bin/preflight.mjs fixtures/programs/part-1837-revC.nc --job fixtures/shop/job-extracted.json --out runs/demo/revC-replay.json
node bin/preflight.mjs fixtures/programs/part-1837-revB.nc --job fixtures/shop/job-extracted.json --out runs/demo/revB-replay.json
```

El segundo comando debe terminar con exit code 2; eso es éxito del bloqueo, no fallo del
test manual.

Prueba física antes de cerrar:

- Hacer al menos cinco pases completos consecutivos.
- En cada pase: reset → cargar aprobación → emitir → recibir → SHA verificado → guardar →
  comparar bytes.
- Registrar tiempo total y cualquier rescan/reintento.
- Repetir una vez con Wi-Fi realmente apagado y DevTools abierto.
- El demo no está listo si solamente funcionó una vez.

## 11. Plan exacto de la demo de tres minutos

Usar `docs/DEMO-3-MINUTOS.md` como guion maestro. El orden no es negociable:

| Tiempo | Qué se ve | Qué se demuestra |
|---|---|---|
| 0:00–0:20 | consecuencia de un archivo equivocado + USB/air gap | problema económico y de seguridad |
| 0:20–0:50 | clip QVAC leyendo documentos reales | AI local necesaria, no decorativa |
| 0:50–1:15 | Rev C: checks verdes | código decide, evidencia auditable |
| 1:15–1:40 | Rev B: cinco diferencias y bloqueo | el producto evita una acción física errónea |
| 1:40–2:25 | dos equipos offline + QR dinámicos | momento “ciencia ficción” real |
| 2:25–2:40 | SHA verificado y archivo reconstruido | integridad observable |
| 2:40–3:00 | diferencial, moat y cierre | por qué esto puede ser empresa |

Ensayar con cronómetro. Objetivo de operación: terminar el camino principal en 2:40 y
reservar 20 segundos para el cierre. Cada click debe figurar en una runbook impresa.

Contingencias:

- QVAC lento: clip real autenticado + replay explícito.
- Cámara falla: cambiar a cámara/receiver de respaldo una sola vez; luego video backup.
- QR tarda: bajar a preset 300 bytes/frame y 2 fps, no improvisar parámetros.
- Certificado: tener URL/IP exacta y procedimiento de trust impreso.
- Pitch interrumpido: la frase de recuperación es “AI reads it. Code decides. Light
  carries it across.” y saltar al siguiente hito visual.

## 12. Pitch: diferencial, competencia y moat

Sincronizar cualquier edición con `docs/PITCH-FINAL.md`. El pitch debe empezar por la AI
porque esa es la relación con el track; el QR es el segundo acto y el momento mágico.

### 12.1 Diferencial que sí se puede defender

> Existing products secure the pipe. Telepatía proves the payload matches the physical
> job before it crosses.

Comparación verbal exacta:

- **USB security kiosks / scanning stations:** inspeccionan malware, dispositivos y
  políticas, pero conservan medios removibles y normalmente no entienden si el archivo
  corresponde a la orden física concreta.
- **Data diodes:** dominan telemetría de salida y transferencia controlada entre redes.
  Existen productos de ingreso controlado —no decir que “ninguno puede meter datos”—,
  pero suelen proteger el canal y la arquitectura de red, no hacer preflight semántico
  por artefacto en hardware commodity.
- **Telepatía:** QVAC entiende documentación imperfecta localmente, reglas deterministas
  deciden, y un canal óptico visible mueve los bytes aprobados sin insertar almacenamiento
  mutable.

La brecha existe porque “mover bytes entre zonas” y “entender si esos bytes representan
el trabajo correcto” históricamente pertenecen a vendors, presupuestos y equipos
distintos. Telepatía une ambos controles en el punto de acción.

### 12.2 Qué es producto hoy y qué es roadmap

| Hoy, demostrable | Roadmap, no fingir que existe |
|---|---|
| QVAC local para OCR/extracción estructurada | policy packs para más controladores/industrias |
| grounding/confianza cuando hay bloques OCR reales | recibos firmados y gestión empresarial de claves |
| checks CNC deterministas | integraciones MES/PLM y flujos de aprobación |
| QR dinámico con fragmentación/paridad/SHA | certificaciones y despliegues validados |
| sender/receiver sobre hardware commodity | flota, observabilidad y administración central opcional |

### 12.3 Moat: no es el QR

No decir que QR dinámico es el moat: puede copiarse. El moat acumulativo propuesto es:

1. **Policy packs de dominio:** reglas de preflight, parsers, normalización y casos borde
   por máquina, controlador y proceso.
2. **Corpus de evidencia y fallos:** documentos sucios, ground truth, falsos positivos,
   drift y near-misses que mejoran evaluación y despliegue.
3. **Workflow y auditabilidad:** integración con el punto donde el técnico decide cargar
   un programa, historial grounded y, a futuro, recibos firmados.
4. **Distribución y confianza industrial:** integradores, OEMs, change management,
   validación y certificación; la instalación aceptada se vuelve difícil de reemplazar.
5. **Arquitectura abierta y hardware agnostic:** el protocolo puede ser abierto. El valor
   defendible vive en políticas, evidencia, integración y confianza, no en encerrar el
   formato del QR.

Presentarlo como hipótesis de moat en construcción, no como ventaja ya consolidada.

### 12.4 Wedge y expansión

- Wedge: talleres CNC y plantas donde un archivo equivocado produce scrap, downtime o un
  incidente, y donde USB sigue siendo el puente operativo.
- Expansión: PLC logic, robot programs, recipes, firmware y maintenance packages.
- Modelo comercial para validar: licencia por sitio/celda + policy packs + integración y
  soporte. No inventar precio ni pipeline si no hay evidencia.

### 12.5 Respuestas que el pitch debe dejar preparadas

- ¿Por qué QVAC y no OCR/cloud genérico?
- ¿Qué decisión exacta hace AI y cuál hace código?
- ¿Qué impide un falso positivo del modelo?
- ¿Por qué no basta un data diode o un USB scanner?
- ¿Quién paga y cuánto cuesta una hora/lote perdido?
- ¿Por qué ahora?
- ¿Cuál es el wedge y cómo expande?
- ¿Qué parte es difícil de copiar?
- ¿Cómo se autentica el origen si hoy solo hay SHA?
- ¿Qué ataque queda fuera del threat model?
- ¿Qué fue real en la demo y qué fue replay?

## 13. Números e historias: usar con fuente visible

Usar pocos números y poner la fuente en notas/slide, no recitar una bibliografía.

- Siemens reportó para automoción un costo de downtime cercano a **USD 2.3 millones por
  hora**. Fuente primaria:
  <https://assets.new.siemens.com/siemens/assets/api/uuid%3A1b43afb5-2d07-47f7-9eb7-893fe7d0bc59/TCOD-2024_original.pdf>
- Honeywell informó que **82%** de las amenazas bloqueadas desde USB por su muestra 2024
  podían causar disrupción de operaciones OT. Fuente primaria:
  <https://hcenews.honeywell.com/rs/093-RAU-212/images/Honeywell_Gard_USB_Threat_Report_2024.pdf>
- Stuxnet es el antecedente narrativo del air gap con una puerta humana/removible. Evitar
  detalles sensacionalistas no documentados. Análisis técnico primario de Symantec:
  <https://community.broadcom.com/symantecenterprise/communities/community-home/librarydocuments/viewdocument?CommunityKey=1ecf5f55-9545-44d6-b0f4-4e4a7f5f5e68&DocumentKey=1a29f93b-41f8-4265-a7d1-44c3c94d3b52&tab=librarydocuments>
- QVAC SDK oficial: <https://qvac.tether.io/dev/sdk/>
- NERC CIP-010-4 oficial:
  <https://www.nerc.com/standards/reliability-standards/cip/cip-010-4>
- Contraejemplos que obligan a matizar la competencia:
  - Nexor GuarDiode: <https://www.nexor.com/guardiode>
  - Waterfall WF FLIP:
    <https://waterfall-security.com/wp-content/uploads/2023/11/WF-Flip-Brochure-digital.pdf>

No redondear un caso particular como tamaño total de mercado. No atribuir a una fuente
algo que no dice. Si cambia una cifra, actualizar también pitch, demo y notas.

## 14. Definition of Done y entrega de Claude

Claude debe entregar un único reporte final con:

- rama y commits;
- diff por archivo y razón;
- bugs encontrados, distinguiendo corregidos, diferidos y fuera de alcance;
- tests automáticos con resultado;
- tabla de cinco ensayos físicos;
- paths de todos los videos, screenshots, JSON, logs y subtítulos;
- claims eliminados/corregidos;
- lista de recursos físicos todavía pendientes con dueño;
- runbook de escenario de una página;
- rollback o instrucciones para cherry-pick sin pisar trabajo concurrente.

La entrega se acepta únicamente si:

- el demo completo entra consistentemente en tres minutos;
- Rev C pasa y Rev B bloquea con evidencia legible;
- el emisor no permite un archivo que no coincida con su aprobación;
- no aparece lenguaje de facturas en el flujo CNC;
- la transferencia funciona offline y el receptor verifica los bytes;
- todos los claims importantes distinguen lo construido del roadmap;
- diferencial y moat aparecen en el cierre;
- tests y cinco ensayos físicos están documentados.
