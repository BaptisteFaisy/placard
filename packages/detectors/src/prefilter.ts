/**
 * Préfiltre par mots-clés (cahier C.6, premier étage de la chaîne).
 *
 * Une règle n'est **essayée** que si l'un de ses mots-clés apparaît dans la
 * ligne : c'est ce qui borne le coût d'un scan sur un historique entier, où
 * l'immense majorité des lignes ne contient aucun secret.
 *
 * Deux natures de règles coexistent :
 *  - les règles **ancrées** (`keywords` non vide) : le préfixe ou le mot-clé
 *    est son propre filtre (`ghp_`, `-----BEGIN`, `password`) ;
 *  - les règles **structurelles** (`keywords` vide) : la forme de la valeur est
 *    son propre filtre (IBAN, numéro de carte, NIR). Leur motif borné est bon
 *    marché et elles sont peu nombreuses, elles sont donc toujours essayées —
 *    sans quoi un IBAN isolé, sans mot-clé de contexte, passerait inaperçu.
 */

/** Préfixe du type de fonction : mots-clés déjà normalisés en minuscules. */
export type Prefilter = (haystack: string) => boolean;

/** Normalise un mot-clé pour la comparaison insensible à la casse. */
export function normalizeKeyword(keyword: string): string {
  return keyword.toLowerCase();
}

/** Prépare la liste de mots-clés d'une règle (minuscules, sans doublon vide). */
export function compileKeywords(keywords: readonly string[]): readonly string[] {
  const out: string[] = [];
  for (const keyword of keywords) {
    const lowered = normalizeKeyword(keyword);
    if (lowered.length > 0 && !out.includes(lowered)) out.push(lowered);
  }
  return out;
}

/**
 * La ligne contient-elle l'un des mots-clés ? `haystack` est la ligne **déjà**
 * passée en minuscules une seule fois par le moteur, pour éviter N mises en
 * minuscules par ligne. Une liste vide signifie « règle structurelle ».
 */
export function prefilterMatches(keywords: readonly string[], haystack: string): boolean {
  if (keywords.length === 0) return true;
  for (const keyword of keywords) {
    if (haystack.includes(keyword)) return true;
  }
  return false;
}

/** Construit un prédicat de préfiltre réutilisable pour une règle. */
export function makePrefilter(keywords: readonly string[]): Prefilter {
  const compiled = compileKeywords(keywords);
  return (haystack: string) => prefilterMatches(compiled, haystack);
}
