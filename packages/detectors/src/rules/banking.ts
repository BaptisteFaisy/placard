import { luhnValid, mod97Valid } from '@placard/core';
import type { DetectorRule } from '@placard/core';

/**
 * Famille `bank-data` : IBAN et numéros de carte.
 *
 * Exigence PLA-F-03 : **ne signaler que les sommes de contrôle valides**. Un
 * numéro à 16 chiffres qui rate Luhn est du bruit (identifiant de commande,
 * numéro de suivi) ; le signaler détruirait la confiance dans le rapport.
 */

/** Longueurs admises d'un numéro de carte (ISO/IEC 7812, 13..19 avec BIN). */
const CARD_MAX_DIGITS = 19;

/** Un NIR français fait 15 chiffres : un nombre de 15 chiffres commençant par 1 ou 2 en est un. */
const NIR_LENGTH = 15;

/** IBAN : 2 lettres de pays, 2 chiffres de clé, puis 10 à 30 caractères. */
const IBAN_PATTERN = /(?<!\w)([A-Z]{2}\d{2}(?: ?[A-Z0-9]{4}){2,7}(?: ?[A-Z0-9]{1,4})?)(?!\w)/;

/** Suite de chiffres, éventuellement groupée par espaces ou tirets. */
const CARD_PATTERN = /(?<!\w)(\d(?:[ -]?\d){11,18})(?!\w)/;

/** Identifiants stables des règles bancaires. */
export const RULE_BANK_IBAN = 'bank-iban';
export const RULE_BANK_CARD = 'bank-card-number';

/** Chiffres seuls d'un numéro présenté avec séparateurs. */
export function digitsOf(value: string): string {
  return value.replace(/[\s-]/g, '');
}

/**
 * Un nombre de 15 chiffres commençant par 1 ou 2 est la forme d'un NIR
 * français, pas d'une carte : on laisse la famille `identity` le traiter.
 */
function looksLikeFrenchSsn(digits: string): boolean {
  return digits.length === NIR_LENGTH && /^[12]/.test(digits);
}

/** Préfixes d'émetteurs de cartes reconnus (Visa 4, Mastercard 5/2, Amex 3, Discover 6). */
const CARD_ISSUER_PREFIX = /^[23456]/;

/** Un numéro de carte plausible : longueur 13..19, BIN plausible, Luhn valide. */
export function isCardNumber(value: string): boolean {
  const digits = digitsOf(value);
  if (digits.length < 13 || digits.length > CARD_MAX_DIGITS) return false;
  if (!/^\d+$/.test(digits)) return false;
  if (!CARD_ISSUER_PREFIX.test(digits)) return false;
  if (looksLikeFrenchSsn(digits)) return false;
  if (new Set(digits).size < 4) return false;
  return luhnValid(digits);
}

export const bankingRules: readonly DetectorRule[] = [
  {
    id: RULE_BANK_IBAN,
    family: 'bank-data',
    name: 'Bank account number (IBAN)',
    // Règle structurelle : la forme de la valeur est son propre filtre.
    keywords: [],
    pattern: IBAN_PATTERN,
    validate: (value) => mod97Valid(value),
    priority: 75,
    provider: 'generic',
  },
  {
    id: RULE_BANK_CARD,
    family: 'bank-data',
    name: 'Payment card number',
    keywords: [],
    pattern: CARD_PATTERN,
    validate: (value) => isCardNumber(value),
    priority: 70,
    provider: 'generic',
  },
];
