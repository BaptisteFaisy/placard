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
  /^\[REDACTED:[a-z-]+\](?:\(\d+\))?$/i,
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
 * (`isDummyValue` de `@placard/core`), ni gabarit, ni mot anglais composé en
 * kebab-case (`key-bearer`) sans chiffre ni majuscule.
 */
export function isPlausibleSecret(
  value: string,
  minLength: number,
  minEntropy: number,
): boolean {
  const trimmed = value.trim();
  if (trimmed.length < minLength) return false;
  if (isPlaceholder(trimmed) || isDummyValue(trimmed)) return false;
  if (/^[a-z]+(?:-[a-z]+)+$/.test(trimmed) && trimmed.length < 18) return false;
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

/**
 * La valeur se trouve-t-elle dans la partie « autorité » d'une URL ?
 *
 * `https://x-access-token:$T@github.com/...` : le `@` y sépare des identifiants
 * d'un hôte, ce n'est **pas** une adresse e-mail. Une seule implémentation,
 * partagée par les familles `identity` (e-mail) et `suspicious-string` (chemin
 * d'URL de documentation) — les deux se faisaient piéger par le même cas.
 */
export function isInsideUrl(line: string, value: string): boolean {
  if (line === '' || value === '') return false;
  const index = line.indexOf(value);
  if (index < 0) return false;
  const before = line.slice(Math.max(0, index - 200), index);
  return /[a-z][a-z0-9+.-]*:\/\/[^\s'"`]*$/i.test(before);
}
