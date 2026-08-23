import { createHash } from 'node:crypto';

const EJES = ['X', 'Y', 'Z'];
const NUMERO = /^[+-]?(?:\d+(?:\.\d*)?|\.\d+)/;

const agregarUnaVez = (lista, vistos, valor) => {
  if (vistos.has(valor)) return;
  vistos.add(valor);
  lista.push(valor);
};

function separarComentarios(linea, numeroLinea, comments, warnings) {
  let codigo = '';

  for (let i = 0; i < linea.length;) {
    if (linea[i] === ';') {
      comments.push(linea.slice(i + 1).trim());
      break;
    }

    if (linea[i] !== '(') {
      codigo += linea[i];
      i += 1;
      continue;
    }

    const cierre = linea.indexOf(')', i + 1);
    if (cierre === -1) {
      comments.push(linea.slice(i + 1).trim());
      warnings.push(
        `Comentario entre paréntesis sin cerrar; se cerró al final de la línea ${numeroLinea}`,
      );
      break;
    }

    comments.push(linea.slice(i + 1, cierre).trim());
    // El espacio impide que quitar un comentario fusione dos números vecinos.
    codigo += ' ';
    i = cierre + 1;
  }

  return codigo;
}

function tokenizar(codigo) {
  const tokens = [];

  for (let i = 0; i < codigo.length;) {
    const letra = codigo[i].toUpperCase();
    if (letra < 'A' || letra > 'Z') {
      i += 1;
      continue;
    }

    i += 1;
    while (i < codigo.length && /\s/.test(codigo[i])) i += 1;

    const coincidencia = codigo.slice(i).match(NUMERO);
    if (!coincidencia) {
      tokens.push({ letra, texto: null, valor: null });
      continue;
    }

    const texto = coincidencia[0];
    tokens.push({ letra, texto, valor: Number(texto) });
    i += texto.length;
  }

  return tokens;
}

function envelopeVacio() {
  return {
    x: { min: null, max: null },
    y: { min: null, max: null },
    z: { min: null, max: null },
  };
}

function registrarCoordenada(envelope, letra, valor) {
  const extremo = envelope[letra.toLowerCase()];
  extremo.min = extremo.min === null ? valor : Math.min(extremo.min, valor);
  extremo.max = extremo.max === null ? valor : Math.max(extremo.max, valor);
}

/**
 * @typedef {object} GcodeProgram
 * @property {string[]} tools Herramientas llamadas, en orden de primera aparición.
 * @property {string[]} workOffsets Offsets de trabajo usados.
 * @property {string[]} mCodes Códigos M presentes.
 * @property {{x:{min:number|null,max:number|null}, y:{min:number|null,max:number|null}, z:{min:number|null,max:number|null}}} envelope
 * @property {number|null} maxFeed Avance máximo visto.
 * @property {number|null} maxSpindle RPM máximas vistas.
 * @property {string|null} programNumber Número de programa.
 * @property {string[]} comments Comentarios encontrados, en orden.
 * @property {number} lineCount Líneas no vacías, sin contar delimitadores `%`.
 * @property {string[]} warnings Anomalías léxicas y límites del análisis.
 */

/**
 * Extrae hechos verificables sin intentar simular el estado modal de la máquina.
 *
 * @param {string} texto Contenido del archivo `.nc`.
 * @returns {GcodeProgram}
 */
export function parseGcode(texto) {
  if (typeof texto !== 'string') throw new TypeError('texto debe ser un string');

  const tools = [];
  const workOffsets = [];
  const mCodes = [];
  const comments = [];
  const warnings = [];
  const envelope = envelopeVacio();
  const herramientasVistas = new Set();
  const offsetsVistos = new Set();
  const mVistos = new Set();
  const ejesConCoordenadas = new Set();
  let maxFeed = null;
  let maxSpindle = null;
  let programNumber = null;
  let lineCount = 0;
  let hayMovimiento = false;
  let usaIncremental = false;

  const lineas = texto.replace(/\r\n/g, '\n').split('\n');
  for (let indice = 0; indice < lineas.length; indice += 1) {
    const linea = lineas[indice];
    const recortada = linea.trim();
    if (recortada !== '' && recortada !== '%') lineCount += 1;

    const codigo = separarComentarios(linea, indice + 1, comments, warnings);
    for (const token of tokenizar(codigo)) {
      const { letra, texto: numeroCrudo, valor } = token;

      if (letra === 'T') {
        if (numeroCrudo === null || !Number.isInteger(valor) || valor < 0) {
          warnings.push(`T sin número de herramienta válido en la línea ${indice + 1}; se ignoró`);
        } else {
          agregarUnaVez(tools, herramientasVistas, `T${valor}`);
        }
        continue;
      }

      if (numeroCrudo === null || !Number.isFinite(valor)) continue;

      if (letra === 'G') {
        if (Number.isInteger(valor) && valor >= 54 && valor <= 59) {
          agregarUnaVez(workOffsets, offsetsVistos, `G${valor}`);
        }
        if (valor === 0 || valor === 1 || valor === 2 || valor === 3) hayMovimiento = true;
        if (valor === 91) usaIncremental = true;
        continue;
      }

      if (letra === 'M' && Number.isInteger(valor) && valor >= 0) {
        agregarUnaVez(mCodes, mVistos, `M${valor}`);
        continue;
      }

      if (letra === 'F') {
        maxFeed = maxFeed === null ? valor : Math.max(maxFeed, valor);
        continue;
      }

      if (letra === 'S') {
        maxSpindle = maxSpindle === null ? valor : Math.max(maxSpindle, valor);
        continue;
      }

      if (letra === 'O' && programNumber === null && /^\d+$/.test(numeroCrudo)) {
        programNumber = `O${numeroCrudo}`;
        continue;
      }

      if (EJES.includes(letra)) {
        registrarCoordenada(envelope, letra, valor);
        ejesConCoordenadas.add(letra);
      }
      // N es numeración de bloque y las demás direcciones no forman parte del contrato.
    }
  }

  if (usaIncremental) {
    warnings.push('G91 activa modo incremental; el envelope no es confiable');
  }
  if (!hayMovimiento) {
    for (const eje of EJES) {
      if (ejesConCoordenadas.has(eje)) {
        warnings.push(
          `El eje ${eje} tiene coordenadas, pero no aparece ningún movimiento G0/G1/G2/G3`,
        );
      }
    }
  }
  if (!mVistos.has('M30') && !mVistos.has('M99')) {
    warnings.push('Programa sin fin declarado: falta M30 o M99');
  }

  return {
    tools,
    workOffsets,
    mCodes,
    envelope,
    maxFeed,
    maxSpindle,
    programNumber,
    comments,
    lineCount,
    warnings,
  };
}

/** Extrae la revisión declarada en un comentario, o null. */
export function extractRevision(programa) {
  for (const comentario of programa?.comments ?? []) {
    const coincidencia = String(comentario).match(
      /\bREV(?:ISI[ÓO]N)?(?:\.\s*|\s*[:=#-]\s*|\s+)([A-Z0-9]+(?:[._-][A-Z0-9]+)*)\b/i,
    );
    if (coincidencia) return coincidencia[1].toUpperCase();
  }
  return null;
}

/** SHA-256 hex del texto normalizado para que el fin de línea no cambie su identidad. */
export function programHash(texto) {
  if (typeof texto !== 'string') throw new TypeError('texto debe ser un string');
  const normalizado = texto
    .replace(/\r\n/g, '\n')
    .split('\n')
    .map((linea) => linea.replace(/[ \t]+$/g, ''))
    .join('\n');
  return createHash('sha256').update(normalizado, 'utf8').digest('hex');
}
