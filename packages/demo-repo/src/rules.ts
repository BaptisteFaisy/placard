import type { FindingFamily } from '@placard/core';

import type { Dialect } from './templates';

/**
 * Identifiants de règles attendus par l'oracle.
 *
 * Ces chaînes reprennent **exactement** les identifiants publiés par
 * `@placard/detectors` (`RULE_IDS`), pour que l'oracle du dépôt hanté et le
 * rapport de l'analyse parlent la même langue. Elles sont recopiées ici — et non
 * importées — parce que `@placard/detectors` n'est pas une dépendance de ce
 * paquet ; la mutualisation se fera quand les deux paquets seront dans le même
 * graphe de dépendances.
 *
 * Règle PLA-N-09 : aucun de ces identifiants n'est une valeur au format d'un
 * secret, et les fragments de préfixe sont volontairement courts, jamais un
 * préfixe complet.
 */

/** Identifiants de règles, par famille. */
export const RULE_IDS = {
  cloudAccessKey: 'cloud-access-key-id',
  cloudApiKey: 'cloud-api-key',
  githubPat: 'platform-github-pat',
  githubFinePat: 'platform-github-fine-grained-pat',
  slackToken: 'platform-slack-token',
  npmToken: 'platform-npm-token',
  stripeLiveKey: 'platform-stripe-live-key',
  assistantProjectKey: 'platform-assistant-project-key',
  privateKeyBlock: 'private-key-block',
  signedToken: 'signed-token-jwt',
  passwordAssignment: 'plaintext-password-assignment',
  passwordEnv: 'plaintext-password-env',
  bankIban: 'bank-iban',
  bankCard: 'bank-card-number',
  identityNir: 'identity-nir',
  identityEmail: 'identity-email',
  riskyDotenv: 'risky-file-dotenv',
  suspiciousString: 'suspicious-high-entropy',
} as const;

/** Identifiant de règle attendu pour une valeur plantée. */
export type ExpectedRule = (typeof RULE_IDS)[keyof typeof RULE_IDS];

/** Recolle des fragments de préfixe (jamais un préfixe complet en clair). */
function sig(...parts: readonly string[]): string {
  return parts.join('');
}

/** Fragments de préfixe de jetons, par règle attendue. */
const TOKEN_PREFIXES: readonly { prefix: string; rule: ExpectedRule }[] = [
  { prefix: sig('gh', 'p'), rule: RULE_IDS.githubPat },
  { prefix: sig('git', 'hub_'), rule: RULE_IDS.githubFinePat },
  { prefix: sig('xo', 'xb'), rule: RULE_IDS.slackToken },
  { prefix: sig('np', 'm_'), rule: RULE_IDS.npmToken },
  { prefix: sig('sk', '_live'), rule: RULE_IDS.stripeLiveKey },
  { prefix: sig('sk', '-proj'), rule: RULE_IDS.assistantProjectKey },
];

/** Fragment de préfixe de la clé d'API cartographique. */
const MAP_KEY_PREFIX = sig('AI', 'za');

function tokenRule(value: string): ExpectedRule {
  for (const entry of TOKEN_PREFIXES) {
    if (value.startsWith(entry.prefix)) return entry.rule;
  }
  return RULE_IDS.npmToken;
}

/**
 * Règle censée détecter une valeur plantée.
 *
 * Le choix dépend de la **forme réelle** de la valeur (fabricée par
 * `fakeValue`) et du **dialecte** du fichier hôte : un mot de passe écrit dans
 * un fichier `.env` relève de la règle « environnement », le même mot de passe
 * écrit dans une constante relève de la règle « affectation ».
 */
export function expectedRuleFor(
  family: FindingFamily,
  value: string,
  dialect: Dialect,
): string {
  switch (family) {
    case 'cloud-key':
      return value.startsWith(MAP_KEY_PREFIX) ? RULE_IDS.cloudApiKey : RULE_IDS.cloudAccessKey;
    case 'platform-token':
      return tokenRule(value);
    case 'private-key':
      return RULE_IDS.privateKeyBlock;
    case 'signed-token':
      return RULE_IDS.signedToken;
    case 'plaintext-password':
      return dialect === 'env' ? RULE_IDS.passwordEnv : RULE_IDS.passwordAssignment;
    case 'bank-data':
      return value.startsWith('FR') ? RULE_IDS.bankIban : RULE_IDS.bankCard;
    case 'identity':
      return value.includes('@') ? RULE_IDS.identityEmail : RULE_IDS.identityNir;
    case 'risky-file':
      return RULE_IDS.riskyDotenv;
    case 'suspicious-string':
      return RULE_IDS.suspiciousString;
    default:
      return RULE_IDS.suspiciousString;
  }
}
