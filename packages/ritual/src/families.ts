import type { FindingFamily } from '@placard/core';

/**
 * Familles qui ne sont pas des identifiants techniques mais des données
 * personnelles : il n'y a rien à révoquer, seulement une exposition à évaluer.
 */
export const PERSONAL_DATA_FAMILIES: readonly FindingFamily[] = ['identity', 'bank-data'];

/** Vrai si la famille relève de données personnelles (pas de rotation possible). */
export function isPersonalData(family: FindingFamily): boolean {
  return PERSONAL_DATA_FAMILIES.includes(family);
}

/**
 * Rappel prudent, jamais un avis juridique : Placard ne se prononce pas sur le
 * cas de l'utilisateur, il rappelle seulement qu'une notification peut être due.
 */
export const PERSONAL_DATA_NOTICE =
  'Personal data cannot be rotated. An exposure of personal data may create ' +
  'notification obligations toward the people concerned and, depending on your ' +
  'jurisdiction, toward a data protection authority. Placard does not assess ' +
  'whether your situation requires a notification: check with your legal ' +
  'counsel or your data protection officer.';

/** Titre de l'étape 1 quand il n'y a rien à révoquer. */
export const EVALUATE_TITLE = 'Evaluate the exposure';
