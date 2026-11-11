import { isDummyValue, shannonEntropy } from '@placard/core';
import type { DetectorRule } from '@placard/core';

import { isInsideUrl, isPlaceholder } from '../validators.js';

/**
 * Famille `suspicious-string` : longue chaîne à forte entropie près d'un
 * mot-clé qui sent le secret (cahier C.6, dernier filet).
 *
 * Score de base bas par défaut (`scoreAdjust` négatif) : c'est une famille de
 * rappel, pas de précision. Le seuil d'entropie est réglable par le moteur
 * (`DetectorEngineOptions.entropyThreshold`, défaut 3.5).
 */

/** Seuil par défaut, en bits par caractère. */
export const DEFAULT_ENTROPY_THRESHOLD = 3.5;

/** Longueur minimale d'une chaîne candidate. */
const MIN_LENGTH = 24;

/** Longueur maximale retenue (au-delà, c'est un fichier encodé, pas une valeur). */
const MAX_LENGTH = 160;

/** Nombre minimal de caractères distincts (écarte `aaaa…`, `ababab…`). */
const MIN_DISTINCT = 12;

/** Mots-clés de contexte : la chaîne doit être *près* d'un de ces mots. */
const CONTEXT_KEYWORDS: readonly string[] = [
  'secret',
  'token',
  'key',
  'passwd',
  'password',
  'passphrase',
  'credential',
  'private',
  'auth',
  'apikey',
  'api_key',
  'access',
];

const CANDIDATE_PATTERN = /(?<![\w-])([A-Za-z0-9+/=_-]{24,160})(?![\w-])/;

/** Identifiant stable de la règle. */
export const RULE_SUSPICIOUS_STRING = 'suspicious-high-entropy';

/**
 * Une chaîne est-elle « suspecte » ? Entropie au-dessus du seuil, longueur et
 * variété suffisantes, ni gabarit ni valeur factice connue, ni chemin d'URL, ni
 * condensat d'intégrité (`sha512-…` d'un fichier de verrouillage).
 */
export function isSuspiciousString(value: string, threshold: number, line = ''): boolean {
  const trimmed = value.trim();
  if (trimmed.length < MIN_LENGTH || trimmed.length > MAX_LENGTH) return false;
  if (/^sha(?:256|384|512)-/i.test(trimmed)) return false;
  if (isPlaceholder(trimmed) || isDummyValue(trimmed)) return false;
  if (line !== '' && isInsideUrl(line, trimmed)) return false;
  const distinct = new Set(trimmed).size;
  if (distinct < MIN_DISTINCT) return false;
  const looksRandom = /[0-9]/.test(trimmed) || (trimmed.length >= 32 && distinct >= 22);
  if (!looksRandom) return false;
  return shannonEntropy(trimmed) >= threshold;
}

/** Fabrique la règle avec le seuil d'entropie choisi par le moteur. */
export function createSuspiciousRules(
  threshold: number = DEFAULT_ENTROPY_THRESHOLD,
): readonly DetectorRule[] {
  return [
    {
      id: RULE_SUSPICIOUS_STRING,
      family: 'suspicious-string',
      name: 'Long high-entropy string next to a secret keyword',
      keywords: [...CONTEXT_KEYWORDS],
      pattern: CANDIDATE_PATTERN,
      validate: (value, input) => isSuspiciousString(value, threshold, input.line),
      scoreAdjust: -5,
      priority: 10,
    },
  ];
}

/** Règle de référence, au seuil par défaut (pour les métriques et les tests). */
export const suspiciousRules: readonly DetectorRule[] = createSuspiciousRules();
