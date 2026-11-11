import { severityOf } from './severity.js';
import type { FindingFamily, FindingState, SeverityLevel } from './types.js';

/**
 * Vocabulaire partagé de l'interface. Toutes les chaînes visibles sont en
 * anglais (règle du concours) ; le français est disponible comme seconde
 * langue d'interface. Aucune valeur détectée n'apparaît ici.
 */

export type Locale = 'en' | 'fr';

/** Type de squelette du manoir : le costume code la famille (table C.4). */
export type SkeletonKind = 'key-bearer' | 'paper-bearer' | 'chest' | 'loose-bones';

export const FAMILY_TO_SKELETON: Record<FindingFamily, SkeletonKind> = {
  'cloud-key': 'key-bearer',
  'platform-token': 'key-bearer',
  'private-key': 'key-bearer',
  'signed-token': 'key-bearer',
  'plaintext-password': 'key-bearer',
  'bank-data': 'paper-bearer',
  identity: 'paper-bearer',
  'risky-file': 'chest',
  'suspicious-string': 'loose-bones',
};

export const FAMILIES: readonly FindingFamily[] = [
  'cloud-key',
  'platform-token',
  'private-key',
  'signed-token',
  'plaintext-password',
  'bank-data',
  'identity',
  'risky-file',
  'suspicious-string',
];

export const STATES: readonly FindingState[] = ['open', 'rotated', 'purged', 'sealed', 'ignored'];

const FAMILY_LABELS: Record<Locale, Record<FindingFamily, string>> = {
  en: {
    'cloud-key': 'Cloud provider key',
    'platform-token': 'Platform token',
    'private-key': 'Private key',
    'signed-token': 'Signed token (JWT)',
    'plaintext-password': 'Plaintext password',
    'bank-data': 'Banking data',
    identity: 'Personal identity data',
    'risky-file': 'Risky file',
    'suspicious-string': 'Suspicious string',
  },
  fr: {
    'cloud-key': 'Clé de service en nuage',
    'platform-token': 'Jeton de plateforme',
    'private-key': 'Clé privée',
    'signed-token': 'Jeton signé (JWT)',
    'plaintext-password': 'Mot de passe en clair',
    'bank-data': 'Donnée bancaire',
    identity: 'Donnée personnelle',
    'risky-file': 'Fichier à risque',
    'suspicious-string': 'Chaîne suspecte',
  },
};

const SEVERITY_LABELS: Record<Locale, Record<SeverityLevel, string>> = {
  en: { critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low' },
  fr: { critical: 'Critique', high: 'Élevée', medium: 'Moyenne', low: 'Basse' },
};

const STATE_LABELS: Record<Locale, Record<FindingState, string>> = {
  en: {
    open: 'Open',
    rotated: 'Rotated',
    purged: 'Purged',
    sealed: 'Sealed',
    ignored: 'Dismissed',
  },
  fr: {
    open: 'Ouverte',
    rotated: 'Tournée',
    purged: 'Purgée',
    sealed: 'Scellée',
    ignored: 'Écartée',
  },
};

const SKELETON_LABELS: Record<Locale, Record<SkeletonKind, string>> = {
  en: {
    'key-bearer': 'Skeleton holding a key',
    'paper-bearer': 'Skeleton carrying papers',
    chest: 'Locked chest',
    'loose-bones': 'Loose bones',
  },
  fr: {
    'key-bearer': 'Squelette tenant une clé',
    'paper-bearer': 'Squelette portant des papiers',
    chest: 'Malle cadenassée',
    'loose-bones': 'Os épars',
  },
};

export function familyLabel(family: FindingFamily, locale: Locale = 'en'): string {
  return FAMILY_LABELS[locale][family];
}

export function severityLabel(level: SeverityLevel, locale: Locale = 'en'): string {
  return SEVERITY_LABELS[locale][level];
}

export function stateLabel(state: FindingState, locale: Locale = 'en'): string {
  return STATE_LABELS[locale][state];
}

export function skeletonLabel(kind: SkeletonKind, locale: Locale = 'en'): string {
  return SKELETON_LABELS[locale][kind];
}

/** Libellé accessible d'une trouvaille, sans jamais citer sa valeur (PLA-F-21). */
export function findingAriaLabel(
  input: { preview: string; family: FindingFamily; danger: number; inHead: boolean },
  locale: Locale = 'en',
): string {
  const level = severityOf(input.danger);
  const severity = severityLabel(level, locale);
  const family = familyLabel(input.family, locale);
  const presence = input.inHead
    ? locale === 'fr'
      ? 'encore présent dans le code courant'
      : 'still standing in current code'
    : locale === 'fr'
      ? 'absent du code courant'
      : 'absent from current code';
  return `${family}, ${input.preview}, ${severity}, ${presence}`;
}
