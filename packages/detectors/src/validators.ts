import { isDummyValue, shannonEntropy } from '@placard/core';

/**
 * Validations partagées par les règles de détection.
 *
 * Aucune de ces fonctions ne lève : elles répondent `false` sur une entrée
 * hostile (octets nuls, chaîne vide, index hors bornes), conformément à
 * PLA-P-10. Aucune valeur reçue ici n'est journalisée (PLA-N-02).
 */

/** Longueur minimale d'un mot de passe réellement secret. */
export const PASSWORD_MIN_LENGTH = 8;

/** Entropie minimale (bits par caractère) d'un mot de passe en clair. */
export const PASSWORD_MIN_ENTROPY = 2.5;

/**
 * Motifs de gabarit : une valeur d'exemple laissée dans un modèle
 * (`${VAR}`, `{{ secret }}`, `<%= key %>`, `...`) n'est pas un secret.
 */
const PLACEHOLDER_PATTERNS: readonly RegExp[] = [
  /\$\{/,
  /\{\{/,
  /<%/,
  /\.\.\./,
  /^<[^<>]*>$/,
  /\bchangeme\b/i,
];

/** La valeur est-elle un gabarit de configuration plutôt qu'un secret ? */
export function isPlaceholder(value: string): boolean {
  const trimmed = value.trim();
  if (trimmed.length === 0) return true;
  return PLACEHOLDER_PATTERNS.some((pattern) => pattern.test(trimmed));
}

/** L'entropie de Shannon de la valeur atteint-elle le seuil ? */
export function entropyAtLeast(value: string, minBitsPerChar: number): boolean {
  return shannonEntropy(value.trim()) >= minBitsPerChar;
}

/** Nombre de caractères distincts (sert à écarter `0000000000`, `aaaaaa`). */
export function distinctChars(value: string): number {
  return new Set(value).size;
}

/**
 * Une valeur est-elle un secret plausible ? Longueur, entropie, ni factice
 * (`isDummyValue` de `@placard/core`), ni gabarit.
 */
export function isPlausibleSecret(
  value: string,
  minLength: number,
  minEntropy: number,
): boolean {
  const trimmed = value.trim();
  if (trimmed.length < minLength) return false;
  if (isPlaceholder(trimmed) || isDummyValue(trimmed)) return false;
  return shannonEntropy(trimmed) >= minEntropy;
}

/** Le corps de valeur respecte-t-il exactement longueur et alphabet attendus ? */
export function matchesAlphabet(body: string, alphabet: RegExp, length: number): boolean {
  return body.length === length && alphabet.test(body);
}

/** Le corps de valeur respecte-t-il une longueur comprise dans un intervalle ? */
export function matchesAlphabetRange(
  body: string,
  alphabet: RegExp,
  min: number,
  max: number,
): boolean {
  return body.length >= min && body.length <= max && alphabet.test(body);
}
