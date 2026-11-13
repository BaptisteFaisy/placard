import { createHash } from 'node:crypto';

import { luhnValid, mod97OfDigits, nirKey } from './checksums';
import type { FindingFamily } from './types';

/**
 * Fabrique de valeurs factices, à graine déterministe.
 *
 * Règle PLA-N-09 : **aucune valeur au format réel d'un secret n'est écrite dans
 * le dépôt**. Ces fonctions construisent les valeurs à l'exécution ; elles
 * servent d'oracle au générateur de dépôt hanté (`@placard/demo-repo`) et de
 * jeu de test aux détecteurs et aux propriétés fast-check (PLA-P-02, PLA-P-04).
 *
 * Les familles à somme de contrôle produisent des valeurs **valides** :
 * `invalidChecksumVariant` en dérive une forme invalide de même apparence.
 */

/** Générateur pseudo-aléatoire déterministe (mulberry32), amorcé par la graine. */
export type Rand = () => number;

export function prng(seed: string): Rand {
  const digest = createHash('sha256').update(seed).digest();
  let state = digest.readUInt32BE(0) || 0x9e3779b9;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const UPPER = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
const LOWER = 'abcdefghijklmnopqrstuvwxyz';
const ALNUM = `${UPPER}${LOWER}0123456789`;
const DIGITS = '0123456789';

function pick(rand: Rand, alphabet: string): string {
  const index = Math.min(alphabet.length - 1, Math.floor(rand() * alphabet.length));
  return alphabet.slice(index, index + 1);
}

function body(rand: Rand, alphabet: string, length: number): string {
  let out = '';
  for (let i = 0; i < length; i += 1) out += pick(rand, alphabet);
  return out;
}

/** Préfixes publics des familles « clé de service en nuage » (concaténés à l'exécution). */
const CLOUD_PREFIXES = ['AK' + 'IA', 'AI' + 'za', 'AS' + 'IA'] as const;

export function fakeCloudKey(rand: Rand): string {
  const prefix = CLOUD_PREFIXES[Math.floor(rand() * CLOUD_PREFIXES.length)] ?? CLOUD_PREFIXES[0]!;
  const alphabet = prefix.startsWith('AI') ? ALNUM.replace(/\+/g, '') + '_-' : UPPER;
  const length = prefix.startsWith('AI') ? 35 : 16;
  return `${prefix}${body(rand, alphabet, length)}`;
}

/** Préfixes de jetons de plateformes, concaténés à l'exécution. */
const TOKEN_SHAPES = [
  { prefix: 'gh' + 'p_', alphabet: ALNUM, length: 36 },
  { prefix: 'github_' + 'pat_', alphabet: ALNUM, length: 36 },
  { prefix: 'xo' + 'xb-', alphabet: ALNUM, length: 40 },
  { prefix: 'np' + 'm_', alphabet: ALNUM, length: 36 },
  { prefix: 'sk_' + 'live_', alphabet: ALNUM, length: 24 },
  { prefix: 'sk-' + 'proj_', alphabet: ALNUM, length: 40 },
] as const;

export function fakePlatformToken(rand: Rand): string {
  const shape = TOKEN_SHAPES[Math.floor(rand() * TOKEN_SHAPES.length)] ?? TOKEN_SHAPES[0]!;
  return `${shape.prefix}${body(rand, shape.alphabet, shape.length)}`;
}

export function fakePrivateKeyBlock(rand: Rand): string {
  const header = `-----BEGIN ${body(rand, UPPER, 0) || 'RSA'} PRIVATE KEY-----`;
  const lines: string[] = [header.replace('  ', ' ')];
  for (let i = 0; i < 4; i += 1) lines.push(body(rand, ALNUM, 64));
  lines.push(`-----END ${'RSA'} PRIVATE KEY-----`);
  void rand;
  return lines.join('\n');
}

function base64url(input: string): string {
  return Buffer.from(input, 'utf8').toString('base64url');
}

export function fakeSignedToken(rand: Rand): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT', kid: body(rand, ALNUM, 8) }));
  const payload = base64url(
    JSON.stringify({ sub: body(rand, DIGITS, 10), iat: 1_700_000_000, seed: Math.floor(rand() * 1e9) }),
  );
  return `${header}.${payload}.${body(rand, ALNUM, 43)}`;
}

export function fakePassword(rand: Rand): string {
  return `${body(rand, ALNUM, 6)}${pick(rand, '!@#$%^&*')}${body(rand, ALNUM, 9)}`;
}

/** IBAN français valide (modulo 97), construit par recherche de la clé. */
export function fakeIban(rand: Rand): string {
  const bban = `${body(rand, DIGITS, 10)}${body(rand, UPPER, 11)}`;
  const numeric = `${bban}FR00`.replace(/[A-Z]/g, (c) => String(c.charCodeAt(0) - 55));
  const remainder = mod97OfDigits(numeric);
  const check = String(98 - remainder).padStart(2, '0');
  return `FR${check}${bban}`;
}

/** Numéro de carte valide (Luhn), préfixe 4 (Visa) ou 5 (Mastercard). */
export function fakeCardNumber(rand: Rand): string {
  const prefix = rand() < 0.5 ? '4' : '5' + pick(rand, '12345');
  const base = prefix + body(rand, DIGITS, 15 - prefix.length);
  for (let check = 0; check <= 9; check += 1) {
    const candidate = base + String(check);
    if (luhnValid(candidate)) return candidate;
  }
  return `${base}0`;
}

/** Numéro de sécurité sociale français valide (13 chiffres + clé). */
export function fakeFrenchSsn(rand: Rand): string {
  const sex = rand() < 0.5 ? '1' : '2';
  const year = body(rand, '0123456789', 2);
  const month = String(1 + Math.floor(rand() * 12)).padStart(2, '0');
  const dept = String(1 + Math.floor(rand() * 95)).padStart(2, '0');
  const commune = body(rand, DIGITS, 3);
  const order = body(rand, DIGITS, 3);
  const body13 = `${sex}${year}${month}${dept}${commune}${order}`.slice(0, 13);
  const key = nirKey(body13);
  return `${body13}${String(key ?? 0).padStart(2, '0')}`;
}

/** Adresse e-mail réaliste, hors domaines d'exemple (pour être détectée). */
export function fakeEmail(rand: Rand): string {
  const syllables = ['mar', 'dup', 'ler', 'che', 'nov', 'san', 'vie', 'bor', 'lan', 'mor'];
  const name = body(rand, LOWER, 1) + syllables[Math.floor(rand() * syllables.length)]!;
  const domain = `${syllables[Math.floor(rand() * syllables.length)]!}-${body(rand, DIGITS, 3)}`;
  return `${name}.${body(rand, LOWER, 4)}@${domain}.fr`;
}

export function fakePhoneNumber(rand: Rand): string {
  return `+33 6 ${body(rand, DIGITS, 2)} ${body(rand, DIGITS, 2)} ${body(rand, DIGITS, 2)} ${body(rand, DIGITS, 2)}`;
}

export function fakeSuspiciousString(rand: Rand): string {
  return body(rand, ALNUM, 40);
}

/** Fabrique une valeur factice d'une famille donnée, à partir d'une graine. */
export function fakeValue(family: FindingFamily, seed: string, index = 0): string {
  const rand = prng(`${seed}:${family}:${index}`);
  switch (family) {
    case 'cloud-key':
      return fakeCloudKey(rand);
    case 'platform-token':
      return fakePlatformToken(rand);
    case 'private-key':
      return fakePrivateKeyBlock(rand);
    case 'signed-token':
      return fakeSignedToken(rand);
    case 'plaintext-password':
      return fakePassword(rand);
    case 'bank-data':
      return rand() < 0.6 ? fakeIban(rand) : fakeCardNumber(rand);
    case 'identity':
      return rand() < 0.5 ? fakeFrenchSsn(rand) : fakeEmail(rand);
    case 'risky-file':
      return `.env.${body(rand, LOWER, 6)}`;
    case 'suspicious-string':
      return fakeSuspiciousString(rand);
    default:
      return fakeSuspiciousString(rand);
  }
}

/**
 * Dérive d'une valeur valide une variante à somme de contrôle **fausse**, de
 * même apparence (PLA-P-04 : la forme invalide ne doit pas être détectée).
 */
export function invalidChecksumVariant(value: string, family: FindingFamily): string {
  if (family !== 'bank-data' && family !== 'identity') return value;
  const digits = value.replace(/\D/g, '');
  if (digits.length < 2) return value;
  const last = Number(digits[digits.length - 1] ?? '0');
  const broken = String((last + 1) % 10);
  const index = value.lastIndexOf(digits[digits.length - 1] ?? '');
  if (index < 0) return value;
  return `${value.slice(0, index)}${broken}${value.slice(index + 1)}`;
}
