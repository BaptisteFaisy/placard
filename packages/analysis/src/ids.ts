/**
 * Identifiants stables des trouvailles (`sk_0001`, `sk_0002`…).
 *
 * Déterminisme (PLA-P-05) : les identifiants sont attribués dans l'ordre
 * **trié des empreintes**, jamais dans l'ordre d'arrivée des détections. Deux
 * analyses du même jeu de détections produisent donc exactement le même
 * rapport, et un commit sans secret ajouté en cours de route (PLA-P-12) ne
 * décale aucun identifiant existant.
 */

/** Préfixe de tous les identifiants de trouvaille. */
export const FINDING_ID_PREFIX = 'sk_';

/** Largeur minimale du compteur (`sk_0001`), alignée sur le schéma Zod. */
const MIN_WIDTH = 4;

/**
 * Formate un identifiant à partir d'un rang **1-based**.
 * Au-delà de 9999, le compteur s'allonge naturellement (`sk_10000`).
 */
export function formatFindingId(position: number): string {
  const rank = Math.max(1, Math.trunc(position));
  return `${FINDING_ID_PREFIX}${String(rank).padStart(MIN_WIDTH, '0')}`;
}

/**
 * Attribue un identifiant à chaque empreinte, dans l'ordre lexicographique
 * des empreintes. Retourne la carte empreinte → identifiant.
 */
export function assignFindingIds(fingerprints: readonly string[]): ReadonlyMap<string, string> {
  const unique = [...new Set(fingerprints)].sort((a, b) => (a < b ? -1 : a > b ? 1 : 0));
  const ids = new Map<string, string>();
  unique.forEach((fingerprint, index) => {
    ids.set(fingerprint, formatFindingId(index + 1));
  });
  return ids;
}
