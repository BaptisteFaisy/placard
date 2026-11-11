import { sanitizeSnippet, type FindingFamily } from '@placard/core';

/**
 * Caviardage des extraits de contexte (PLA-F-08, PLA-N-02).
 *
 * Le détecteur livre normalement un contexte déjà caviardé, mais le moteur ne
 * fait jamais confiance à l'entrée : chaque ligne est repassée par
 * `sanitizeSnippet`, qui remplace la valeur par `[REDACTED:<famille>]`.
 * L'opération est idempotente, donc sans effet sur un contexte déjà propre.
 */

/** Nombre maximal de lignes de contexte conservées dans un extrait. */
export const MAX_SNIPPET_LINES = 5;

/** Longueur maximale d'un extrait, en caractères. */
export const MAX_SNIPPET_CHARS = 400;

/**
 * Construit l'extrait d'une trouvaille : lignes de contexte caviardées,
 * débarrassées du bruit (lignes vides, indentation excessive), bornées en
 * nombre et en longueur. Retourne `undefined` si plus rien ne subsiste.
 */
export function buildSnippet(
  context: readonly string[],
  value: string,
  family: FindingFamily,
): string | undefined {
  const lines: string[] = [];
  for (const raw of context) {
    const safe = sanitizeSnippet(raw, value, family).trim();
    if (safe.length === 0) continue;
    lines.push(safe);
    if (lines.length >= MAX_SNIPPET_LINES) break;
  }
  if (lines.length === 0) return undefined;
  const joined = lines.join('\n');
  return joined.length > MAX_SNIPPET_CHARS ? `${joined.slice(0, MAX_SNIPPET_CHARS - 1)}…` : joined;
}

/**
 * Caviarde une liste de lignes sans les assembler : utilisé pour les journaux
 * de diagnostic, qui n'ont pas besoin de l'extrait formaté.
 */
export function sanitizeContext(
  context: readonly string[],
  value: string,
  family: FindingFamily,
): string[] {
  return context.map((line) => sanitizeSnippet(line, value, family));
}
