import { nirValid } from '@placard/core';
import type { DetectorRule } from '@placard/core';

/**
 * Famille `identity` : données personnelles françaises et adresses e-mail.
 *
 * Exigence PLA-F-03 : pour le NIR, seule une **clé valide** est signalée. Pour
 * les adresses, les domaines d'exemple (`example.com`, `.test`, `.invalid`,
 * `.local`) et les préfixes d'hôtes SSH (`git@github.com`) sont écartés : ils
 * trahissent une documentation ou une URL Git, pas une fuite.
 */

/**
 * NIR : 15 chiffres, groupés à la française (1-2-2-2-3-3-2) ou d'un bloc.
 *
 * Les bornes sont alphanumériques (`\w`), et non seulement numériques : sans
 * cela, les 15 chiffres qu'un IBAN contient au milieu seraient pris pour un
 * NIR valide, et le signalement banking serait écrasé par le signalement
 * identity. Le NIR est un nombre **entier**, jamais une sous-suite d'un code.
 */
const NIR_PATTERN = /(?<![\w])(\d[ -]?\d{2}[ -]?\d{2}[ -]?\d{2}[ -]?\d{3}[ -]?\d{3}[ -]?\d{2})(?![\w])/;

/** Adresse électronique usuelle (partie locale bornée, TLD borné). */
const EMAIL_PATTERN =
  /(?<![\w.+-])([A-Za-z0-9._%+-]{1,64}@[A-Za-z0-9-]{1,63}(?:\.[A-Za-z0-9-]{1,63}){1,4})(?![\w-])/g;

/** Téléphone français : `+33`, `0033` ou `0`, puis 9 chiffres groupés. */
const PHONE_PATTERN = /(?<![\w+])((?:\+33|0033|0)[ .-]?[1-9](?:[ .-]?\d{2}){4})(?!\d)/;

/** Domaines réservés à la documentation : jamais une fuite réelle. */
const EXAMPLE_DOMAINS: readonly string[] = [
  'example.com',
  'example.org',
  'example.net',
  'example.edu',
  '.test',
  '.invalid',
  '.local',
  '.localhost',
  'localhost',
];

/** Identifiants stables des règles d'identité. */
export const RULE_IDENTITY_NIR = 'identity-nir';
export const RULE_IDENTITY_EMAIL = 'identity-email';
export const RULE_IDENTITY_PHONE = 'identity-phone';

/** Le domaine de l'adresse est-il un domaine d'exemple ou réservé ? */
export function isExampleDomain(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return true;
  const domain = email.slice(at + 1).toLowerCase();
  if (domain.length === 0) return true;
  return EXAMPLE_DOMAINS.some((reserved) =>
    reserved.startsWith('.') ? domain.endsWith(reserved) : domain === reserved,
  );
}

/** Une adresse est-elle retenue comme donnée personnelle ? */
export function isPersonalEmail(value: string): boolean {
  if (isExampleDomain(value)) return false;
  if (/^(git|hg|svn)@/i.test(value)) return false;
  return hasAlphaTld(value);
}

/**
 * Le domaine finit-il par un TLD **alphabétique** (`.com`, `.fr`) ?
 *
 * Sans ce garde, un spécificateur de paquet npm (`react-dom@19.3.1`) est lu
 * comme une adresse : `19.3.1` satisfait le motif générique. Un TLD réel ne
 * contient que des lettres (≥ 2).
 */
export function hasAlphaTld(email: string): boolean {
  const at = email.lastIndexOf('@');
  if (at < 0) return false;
  const domain = email.slice(at + 1);
  const lastDot = domain.lastIndexOf('.');
  if (lastDot < 0) return false;
  const tld = domain.slice(lastDot + 1);
  return tld.length >= 2 && /^[A-Za-z]+$/.test(tld);
}

/** Une suite séquentielle montante/descendante (ex. `0123456789`) n'est pas un numéro. */
function isSequentialDigits(digits: string): boolean {
  if (digits.length < 4) return false;
  let asc = true;
  let desc = true;
  for (let i = 1; i < digits.length; i += 1) {
    const prev = digits.charCodeAt(i - 1);
    const curr = digits.charCodeAt(i);
    if (curr !== prev + 1) asc = false;
    if (curr !== prev - 1) desc = false;
  }
  return asc || desc;
}

/** Un numéro de téléphone français plausible (forme, variété, pas séquentiel). */
export function isFrenchPhone(value: string): boolean {
  const digits = value.replace(/[^\d+]/g, '');
  const national = digits.startsWith('+33')
    ? `0${digits.slice(3)}`
    : digits.startsWith('0033')
      ? `0${digits.slice(4)}`
      : digits;
  if (!/^0[1-9]\d{8}$/.test(national)) return false;
  if (isSequentialDigits(national)) return false;
  return new Set(national).size >= 4;
}

/** Compte les adresses d'une ligne, sans dépasser `cap` (borne de coût). */
export function countEmails(line: string, cap = 1000): number {
  const pattern = new RegExp(EMAIL_PATTERN.source, 'g');
  let count = 0;
  for (const match of line.matchAll(pattern)) {
    const value = match[1];
    if (value !== undefined && isPersonalEmail(value)) count += 1;
    if (count >= cap) break;
  }
  return count;
}

/** NIR valide, avec une clé correcte (modulo 97). */
export function isFrenchSsn(value: string): boolean {
  return nirValid(value);
}

export const identityRules: readonly DetectorRule[] = [
  {
    id: RULE_IDENTITY_NIR,
    family: 'identity',
    name: 'French national identity number (NIR)',
    keywords: [],
    pattern: NIR_PATTERN,
    validate: (value) => isFrenchSsn(value),
    priority: 78,
    provider: 'generic',
  },
  {
    id: RULE_IDENTITY_EMAIL,
    family: 'identity',
    name: 'Email address',
    keywords: [],
    pattern: new RegExp(EMAIL_PATTERN.source),
    validate: (value) => isPersonalEmail(value),
    priority: 60,
    provider: 'generic',
  },
  {
    id: RULE_IDENTITY_PHONE,
    family: 'identity',
    name: 'French phone number',
    keywords: [],
    pattern: PHONE_PATTERN,
    validate: (value) => isFrenchPhone(value),
    priority: 55,
    provider: 'generic',
  },
];
