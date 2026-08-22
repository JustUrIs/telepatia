# Bloque A — Tareas 1 a 10

Esta rama es tu punto de partida. Tiene **solo** lo que necesitás para arrancar
sin esperar a nadie:

- `TAREAS.md` — el plan completo. Tus tareas son **T-01 a T-10** (§4, "BLOQUE A").
- `src/shared/contract.js` — el **contrato congelado**. No lo modifiques sin
  avisar: el Bloque B codifica contra este mismo archivo.
- `fixtures/` — los datos compartidos. `verdict-sample.json` es el que consume
  **T-10** para renderizar el dictamen sin depender del Bloque B.
- `package.json` — `npm install` y listo.

## Lo primero

```bash
npm install
node --test 'test/*.test.js'   # todavía no hay tests: los escribís vos
```

## La regla que no se rompe

**Ningún archivo tuyo importa nada de `src/audit/`.** Ese es el Bloque B. Donde
los dos bloques se tocan, el cruce va **por fixture**:

| Necesitás | Leé | NO importes |
|---|---|---|
| un `Verdict` para renderizar (T-10) | `fixtures/verdict-sample.json` | `src/audit/verdict.js` |
| ver la forma de un `Transaction` (T-08) | `fixtures/statement-normalized.json` | nada del Bloque B |

Si en algún momento necesitás importar del Bloque B, pará y hablalo: significa
que el contrato está incompleto y hay que ampliarlo de común acuerdo, no
saltearlo.

## Orden sugerido

T-01 → T-02 → T-03 → T-04 son el protocolo óptico y van encadenadas (cada una
extiende `src/optical/protocol.js`). T-07 y T-08 (CSV) son independientes: si te
trabás en el protocolo, arrancá por ahí. T-05/T-06 (adaptadores QR) necesitan
`npm install` hecho. T-09/T-10 (UI) al final, porque consumen lo anterior.

## Definición de "hecho"

Está en `TAREAS.md` §6. Resumen: el test de aceptación de tu tarea pasa con el
comando exacto que dice la tarea, y `node --test 'test/*.test.js'` sigue verde.

Ojo con dos cosas que verifiqué y que te van a morder si no las sabés:

- `node --test test/` con el **directorio pelado falla** en Node 22. Usá glob
  citado: `node --test 'test/*.test.js'`.
- `--test-skip-pattern` filtra por **nombre de test, no por archivo**.
