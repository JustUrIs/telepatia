// T-20 (parte) — Generador de explicación.
//
// La ÚNICA llamada al modelo en todo el camino del dictamen, y llega DESPUÉS de
// que los checks ya están resueltos. Si falla, el dictamen sigue siendo válido:
// devuelve null y el pipeline marca explanation:null. Un modelo caído no puede
// invalidar una auditoría que hizo código determinista.

const MAX_CHECKS_IN_PROMPT = 24;

/** Resume los checks a algo compacto y sin PII innecesaria para el prompt. */
export function checksDigest(checks) {
  return (Array.isArray(checks) ? checks : [])
    .slice(0, MAX_CHECKS_IN_PROMPT)
    .map((c) => ({
      id: String(c?.id ?? '?'),
      ok: c?.ok === true,
      expected: c?.expected ?? null,
      actual: c?.actual ?? null,
    }));
}

/**
 * @returns {Promise<string|null>} null si el modelo no pudo redactar.
 */
export async function explainVerdict(backend, checks, { verdict } = {}) {
  if (!backend || typeof backend.explain !== 'function') return null;
  const digest = checksDigest(checks);
  if (digest.length === 0) return null;
  try {
    const text = await backend.explain(digest, { verdict });
    if (typeof text !== 'string') return null;
    const trimmed = text.trim();
    return trimmed === '' ? null : trimmed;
  } catch {
    // Explicar es un lujo. El dictamen ya está decidido.
    return null;
  }
}
