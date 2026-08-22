// Parser de CSV tolerante a entrada sucia.
//
// Propio y con stdlib sola: un extracto bancario real trae BOM, CRLF mezclado
// con LF, comillas escapadas y una última línea sin salto, y meter una
// dependencia para eso cuesta más de lo que resuelve.
//
// Este módulo **no interpreta semántica**: todo sale como string. Fechas,
// montos y monedas son problema de `normalize.js`.

const BOM = '﻿';
const DELIMITERS = [',', ';', '\t'];
const SNIFF_LINES = 5;

/**
 * Adivina el separador por frecuencia en las primeras líneas.
 *
 * Cuenta en crudo, sin respetar comillas: un separador dentro de un campo
 * entrecomillado suma, pero el separador real aparece una vez por columna en
 * cada línea y gana por diferencia amplia.
 *
 * @param {string} text
 * @returns {','|';'|'\t'} Coma si no hay ningún candidato.
 */
export function sniffDelimiter(text) {
  if (typeof text !== 'string') throw new TypeError('texto debe ser string');

  const lineas = text.replace(BOM, '').split(/\r?\n/).slice(0, SNIFF_LINES);
  let mejor = ',';
  let maximo = 0;

  for (const delimitador of DELIMITERS) {
    let cuenta = 0;
    for (const linea of lineas) {
      for (const char of linea) if (char === delimitador) cuenta++;
    }
    if (cuenta > maximo) {
      maximo = cuenta;
      mejor = delimitador;
    }
  }
  return mejor;
}

/**
 * Convierte un CSV en filas de celdas.
 *
 * Reglas que implementa, todas vistas en extractos reales:
 * - BOM inicial descartado;
 * - CRLF, LF y la mezcla de ambos, incluso dentro de un campo entrecomillado;
 * - comillas escapadas duplicando (`""` → `"`);
 * - separador dentro de comillas, que no parte el campo;
 * - líneas completamente vacías salteadas (una fila de campos vacíos, `,,`, no
 *   lo está y se conserva);
 * - última línea sin salto final.
 *
 * @param {string} text
 * @param {{delimiter?: string}} [options] Sin `delimiter` se olfatea.
 * @returns {string[][]}
 */
export function parseCsv(text, options = {}) {
  if (typeof text !== 'string') throw new TypeError('texto debe ser string');

  const { delimiter = sniffDelimiter(text) } = options ?? {};
  if (typeof delimiter !== 'string' || delimiter.length !== 1) {
    throw new TypeError(`delimitador inválido: ${JSON.stringify(delimiter)}`);
  }
  if (delimiter === '"' || delimiter === '\r' || delimiter === '\n') {
    throw new TypeError(`delimitador inválido: ${JSON.stringify(delimiter)}`);
  }

  const src = text.startsWith(BOM) ? text.slice(1) : text;

  /** @type {string[][]} */ const rows = [];
  /** @type {string[]} */ let row = [];
  let campo = '';
  let entreComillas = false;
  let campoEntrecomillado = false;
  let postComillas = false;

  /** Cierra el campo actual. Solo se recorta lo que no vino entre comillas. */
  const cerrarCampo = () => {
    row.push(campoEntrecomillado ? campo : campo.trim());
    campo = '';
    campoEntrecomillado = false;
    postComillas = false;
  };

  /** Cierra la fila. Una línea sin ningún contenido no es una fila. */
  const cerrarFila = () => {
    cerrarCampo();
    const vacia = row.length === 1 && row[0] === '';
    if (!vacia) rows.push(row);
    row = [];
  };

  for (let i = 0; i < src.length; i++) {
    const char = src[i];

    if (entreComillas) {
      if (char === '"') {
        if (src[i + 1] === '"') {
          campo += '"';
          i++;
        } else {
          entreComillas = false;
          postComillas = true;
        }
      } else if (char === '\r' && src[i + 1] === '\n') {
        // CRLF dentro de un campo: se guarda normalizado a LF.
        campo += '\n';
        i++;
      } else {
        campo += char;
      }
      continue;
    }

    // Ya cerró la comilla: hasta el próximo separador o salto solo puede venir
    // relleno (` "b,c" ,d`). Se descarta en vez de pegarse al campo.
    if (postComillas && char !== delimiter && char !== '\n' && char !== '\r') {
      continue;
    }

    if (char === '"') {
      entreComillas = true;
      campoEntrecomillado = true;
      // Lo que hubiera antes de la comilla es relleno: ` "b,c" ` es `b,c`.
      campo = '';
      continue;
    }
    if (char === delimiter) {
      cerrarCampo();
      continue;
    }
    if (char === '\n') {
      cerrarFila();
      continue;
    }
    if (char === '\r') {
      if (src[i + 1] === '\n') i++;
      cerrarFila();
      continue;
    }
    campo += char;
  }

  // Última línea sin salto final.
  if (campo !== '' || campoEntrecomillado || row.length > 0) cerrarFila();

  return rows;
}
