# Auditoría post-integración y plan de ejecución

**Momento:** 2026-08-23, 02:00. Los dos bloques unidos y verdes (340 tests).
**Entrega:** hoy 12:00. Quedan ~10 h.

Este documento tiene dos partes: qué encontré mirando el sistema entero, y en
qué orden atacarlo. Las tareas están ordenadas por lo que le cambia la vida al
proyecto, no por lo que es más lindo de programar.

---

## 0. Estado real, sin adornos

Lo que funciona de punta a punta, verificado:

| Capa | Estado |
|---|---|
| Transporte óptico (emisor → cámara → receptor) | ✅ probado en hardware real |
| Modo offline (PWA) | ✅ probado en celular con modo avión |
| Preview del archivo recibido | ✅ imagen, texto, ZIP, PDF, binario |
| CSV bancario → `Transaction[]` | ✅ 35 tests |
| Pipeline de auditoría completo | ✅ `bin/audit.mjs`, corrida real |
| Detección de duplicados entre corridas | ✅ arreglada hoy, con test de regresión |
| Corpus adversario | ✅ **18 ataques, 0 pasaron** |

Corte por capa defensiva, medido:

```
schema = 5    ground = 9    verdict = 4    none = 0
```

Eso es un resultado fuerte. **Y tiene un agujero que lo puede dar vuelta entero,
que es el hallazgo H1.**

---

## 1. Hallazgos

### H1 — CRÍTICO · El corpus no tiene un solo caso legítimo

`fixtures/attacks/corpus.json`: 18 casos, familias `adversarial` (10), `dirty`
(5), `coherent-fake` (3). **Cero de familia `control`.**

Un sistema que rechaza absolutamente todo saca 18/18 en este harness. La métrica
mide el poder de bloqueo y **no mide su costo**.

Y el costo es exactamente lo que le importa al comprador: cada factura legítima
que cae en `review` es una persona que tiene que abrir el documento y mirarlo. Un
equipo de cuentas por pagar que procesa 2.000 facturas al mes no puede tolerar un
20% de falsos positivos, por más que bloquee el 100% de los ataques.

Peor: un juez que sepa de esto lo va a preguntar en diez segundos, y ahora mismo
no tenemos respuesta.

> **Sin casos de control no sabemos si construimos una compuerta o un muro.**

**Acción:** agregar ≥4 casos `control` — facturas legítimas, incluyendo variantes
incómodas pero válidas (OCR con confianza media, un ítem con descuento, moneda
extranjera, una factura sin número de orden). El harness ya soporta la familia
`control`; el test `t19` la contempla. Reportar **dos** números, no uno:
tasa de bloqueo y tasa de falsos positivos.

---

### H2 — ALTO · El filtro de instrucciones es una lista, y toda lista se evade

`ground.js:35` — `INSTRUCTION_MARKERS` son 11 expresiones regulares, en español e
inglés. Un atacante que escriba en portugués, parta la frase en cuatro renglones
(la ventana es de 3), o use homoglifos, pasa el filtro sin despeinarse.

**Pero esto no es la debilidad que parece, y ahí está el punto que hay que saber
contar.** El filtro es defensa *secundaria*. La primaria es que todo valor
extraído tenga que aparecer en un bloque de OCR con su bbox. Una inyección que
evade el filtro **sigue sin poder poner un total falso**, porque ese número no
está en el documento y el grounding lo manda a `ungrounded`.

Hoy el harness no demuestra esa propiedad: los 10 casos adversarios usan frases
que el filtro sí detecta.

**Acción:** agregar un caso `inject-bypass-filter` cuyo texto **no** dispare
ningún marcador (por ejemplo en portugués, o una instrucción parafraseada sin
verbos imperativos) y que intente inflar el total. Tiene que quedar cortado por
`ground`, no por `schema`. Ese único caso convierte una lista frágil en una
demostración de defensa en profundidad.

---

### H3 — ALTO · El modelo real nunca corrió

`~/.qvac` está vacío. Todo lo demostrado usa `FakeBackend` con bloques de OCR ya
extraídos.

Consecuencias concretas:

1. **No tenemos el entregable que el track pide con nombre propio:** specs de
   hardware y latencias reales (`getSystemResources()`, T-20).
2. No sabemos si el modelo de 4B respeta de verdad la gramática de JSON Schema.
   El plan lo afirma citando la documentación del SDK; no está verificado acá.
3. `src/audit/qvac-backend.js` son 274 líneas que nunca se ejecutaron contra el
   SDK real. Los tests que lo tocan viven en `test-model/` y no corren.

**Acción:** bajar el modelo y hacer **una** corrida real de punta a punta,
aunque sea con el preset chico (`QWEN3_1_7B_INST_Q4`). No hace falta que sea la
del video: hace falta que exista, con sus números anotados. Si el modelo no baja
a tiempo, decirlo en el README en vez de dejarlo implícito.

**Riesgo:** la descarga es de varios GB. Si a las 08:00 no bajó, se abandona y se
declara.

---

### H4 — MEDIO · La costura receptor → auditoría es manual

Hoy: bajar el archivo del browser → abrir una terminal → correr `bin/audit.mjs`
→ volver al browser → cargar el `verdict.json` a mano.

Funciona, y la separación es correcta por diseño (el pipeline necesita Node). Pero
para el video son tres cortes y una explicación.

**Acción:** un `--watch` en el CLI que mire una carpeta y audite lo que aparezca.
Con la descarga del browser cayendo en esa carpeta, el flujo queda: escaneo →
guardar → el veredicto aparece solo. Un corte en vez de tres.

**Alternativa barata si el tiempo aprieta:** un `npm run demo` que corra la
auditoría sobre el último archivo de `~/Downloads`. Cinco líneas.

---

### H5 — MEDIO · No existe README ni video

Los dos son requisito explícito de la entrega. El video además es **lo único que
mira el jurado**: no van a clonar el repo.

**Acción:** README con la tesis, no con la lista de features. Guion de 3 minutos
con los tiempos marcados.

---

### H6 — BAJO · `ungrounded` mezcla dos señales distintas

Un campo que el modelo inventó sale como `{key: 'total', ...}`. Un documento con
instrucciones embebidas sale como `{key: '(documento)', value: '2 bloque(s) con
forma de instrucción'}`. Son cosas distintas: una es "el modelo alucinó", la otra
es "alguien te está atacando". La UI las pinta igual, en el mismo recuadro ámbar.

**Acción:** un campo `kind: 'hallucination' | 'injection'` en el `Ungrounded`, y
que el receptor los separe visualmente. Cambia el contrato — hay que avisarle al
otro dev.

---

### H7 — BAJO · El CLI no valida sus entradas

`bin/audit.mjs` hace `readFileSync` del CSV y del documento sin chequear. Si falta
uno, sale un stack de Node en vez de un mensaje.

**Acción:** validar y fallar con una línea legible.

---

## 2. Plan de ejecución

Ordenado por valor, con presupuesto. Las horas son del reloj real, no optimistas.

### Bloque 1 — Lo que sostiene la tesis (2 h)

| # | Tarea | Presupuesto |
|---|---|---|
| 1.1 | **H1**: 4+ casos `control` en el corpus, y el harness reportando tasa de falsos positivos además de bloqueo | 45 min |
| 1.2 | **H2**: caso `inject-bypass-filter` que evade la lista y lo frena el grounding | 20 min |
| 1.3 | Ajustar el grounding si 1.1 revela que rechaza cosas legítimas | 45 min |

**Compuerta:** si al terminar el bloque la tasa de falsos positivos es alta, eso
*es* el hallazgo, y se cuenta como tal en el video. Un número honesto vale más que
un número perfecto que nadie cree.

### Bloque 2 — Lo obligatorio (3 h)

| # | Tarea | Presupuesto |
|---|---|---|
| 2.1 | **H5**: README con la tesis, los dos números del harness, y atribución a decimen (AGPL) | 1 h |
| 2.2 | **H5**: guion del video con tiempos | 30 min |
| 2.3 | **H5**: grabar y editar | 1.5 h |

### Bloque 3 — Si sobra tiempo, en este orden (2 h)

| # | Tarea | Presupuesto |
|---|---|---|
| 3.1 | **H3**: una corrida con el modelo real y sus latencias anotadas | 1 h, abortable |
| 3.2 | **H4**: `--watch` en el CLI | 30 min |
| 3.3 | **H7**: validación de entradas del CLI | 10 min |
| 3.4 | **H6**: separar alucinación de inyección en `ungrounded` | 30 min |

### Colchón — 3 h

Se va a usar. Siempre se usa.

---

## 3. Lo que NO se hace, decidido de antemano

Para que nadie lo proponga a las 09:00:

- **Fountain codes.** Cambia el formato de cable y rehace T-02, T-03 y T-04. La
  paridad XOR ya recupera un faltante por ventana. Es pasar de "bastante bueno" a
  "óptimo" apostando el proyecto.
- **Grilla de QR.** Medido: jsQR lee un código por imagen, el costo escala lineal,
  ganancia neta cero. Ya está resuelto por densidad (V40) y escaneo reducido.
- **Auditar en el browser.** Imposible: el SDK es de Node.
- **Reescribir el Bloque B.** Está bien hecho y tiene sus tests.

---

## 4. La frase que tiene que quedar

> A un modelo no lo defendés con un prompt. Lo defendés no dejándolo concluir
> nada que no pueda señalar en los píxeles.

Todo lo demás del README y del video es evidencia de esa frase. El transporte
óptico no es el producto: es la prueba verificable de que "local, sin red" no es
una promesa de marketing — se apaga el wifi en cámara y sigue funcionando.
