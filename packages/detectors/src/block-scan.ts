import type { DetectorEngine, DetectorInput, DetectorResult, RawDetection } from '@placard/core';

import { countEmails } from './rules/identity';
import {
  MAX_PRIVATE_KEY_BLOCK_LINES,
  RULE_PRIVATE_KEY_BLOCK,
  RULE_PRIVATE_KEY_HEADER,
  findPrivateKeyBlock,
} from './rules/private-keys';
import { EMAIL_DUMP_THRESHOLD, RULE_RISKY_EMAIL_DUMP } from './rules/risky-files';

/**
 * Analyse d'un fichier entier, au-dessus du moteur de ligne.
 *
 * Deux vérifications ne peuvent pas se décider sur une ligne isolée :
 *  - **clé privée** : l'en-tête et le pied sont sur deux lignes différentes ;
 *    un en-tête sans pied est un bloc tronqué, donc pas une clé lisible ;
 *  - **export de données personnelles** : un fichier n'est un export que
 *    lorsqu'il accumule plus de 50 adresses, réparties sur ses lignes.
 *
 * `scanFile` conserve l'association ligne → détections (le contrat `RawDetection`
 * ne porte pas de numéro de ligne) et ajoute les détections de fichier.
 */

/** Options de l'analyse de fichier. */
export interface FileScanOptions {
  /** Fenêtre de recherche du pied d'une clé privée (défaut 200 lignes). */
  maxBlockLines?: number;
  /** Nombre d'adresses au-delà duquel le fichier est un export (défaut 50). */
  emailDumpThreshold?: number;
}

/** Résultat de l'analyse d'un fichier. */
export interface FileScanResult {
  /** Un résultat par entrée fournie, dans le même ordre. */
  results: DetectorResult[];
  /** Détections à l'échelle du fichier : chemin, densité d'adresses. */
  fileDetections: RawDetection[];
  /** Nombre total de règles essayées, pour les métriques de performance. */
  rulesTried: number;
}

/** Ligne d'une entrée, tolérante à une valeur non textuelle. */
function lineAt(inputs: readonly DetectorInput[], index: number): string {
  const line: unknown = inputs[index]?.line;
  return typeof line === 'string' ? line : '';
}

/** Chemin porté par la première entrée. */
function pathAt(inputs: readonly DetectorInput[], index: number): string {
  const path: unknown = inputs[index]?.path;
  return typeof path === 'string' ? path : '';
}

/**
 * Promeut un en-tête de clé privée en bloc complet si son pied est présent.
 * La valeur devient la matière de la clé, pour que deux clés distinctes ne
 * partagent jamais la même empreinte.
 */
function promoteBlock(
  detection: RawDetection,
  lines: readonly string[],
  index: number,
  maxBlockLines: number,
): RawDetection | undefined {
  if (detection.rule !== RULE_PRIVATE_KEY_HEADER) return detection;
  const block = findPrivateKeyBlock(lines, index, maxBlockLines);
  if (block === undefined) return undefined;
  return {
    ...detection,
    rule: RULE_PRIVATE_KEY_BLOCK,
    value: block.value,
    confidence: 0.99,
  };
}

/** Détection d'export d'adresses, si le fichier dépasse le seuil. */
function emailDumpDetection(
  lines: readonly string[],
  inputs: readonly DetectorInput[],
  threshold: number,
): RawDetection | undefined {
  let total = 0;
  let firstIndex = -1;
  for (let index = 0; index < lines.length; index += 1) {
    const count = countEmails(lines[index] ?? '');
    if (count > 0 && firstIndex < 0) firstIndex = index;
    total += count;
    if (total > threshold) break;
  }
  if (total <= threshold || firstIndex < 0) return undefined;
  const path = pathAt(inputs, firstIndex);
  return {
    rule: RULE_RISKY_EMAIL_DUMP,
    family: 'risky-file',
    value: path,
    start: 0,
    end: Math.max(1, path.length),
    confidence: 0.9,
  };
}

/** Analyse une entrée puis filtre/promeut ses détections au niveau du fichier. */
function scanEntry(
  engine: DetectorEngine,
  input: DetectorInput,
  lines: readonly string[],
  index: number,
  maxBlockLines: number,
): DetectorResult {
  const result = engine.scanLine(input);
  const detections: RawDetection[] = [];
  for (const detection of result.detections) {
    const kept = promoteBlock(detection, lines, index, maxBlockLines);
    if (kept !== undefined) detections.push(kept);
  }
  return { detections, rulesTried: result.rulesTried };
}

/** Analyse un fichier : lignes, puis chemin, puis densité d'adresses. */
export function scanFile(
  engine: DetectorEngine,
  inputs: readonly DetectorInput[],
  options: FileScanOptions = {},
): FileScanResult {
  const lines = inputs.map((_input, index) => lineAt(inputs, index));
  const maxBlockLines = options.maxBlockLines ?? MAX_PRIVATE_KEY_BLOCK_LINES;
  const threshold = options.emailDumpThreshold ?? EMAIL_DUMP_THRESHOLD;

  const results: DetectorResult[] = [];
  let rulesTried = 0;
  for (let index = 0; index < inputs.length; index += 1) {
    const input = inputs[index];
    if (input === undefined) continue;
    const result = scanEntry(engine, input, lines, index, maxBlockLines);
    rulesTried += result.rulesTried;
    results.push(result);
  }

  const path = pathAt(inputs, 0);
  const byPath = path.length > 0 ? engine.scanPath(path) : { detections: [], rulesTried: 0 };
  rulesTried += byPath.rulesTried;
  const fileDetections = [...byPath.detections];
  const dump = emailDumpDetection(lines, inputs, threshold);
  if (dump !== undefined) fileDetections.push(dump);

  return { results, fileDetections, rulesTried };
}
