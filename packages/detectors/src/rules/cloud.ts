import type { DetectorRule } from '@placard/core';

import { CLOUD_KEY_PREFIXES, MAP_API_KEY_PREFIX } from '../signatures';
import { matchesAlphabet } from '../validators';

/**
 * Famille `cloud-key` : identifiants de clé à préfixe fixe.
 *
 * Validation exigée par le cahier : **longueur et alphabet exacts**. Un préfixe
 * reconnu suivi du bon nombre de caractères du bon alphabet, rien de moins —
 * c'est ce qui distingue une vraie clé d'une variable nommée `aws_key`.
 */

/** Identifiants d'accès : 4 caractères de préfixe + 16 majuscules/chiffres. */
const ACCESS_KEY_BODY_LENGTH = 16;

/** Clé d'API cartographique : 4 caractères de préfixe + 35 caractères URL-safe. */
const MAP_KEY_BODY_LENGTH = 35;

const UPPER_ALNUM = /^[A-Z0-9]+$/;
const URL_SAFE = /^[A-Za-z0-9_-]+$/;

const ACCESS_KEY_PATTERN = new RegExp(
  `(?<![\\w-])(?:${CLOUD_KEY_PREFIXES.join('|')})[A-Z0-9]{${ACCESS_KEY_BODY_LENGTH}}(?![\\w-])`,
);
const MAP_KEY_PATTERN = new RegExp(
  `(?<![\\w-])${MAP_API_KEY_PREFIX}[A-Za-z0-9_-]{${MAP_KEY_BODY_LENGTH}}(?![\\w-])`,
);

/** Identifiants stables, repris tels quels dans le rapport. */
export const RULE_CLOUD_ACCESS_KEY = 'cloud-access-key-id';
export const RULE_CLOUD_MAP_KEY = 'cloud-api-key';

export const cloudRules: readonly DetectorRule[] = [
  {
    id: RULE_CLOUD_ACCESS_KEY,
    family: 'cloud-key',
    name: 'Cloud provider access key ID',
    keywords: [...CLOUD_KEY_PREFIXES],
    pattern: ACCESS_KEY_PATTERN,
    validate: (value) =>
      matchesAlphabet(value.slice(CLOUD_KEY_PREFIXES[0]?.length ?? 4), UPPER_ALNUM, ACCESS_KEY_BODY_LENGTH),
    priority: 90,
    provider: 'aws',
  },
  {
    id: RULE_CLOUD_MAP_KEY,
    family: 'cloud-key',
    name: 'Google API key',
    keywords: [MAP_API_KEY_PREFIX],
    pattern: MAP_KEY_PATTERN,
    validate: (value) =>
      matchesAlphabet(value.slice(MAP_API_KEY_PREFIX.length), URL_SAFE, MAP_KEY_BODY_LENGTH),
    priority: 88,
    provider: 'google',
  },
];
