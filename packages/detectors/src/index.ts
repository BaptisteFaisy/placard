import { createDetectorEngine } from './engine';

/**
 * `@placard/detectors` — règles de détection, préfiltre et validations.
 *
 * Point d'entrée public : `createDetectorEngine` construit un moteur conforme au
 * contrat `DetectorEngine` de `@placard/core`. Les types du contrat sont
 * ré-exportés ici pour que les autres lots n'aient qu'un import à écrire.
 *
 * Garanties du paquet :
 *  - aucune valeur détectée ne sort du moteur autrement que dans
 *    `RawDetection.value`, à destination de l'empreinte HMAC (PLA-N-02) ;
 *  - aucune exception sur un contenu hostile (PLA-P-10) ;
 *  - aucune valeur au format réel d'un secret n'est écrite dans ces fichiers
 *    (PLA-N-09) : les valeurs de test sont fabriquées par `@placard/core`.
 */

export type {
  DetectorEngine,
  DetectorEngineOptions,
  DetectorInput,
  DetectorResult,
  DetectorRule,
  FindingFamily,
  RawDetection,
} from '@placard/core';

export { createDetectorEngine } from './engine';

export { RULE_IDS, builtinRuleSet, builtinRules, priorityOf, sortByPriority } from './registry';
export type { RegistryOptions, RuleSet } from './registry';

export { scanFile } from './block-scan';
export type { FileScanOptions, FileScanResult } from './block-scan';

export { compilePattern, isSafePatternSource, loadCustomRules, parseCustomRules } from './custom-rules';

export { compileKeywords, makePrefilter, prefilterMatches } from './prefilter';
export type { Prefilter } from './prefilter';

export { compareDetections, overlaps, resolveOverlaps } from './overlap';
export type { Priorities } from './overlap';

export {
  PASSWORD_MIN_ENTROPY,
  PASSWORD_MIN_LENGTH,
  distinctChars,
  entropyAtLeast,
  isPlaceholder,
  isPlausibleSecret,
  matchesAlphabet,
  matchesAlphabetRange,
} from './validators';

export {
  MAX_PRIVATE_KEY_BLOCK_CHARS,
  MAX_PRIVATE_KEY_BLOCK_LINES,
  findPrivateKeyBlock,
  matchPrivateKeyFooter,
  matchPrivateKeyHeader,
  privateKeyBlockComplete,
} from './rules/private-keys';

export { EMAIL_DUMP_THRESHOLD, riskyFileLevelRules, riskyFilePathRules } from './rules/risky-files';

export { countEmails, isExampleDomain, isFrenchPhone, isFrenchSsn, isPersonalEmail } from './rules/identity';

export { isCardNumber } from './rules/banking';

export { DEFAULT_ENTROPY_THRESHOLD, isSuspiciousString } from './rules/suspicious';

export { looksLikeMachineValue, passwordFromUrl } from './rules/passwords';

export { decodesToJsonObject } from './rules/signed-tokens';

/** Fonction de construction du moteur, également exportée par commodité. */
export const detectors = { createDetectorEngine } as const;
