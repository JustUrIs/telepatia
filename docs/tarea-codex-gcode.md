# Tarea para Codex — Parser de G-code determinista

Pegale esto a Codex tal cual. Es una tarea completamente aislada: **un archivo
de código y uno de test**, sin tocar nada más del repo. No hay conflicto posible
con lo que estoy haciendo en paralelo.

---

## Contexto de una línea

Estamos construyendo una compuerta que revisa un programa de CNC **antes** de
mandarlo a una máquina aislada. El LLM lee los documentos no estructurados (orden
de trabajo, setup sheet, plano). **El G-code lo parsea código determinista, nunca
el modelo** — extraer `T7` de un `.nc` es un tokenizador, y meter una alucinación
en el camino crítico para ahorrarse 40 líneas sería un error de diseño.

Tu tarea es ese tokenizador.

---

## Qué construir

**Crear exactamente dos archivos:**

- `src/cnc/gcode.js`
- `test/cnc-gcode.test.js`

**No modificar ningún otro archivo del repo.**

### Restricciones del proyecto (no negociables)

- JavaScript ESM puro (`import`/`export`), sin TypeScript, sin paso de build.
- Node ≥ 22. Solo stdlib. **Cero dependencias nuevas.**
- Tests con `node:test` y `node:assert/strict`. Tienen que correr en menos de 5 s.
- Comentarios en castellano, explicando **por qué**, no qué. Nada de
  `// incrementa i`.
- Nada de `TODO`, nada de placeholders. Todo lo que se escribe, funciona.

---

## La API exacta

```js
/**
 * @typedef {object} GcodeProgram
 * @property {string[]} tools          Herramientas llamadas, en orden de primera aparición: ['T1','T7']
 * @property {string[]} workOffsets    Offsets de trabajo usados: ['G54','G55']
 * @property {string[]} mCodes         Códigos M presentes: ['M3','M8','M30']
 * @property {{x:{min:number,max:number}, y:..., z:...}} envelope  Extremos alcanzados por eje
 * @property {number|null} maxFeed     Avance máximo visto (F), null si no hay ninguno
 * @property {number|null} maxSpindle  RPM máximas vistas (S), null si no hay ninguna
 * @property {string|null} programNumber  Número de programa (O1234), null si no hay
 * @property {string[]} comments       Comentarios encontrados, en orden
 * @property {number} lineCount        Líneas no vacías
 * @property {string[]} warnings       Anomalías léxicas (ver abajo)
 */

/**
 * @param {string} texto Contenido del archivo .nc
 * @returns {GcodeProgram}
 */
export function parseGcode(texto)
```

Y dos ayudantes:

```js
/** Extrae la revisión declarada en un comentario, o null. */
export function extractRevision(programa)   // recibe el GcodeProgram

/** SHA-256 hex del texto normalizado (CRLF->LF, sin espacios al final de línea). */
export function programHash(texto)
```

---

## Reglas del dialecto, y por qué importan

El G-code real es sucio. Estas reglas salen de programas de verdad:

1. **Comentarios en dos formas**: entre paréntesis `(ESTO ES UN COMENTARIO)` y
   con punto y coma `; hasta el fin de línea`. Los paréntesis pueden anidar en
   algunos controles — no hace falta soportar anidación, pero **un paréntesis sin
   cerrar no puede colgar el parser**: se cierra al fin de línea y se agrega un
   warning.

2. **Todo lo que está dentro de un comentario NO cuenta.** Un `T7` escrito
   adentro de `(cambiar a T7 manualmente)` **no es una llamada a herramienta**.
   Esto es lo más importante del parser: si contás herramientas de adentro de los
   comentarios, el check de cobertura de herramientas da falsos positivos todo el
   tiempo.

3. **Números de bloque `N10`, `N20`** se descartan: son numeración de línea, no
   datos.

4. **Mayúsculas y minúsculas**: `t7`, `T7`, `g54` y `G54` son lo mismo.
   Normalizá a mayúscula.

5. **Espacios opcionales**: `G0X10Y20`, `G0 X10 Y20` y `G 0 X 10` son válidos.
   No asumas separación por espacios.

6. **Números**: enteros, decimales, con signo, y con punto inicial (`X.5` es
   `0.5`). `X-12.700` es válido.

7. **`T` sin número** (`T` sola) es basura: warning, no herramienta.

8. **El envelope se calcula solo de coordenadas explícitas.** No hay que
   interpretar el modo incremental (G91) ni resolver el estado modal: si el
   programa usa G91, se agrega un warning diciendo que el envelope no es
   confiable, porque interpretarlo bien exige simular y eso ya es otro producto.

9. **Un archivo vacío o solo comentarios** devuelve una estructura válida con
   arrays vacíos, no lanza.

---

## Los warnings que hay que emitir

Strings legibles, en castellano. Al menos estos casos:

- paréntesis de comentario sin cerrar
- `T` sin número
- uso de `G91` (modo incremental → envelope no confiable)
- un eje con coordenadas pero sin ningún movimiento (`X` sin `G0`/`G1`/`G2`/`G3`)
- ausencia de `M30` o `M99` al final (programa sin fin declarado)

---

## Los tests que quiero ver

Además de los casos obvios, **estos tres son los que importan**:

```js
test('un T7 dentro de un comentario NO es una llamada a herramienta', ...)
test('G0X10Y20 sin espacios parsea igual que G0 X10 Y20', ...)
test('un parentesis sin cerrar no cuelga el parser y deja warning', ...)
```

Escribí también un test con un programa realista de ~40 líneas que incluya
cambio de herramienta, refrigerante, dos offsets de trabajo y fin de programa.

**Definición de hecho:**

```bash
node --test test/cnc-gcode.test.js     # verde, < 5 s
node --test 'test/*.test.js'           # el resto del repo sigue verde
```

---

## Ejemplo de entrada, para que no haya dudas

```gcode
%
O1837 (PART 1837 REV C)
N10 G17 G21 G90 G54
N20 T1 M6 (12MM END MILL)
N30 S8000 M3
N40 G0 X-12.7 Y0. Z25.
N50 G1 Z-2.5 F250.
N60 X50.8 F1200.
; cambio de herramienta
N70 T7 M6
N80 G55
N90 M30
%
```

Salida esperada:

```js
{
  tools: ['T1', 'T7'],
  workOffsets: ['G54', 'G55'],
  mCodes: ['M6', 'M3', 'M30'],
  envelope: { x: {min:-12.7, max:50.8}, y: {min:0, max:0}, z: {min:-2.5, max:25} },
  maxFeed: 1200,
  maxSpindle: 8000,
  programNumber: 'O1837',
  comments: ['PART 1837 REV C', '12MM END MILL', 'cambio de herramienta'],
  lineCount: 11,
  warnings: []
}
```

Y `extractRevision` sobre eso devuelve `'C'`.
