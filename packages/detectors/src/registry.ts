import type { DetectorRule } from '@placard/core';

import { bankingRules } from './rules/banking.js';
import { cloudRules } from './rules/cloud.js';
import { identityRules } from './rules/identity.js';
import { passwordRules } from './rules/passwords.js';
import { privateKeyRules } from './rules/private-keys.js';
import { riskyFileLevelRules, riskyFilePathRules } from './rules/risky-files.js';
import { signedTokenRules } from './rules/signed-tokens.js';
import { DEFAULT_ENTROPY_THRESHOLD, createSuspiciousRules } from './rules/suspicious.js';
import { tokenRules } from './rules/tokens.js';

/**
 * Registre : assemblage et **ordre d'application** des règles.
 *
 * Les règles sont essayées par priorité décroissante. L'ordre n'est pas
 * cosmétique : une clé de service en nuage doit être reconnue avant la règle
 * « chaîne suspecte » qui la verrait aussi, pour que la trouvaille porte le bon
 * nom de famille dans le rapport.
 */

/** Identifiants de règle exposés aux autres lots (rapport, démo, rituel). */
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
  privateKeyHeader: 'private-key-header',
  signedToken: 'signed-token-jwt',
  passwordAssignment: 'plaintext-password-assignment',
  passwordEnv: 'plaintext-password-env',
  passwordUrl: 'plaintext-password-url',
  bankIban: 'bank-iban',
  bankCard: 'bank-card-number',
  identityNir: 'identity-nir',
  identityEmail: 'identity-email',
  identityPhone: 'identity-phone',
  riskyDotenv: 'risky-file-dotenv',
  riskyPrivateKeyFile: 'risky-file-private-key',
  riskyCredentials: 'risky-file-credentials',
  riskyDbExport: 'risky-file-db-export',
  riskyBackup: 'risky-file-backup',
  riskyToolCredentials: 'risky-file-tool-credentials',
  riskyEmailDump: 'risky-file-email-dump',
  suspiciousString: 'suspicious-high-entropy',
} as const;

/** Les trois natures de règles du paquet. */
export interface RuleSet {
  /** Règles évaluées sur chaque ligne de diff. */
  lineRules: readonly DetectorRule[];
  /** Règles évaluées sur le chemin seul (`scanPath`). */
  pathRules: readonly DetectorRule[];
  /** Règles évaluées sur le fichier entier (`scanFile`). */
  fileLevelRules: readonly DetectorRule[];
}

/** Priorité d'une règle (0 si elle n'en déclare pas). */
export function priorityOf(rule: DetectorRule): number {
  return rule.priority ?? 0;
}

/** Trie par priorité décroissante, sans casser l'ordre de déclaration à égalité. */
export function sortByPriority(rules: readonly DetectorRule[]): DetectorRule[] {
  return rules
    .map((rule, index) => ({ rule, index }))
    .sort((a, b) => priorityOf(b.rule) - priorityOf(a.rule) || a.index - b.index)
    .map((entry) => entry.rule);
}

/** Options de composition du registre. */
export interface RegistryOptions {
  /** Seuil d'entropie des chaînes suspectes (défaut 3.5). */
  entropyThreshold?: number;
}

/** Assemble le jeu de règles livré avec le paquet. */
export function builtinRuleSet(options: RegistryOptions = {}): RuleSet {
  const threshold = options.entropyThreshold ?? DEFAULT_ENTROPY_THRESHOLD;
  const lineRules: readonly DetectorRule[] = [
    ...cloudRules,
    ...tokenRules,
    ...privateKeyRules,
    ...signedTokenRules,
    ...passwordRules,
    ...bankingRules,
    ...identityRules,
    ...createSuspiciousRules(threshold),
  ];
  return {
    lineRules: sortByPriority(lineRules),
    pathRules: sortByPriority(riskyFilePathRules),
    fileLevelRules: sortByPriority(riskyFileLevelRules),
  };
}

/** Règles de ligne livrées avec le paquet, dans l'ordre d'application. */
export function builtinRules(options: RegistryOptions = {}): readonly DetectorRule[] {
  return builtinRuleSet(options).lineRules;
}
