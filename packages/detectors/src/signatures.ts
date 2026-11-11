/**
 * Fragments de préfixes publics des fournisseurs, assemblés **à l'exécution**.
 *
 * Règle PLA-N-09 : aucune suite de caractères du dépôt ne doit correspondre au
 * format complet d'un secret, même factice. Les préfixes sont donc découpés en
 * fragments puis recollés par `sig()` : le fichier source ne contient jamais le
 * préfixe d'un seul tenant, et le scan automatique du dépôt (qui utilise ces
 * mêmes règles) ne peut pas se signaler lui-même.
 */

/** Recolle des fragments de préfixe (seul point d'assemblage du paquet). */
export function sig(...parts: readonly string[]): string {
  return parts.join('');
}

/** Identifiants de clé d'accès des services en nuage à préfixe fixe. */
export const CLOUD_KEY_PREFIXES: readonly string[] = [
  sig('AK', 'IA'),
  sig('AS', 'IA'),
  sig('AG', 'PA'),
  sig('AI', 'DA'),
  sig('AR', 'OA'),
  sig('AN', 'PA'),
  sig('AN', 'VA'),
  sig('AI', 'PA'),
];

/** Préfixe des clés d'API de la plateforme cartographique (39 caractères au total). */
export const MAP_API_KEY_PREFIX = sig('AI', 'za');

/** Jetons de plateformes, préfixés et de longueur fixe. */
export const GITHUB_PAT_PREFIX = sig('gh', 'p_');
export const GITHUB_FINE_PAT_PREFIX = sig('github_', 'pat_');
export const SLACK_TOKEN_PREFIX = sig('xo', 'x');
export const NPM_TOKEN_PREFIX = sig('np', 'm_');
export const STRIPE_LIVE_PREFIX = sig('sk_', 'live_');
export const ASSISTANT_PROJECT_PREFIX = sig('sk-', 'proj_');

/** Marqueurs d'un bloc de clé privée PEM (en-tête et pied). */
export const PEM_OPEN = sig('-----', 'BEGIN');
export const PEM_CLOSE = sig('-----', 'END');
export const PEM_KEY_WORDS = sig('PRIVATE', ' KEY');
export const PEM_DASHES = sig('-----');
