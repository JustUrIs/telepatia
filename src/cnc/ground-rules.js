// Reglas de anclaje del dominio CNC.
//
// El motor de `ground.js` es genérico: sabe verificar que un valor corresponda
// a un token del documento con la forma correcta y bajo la etiqueta correcta.
// Qué significa "anclar el campo revision" es del dominio, y vive acá.
//
// `labels` no es decoración. Sin la etiqueta, un número suelto ancla contra
// cualquier renglón: `maxSpindleRpm: 10000` ancharía contra un número de parte
// que casualmente sea 10000.

export const CNC_FIELD_RULES = {
  // --- Identificadores -----------------------------------------------------
  workOrder: { kind: 'id', labels: /work\s*order|orden|\bwo\b|w\.o\./i },
  partNumber: { kind: 'id', labels: /part\s*(number|no|#)?|pieza|p\/n/i },
  programNumber: { kind: 'id', labels: /program|programa|\bO\s*\d/i },

  // --- La revisión, que es un solo carácter --------------------------------
  // Por eso no puede ser `text`: "C" está adentro de "Carbide", de "Machine" y
  // de media docena de palabras del documento. Tiene que aparecer suelta, en un
  // bloque que diga "Rev". La diferencia entre B y C es el lote entero.
  revision: { kind: 'letter', labels: /\brev(ision)?\b/i },

  // --- Texto libre ---------------------------------------------------------
  material: { kind: 'text', labels: /material|stock/i },
  machine: { kind: 'text', labels: /machine|m[aá]quina|control/i },

  // --- Códigos cortos ------------------------------------------------------
  workOffset: { kind: 'code', labels: /offset|work\s*coord|\bG5[4-9]\b/i },

  // Cada elemento del array comparte esta regla. Se ancla el IDENTIFICADOR,
  // no la descripcion: el OCR parte el renglon del setup sheet en varios
  // bloques por el espaciado ancho, asi que la linea entera no esta en ninguno.
  // `normalizeJob` reduce lo que devuelve el modelo a T<n> antes de anclar.
  tools: { kind: 'code', labels: /^\s*T\s*\d|tool/i },

  // --- Números con etiqueta ------------------------------------------------
  quantity: { kind: 'number', labels: /quantity|cantidad|\bqty\b|pieces/i },
  maxSpindleRpm: { kind: 'number', labels: /spindle|husillo|\brpm\b/i },
  maxFeedMmMin: { kind: 'number', labels: /feed|avance|mm\s*\/\s*min/i },
};
