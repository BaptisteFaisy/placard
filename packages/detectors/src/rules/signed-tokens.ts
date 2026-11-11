import type { DetectorRule } from '@placard/core';

/**
 * Famille `signed-token` : jetons signés à trois segments base64url.
 *
 * Validation exigée : **le premier segment se décode en JSON valide**. C'est ce
 * qui écarte les versions sémantiques (`1.2.3`), les noms de domaine et les
 * horodatages à points. Le contenu décodé n'est **jamais exécuté** : on appelle
 * `JSON.parse` sur du texte, jamais `eval` ni `Function` (PLA-N-03).
 */

/** Longueur maximale d'un segment accepté (borne anti-déni de service). */
const SEGMENT_MAX = 512;

/** Taille maximale du JSON décodé avant refus (un en-tête fait < 200 octets). */
const DECODED_MAX = 4096;

const SEGMENT = `[A-Za-z0-9_-]{4,${SEGMENT_MAX}}`;
const JWT_PATTERN = new RegExp(`(?<![\\w-])${SEGMENT}(?:\\.${SEGMENT}){2}(?![\\w-])`);

/** Identifiant stable de la règle. */
export const RULE_SIGNED_TOKEN = 'signed-token-jwt';

/** Le segment se décode-t-il en objet JSON ? (jamais d'exécution du contenu) */
export function decodesToJsonObject(segment: string): boolean {
  try {
    const text = Buffer.from(segment, 'base64url').toString('utf8');
    if (text.length === 0 || text.length > DECODED_MAX) return false;
    const parsed: unknown = JSON.parse(text);
    return typeof parsed === 'object' && parsed !== null;
  } catch {
    return false;
  }
}

export const signedTokenRules: readonly DetectorRule[] = [
  {
    id: RULE_SIGNED_TOKEN,
    family: 'signed-token',
    name: 'Signed token (JWT)',
    // L'en-tête d'un JWT est du JSON encodé : il commence toujours par `eyJ`
    // (ou `eyI` pour un objet dont la première clé est une chaîne vide).
    keywords: ['eyj', 'eyi'],
    pattern: JWT_PATTERN,
    validate: (value) => {
      const first = value.split('.')[0];
      if (first === undefined || first.length === 0) return false;
      return decodesToJsonObject(first);
    },
    priority: 70,
    provider: 'generic',
  },
];
