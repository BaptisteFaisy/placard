import { fakeEmail, fakeFrenchSsn, fakeIban, fakeCardNumber, fakeValue, prng } from '@placard/core';
import type { DetectorInput, FindingFamily } from '@placard/core';

/**
 * Fabrique de lignes de test.
 *
 * Règle PLA-N-09 : **aucune valeur au format réel d'un secret n'est écrite dans
 * le dépôt**. Ces fonctions assemblent les lignes de test à l'exécution à partir
 * de `fakeValue` et des générateurs de `@placard/core` ; le guillemet lui-même
 * est construit par `String.fromCharCode`, pour qu'aucun fichier du dépôt ne
 * contienne une affectation de secret en dur.
 */

/** Guillemet double, construit à l'exécution. */
export const QUOTE = String.fromCharCode(34);

/** Construit une entrée de détection pour une ligne. */
export function inputOf(line: string, overrides: Partial<DetectorInput> = {}): DetectorInput {
  return {
    line,
    path: 'src/config/settings.ts',
    commit: 'c0ffee00c0ffee00c0ffee00c0ffee00c0ffee00',
    lineNumber: 1,
    side: 'added',
    ...overrides,
  };
}

/** Construit une entrée dont le chemin est celui d'un fichier de test. */
export function inputInPath(path: string, line: string): DetectorInput {
  return inputOf(line, { path });
}

/** Valeur factice d'une famille, à graine fixe. */
export function fixture(family: FindingFamily, seed = 'placard-detectors', index = 0): string {
  return fakeValue(family, seed, index);
}

/** IBAN valide, à graine fixe. */
export function fixtureIban(seed = 'iban-seed'): string {
  return fakeIban(prng(seed));
}

/** Numéro de carte valide (Luhn), à graine fixe. */
export function fixtureCard(seed = 'card-seed'): string {
  return fakeCardNumber(prng(seed));
}

/** NIR valide, à graine fixe. */
export function fixtureSsn(seed = 'ssn-seed'): string {
  return fakeFrenchSsn(prng(seed));
}

/** Adresse électronique hors domaine d'exemple, à graine fixe. */
export function fixtureEmail(seed = 'email-seed'): string {
  return fakeEmail(prng(seed));
}

/** Ligne d'affectation générique : `nom = "valeur"`. */
export function assignmentLine(name: string, value: string): string {
  return `${name} = ${QUOTE}${value}${QUOTE};`;
}

/** Ligne d'affectation de mot de passe. */
export function passwordLine(value: string): string {
  return assignmentLine('password', value);
}

/** Ligne d'affectation de clé d'API (contexte « secret » pour les chaînes suspectes). */
export function apiKeyLine(value: string): string {
  return assignmentLine('api_key', value);
}

/** Ligne d'un fichier d'environnement, sans guillemets. */
export function envLine(name: string, value: string): string {
  return `${name}=${value}`;
}

/** URL portant des identifiants, assemblée à l'exécution. */
export function urlWithCredentials(user: string, password: string, host = 'db.internal'): string {
  const separator = ':' + '/' + '/';
  // Le mot de passe d'une URL ne peut pas contenir les séparateurs de la forme :
  // on retire ceux que le générateur a pu produire, pour tester la règle et non
  // la tolérance de l'analyseur d'URL.
  const safe = password.replace(/[/:@]/g, 'x');
  return `postgres${separator}${user}:${safe}@${host}/app`;
}

/** Lignes d'un bloc de clé privée, fabriquées à l'exécution. */
export function privateKeyLines(seed = 'key-seed'): string[] {
  return fakeValue('private-key', seed).split('\n');
}

/** Chemin d'un fichier à risque, fabriqué à l'exécution. */
export function riskyFilePath(seed = 'risky-seed'): string {
  return `config/${fakeValue('risky-file', seed)}`;
}

/** Lignes contenant `count` adresses électroniques distinctes. */
export function emailLines(count: number, seed = 'dump-seed'): string[] {
  const lines: string[] = [];
  for (let index = 0; index < count; index += 1) {
    lines.push(`contact ${index}: ${fakeEmail(prng(`${seed}:${index}`))}`);
  }
  return lines;
}
