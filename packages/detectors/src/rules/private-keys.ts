import type { DetectorRule } from '@placard/core';

import { PEM_CLOSE, PEM_DASHES, PEM_KEY_WORDS, PEM_OPEN } from '../signatures';

/**
 * Famille `private-key` : blocs PEM.
 *
 * Validation exigée : **en-tête ET pied présents**. Une ligne de diff ne porte
 * qu'une ligne du bloc ; le moteur de ligne signale donc l'en-tête comme un
 * candidat (règle `private-key-header`), et `scanFile` (`block-scan.ts`) ne le
 * promeut en bloc complet (`private-key-block`) que si le pied correspondant
 * apparaît plus loin dans le fichier.
 *
 * La valeur d'un bloc complet est **la matière de la clé** (en-tête, corps et
 * pied joints), jamais le seul en-tête : sans cela, toutes les clés d'un dépôt
 * partageraient la même empreinte et seraient regroupées à tort.
 */

/** Étiquette facultative du type de clé (`RSA`, `EC`, `OPENSSH`, `ENCRYPTED`…). */
const LABEL = '(?:[A-Z0-9]{1,20} ){0,3}';
const BLOCK_TAIL = `(?: BLOCK)?${PEM_DASHES}`;

/** Ligne d'en-tête : `-----BEGIN <type> PRIVATE KEY-----`. */
const HEADER_PATTERN = new RegExp(`${PEM_OPEN} ${LABEL}${PEM_KEY_WORDS}${BLOCK_TAIL}`);
/** Ligne de pied : `-----END <type> PRIVATE KEY-----`. */
const FOOTER_PATTERN = new RegExp(`${PEM_CLOSE} ${LABEL}${PEM_KEY_WORDS}${BLOCK_TAIL}`);

/** Bloc complet sur une seule ligne (un fichier peut être d'une seule ligne). */
const SINGLE_LINE_PATTERN = new RegExp(
  `${PEM_OPEN} ${LABEL}${PEM_KEY_WORDS}${BLOCK_TAIL}[\\s\\S]{0,8192}?${PEM_CLOSE} ${LABEL}${PEM_KEY_WORDS}${BLOCK_TAIL}`,
);

/** Nombre de lignes au-delà duquel un bloc non refermé est considéré tronqué. */
export const MAX_PRIVATE_KEY_BLOCK_LINES = 200;

/** Taille maximale de la matière de clé retenue, en caractères. */
export const MAX_PRIVATE_KEY_BLOCK_CHARS = 4096;

/** Identifiants stables des règles de clé privée. */
export const RULE_PRIVATE_KEY_BLOCK = 'private-key-block';
export const RULE_PRIVATE_KEY_HEADER = 'private-key-header';

/** Étiquette de clé reconnue sur une ligne d'en-tête, ou `undefined`. */
export function matchPrivateKeyHeader(line: string): string | undefined {
  const match = HEADER_PATTERN.exec(line);
  return match ? extractLabel(match[0]) : undefined;
}

/** Étiquette de clé reconnue sur une ligne de pied, ou `undefined`. */
export function matchPrivateKeyFooter(line: string): string | undefined {
  const match = FOOTER_PATTERN.exec(line);
  return match ? extractLabel(match[0]) : undefined;
}

/** Extrait le type de clé d'un marqueur PEM (`RSA`, `EC`, `OPENSSH`…). */
function extractLabel(marker: string): string {
  const inner = marker
    .replace(PEM_OPEN, '')
    .replace(PEM_CLOSE, '')
    .replace(PEM_DASHES, '')
    .replace(PEM_KEY_WORDS, '')
    .replace('BLOCK', '')
    .trim();
  return inner.length > 0 ? inner : 'PRIVATE KEY';
}

/** Deux marqueurs désignent-ils le même type de clé (ou un type générique) ? */
function labelsMatch(header: string, footer: string): boolean {
  return header === footer || header === 'PRIVATE KEY' || footer === 'PRIVATE KEY';
}

/** Bloc de clé privée repéré dans un fichier. */
export interface PrivateKeyBlock {
  /** Indice de la ligne de pied (inclus). */
  footerIndex: number;
  /** Matière de la clé : en-tête, corps et pied joints, taille bornée. */
  value: string;
}

/**
 * Cherche le pied correspondant à l'en-tête situé à `startIndex`.
 * Parcourt au plus `maxLines` lignes — jamais tout le fichier (PLA-P-10).
 */
export function findPrivateKeyBlock(
  lines: readonly string[],
  startIndex: number,
  maxLines: number = MAX_PRIVATE_KEY_BLOCK_LINES,
): PrivateKeyBlock | undefined {
  const headerLine = lines[startIndex];
  if (headerLine === undefined) return undefined;
  const label = matchPrivateKeyHeader(headerLine);
  if (label === undefined) return undefined;
  const end = Math.min(lines.length, startIndex + maxLines + 1);
  for (let index = startIndex + 1; index < end; index += 1) {
    const footer = matchPrivateKeyFooter(lines[index] ?? '');
    if (footer === undefined || !labelsMatch(label, footer)) continue;
    const value = lines.slice(startIndex, index + 1).join('\n').slice(0, MAX_PRIVATE_KEY_BLOCK_CHARS);
    return { footerIndex: index, value };
  }
  return undefined;
}

/** L'en-tête trouvé à `startIndex` est-il refermé par un pied de même type ? */
export function privateKeyBlockComplete(
  lines: readonly string[],
  startIndex: number,
  maxLines: number = MAX_PRIVATE_KEY_BLOCK_LINES,
): boolean {
  return findPrivateKeyBlock(lines, startIndex, maxLines) !== undefined;
}

export const privateKeyRules: readonly DetectorRule[] = [
  {
    id: RULE_PRIVATE_KEY_BLOCK,
    family: 'private-key',
    name: 'Private key block (header and footer present)',
    keywords: [PEM_OPEN],
    pattern: SINGLE_LINE_PATTERN,
    validate: (value) => {
      const header = matchPrivateKeyHeader(value);
      const footer = matchPrivateKeyFooter(value);
      return header !== undefined && footer !== undefined && labelsMatch(header, footer);
    },
    priority: 100,
    provider: 'generic',
  },
  {
    id: RULE_PRIVATE_KEY_HEADER,
    family: 'private-key',
    name: 'Private key header',
    keywords: [PEM_OPEN],
    pattern: HEADER_PATTERN,
    validate: (value) => matchPrivateKeyHeader(value) !== undefined,
    priority: 95,
    provider: 'generic',
  },
];
