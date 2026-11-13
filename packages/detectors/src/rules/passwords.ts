import type { DetectorRule } from '@placard/core';

import { PASSWORD_MIN_ENTROPY, PASSWORD_MIN_LENGTH, isPlausibleSecret } from '../validators';

/**
 * Famille `plaintext-password` : mot de passe écrit en clair.
 *
 * Validation exigée : **entropie minimale** et exclusion des valeurs factices
 * (`isDummyValue` de `@placard/core`), plus le rejet des gabarits de
 * configuration (`${VAR}`, `{{ secret }}`). Sans ces garde-fous, chaque
 * `password = "changeme"` d'un fichier d'exemple noierait le rapport.
 */

const NAME_PREFIX = '[A-Za-z0-9_-]{0,24}[_.-]';
const SECRET_WORDS = 'password|passwd|pwd|passphrase';
const ENV_WORDS = 'PASSWORD|PASSWD|PWD|SECRET|TOKEN|API_KEY|APIKEY|ACCESS_KEY|PRIVATE_KEY';
const MAX_VALUE = 128;

/** Affectation entre guillemets : `password = "..."`, `db_password: '...'`. */
const ASSIGNMENT_PATTERN = new RegExp(
  `(?<![\\w.])${NAME_PREFIX}?(?:${SECRET_WORDS})["']?\\s*[:=]\\s*["']([^"'\\s]{${PASSWORD_MIN_LENGTH},${MAX_VALUE}})["']`,
  'i',
);

/**
 * Affectation nue d'un fichier d'environnement : `API_KEY=...` (sans guillemets).
 *
 * Deux garde-fous de précision, sans quoi la règle signalerait du code ordinaire
 * (`const password = pair.slice(...)`) :
 *  - l'alphabet exclut la ponctuation de code (`(`, `)`, `,`, `;`, `{`, `}`…) ;
 *  - la valeur doit porter un symbole de mot de passe (`*`, `!`, `-`, `_`…).
 *    Un identifiant ou un appel de fonction n'en porte pas, une valeur de
 *    configuration machine si.
 */
const ENV_NAME_PREFIX = '[A-Za-z0-9_.-]{0,40}';
const ENV_VALUE_CHARS = `[^\\s'"\`(),;{}\\[\\]<>=]{${PASSWORD_MIN_LENGTH},${MAX_VALUE}}`;
const ENV_PATTERN = new RegExp(
  `(?<![\\w.-])${ENV_NAME_PREFIX}(?:${ENV_WORDS})\\s*=\\s*(${ENV_VALUE_CHARS})`,
  'i',
);

/** Symbole attendu dans une valeur machine (hors ponctuation de code). */
const MACHINE_VALUE_MARKER = /[!@#$%^&*+=?~_-]/;

/** La valeur ressemble-t-elle à une valeur de configuration, pas à du code ? */
export function looksLikeMachineValue(value: string): boolean {
  return MACHINE_VALUE_MARKER.test(value);
}

/** URL portant des identifiants : `scheme://user:pass@hôte`. */
const URL_CREDENTIALS_PATTERN =
  /(?<![\w+])([a-z][a-z0-9+.-]{1,15}:\/\/[^\s:/@]{1,64}:[^\s:/@]{1,64}@)/i;

/** Identifiants stables des règles de mot de passe. */
export const RULE_PASSWORD_ASSIGNMENT = 'plaintext-password-assignment';
export const RULE_PASSWORD_ENV = 'plaintext-password-env';
export const RULE_PASSWORD_URL = 'plaintext-password-url';

/** Extrait le mot de passe d'une URL `scheme://user:pass@hôte`. */
export function passwordFromUrl(value: string): string | undefined {
  const schemeEnd = value.indexOf('://');
  if (schemeEnd < 0) return undefined;
  const credentials = value.slice(schemeEnd + 3);
  const at = credentials.lastIndexOf('@');
  if (at < 0) return undefined;
  const pair = credentials.slice(0, at);
  const colon = pair.indexOf(':');
  if (colon < 0) return undefined;
  const password = pair.slice(colon + 1);
  return password.length > 0 ? password : undefined;
}

export const passwordRules: readonly DetectorRule[] = [
  {
    id: RULE_PASSWORD_ASSIGNMENT,
    family: 'plaintext-password',
    name: 'Plaintext password assignment',
    keywords: ['password', 'passwd', 'pwd', 'passphrase'],
    pattern: ASSIGNMENT_PATTERN,
    validate: (value) => isPlausibleSecret(value, PASSWORD_MIN_LENGTH, PASSWORD_MIN_ENTROPY),
    priority: 65,
    provider: 'generic',
  },
  {
    id: RULE_PASSWORD_ENV,
    family: 'plaintext-password',
    name: 'Plaintext credential in environment assignment',
    keywords: ['password', 'passwd', 'pwd', 'secret', 'token', 'api_key', 'apikey', 'access_key'],
    pattern: ENV_PATTERN,
    validate: (value) =>
      looksLikeMachineValue(value) &&
      isPlausibleSecret(value, PASSWORD_MIN_LENGTH, PASSWORD_MIN_ENTROPY),
    priority: 62,
    provider: 'generic',
  },
  {
    id: RULE_PASSWORD_URL,
    family: 'plaintext-password',
    name: 'Credentials embedded in a URL',
    keywords: ['://'],
    pattern: URL_CREDENTIALS_PATTERN,
    validate: (value) => {
      const password = passwordFromUrl(value);
      if (password === undefined) return false;
      return isPlausibleSecret(password, 4, PASSWORD_MIN_ENTROPY);
    },
    priority: 66,
    provider: 'generic',
  },
];
