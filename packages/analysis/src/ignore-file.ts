import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';

import type { IgnoreFileEntry, IgnoreMap } from '@placard/core';
import { isMap, isSeq, parseDocument, type YAMLSeq } from 'yaml';

/**
 * Fichier d'exclusions `.placard/ignore.yml` (PLA-F-09, PLA-F-29).
 *
 * Format :
 *
 * ```yaml
 * ignore:
 *   - fingerprint: hmac256:…
 *     rule: aws-access-key
 *     reason: rotated and revoked
 *     author: alice
 *     date: 2026-02-01T10:00:00Z
 * ```
 *
 * Une exclusion ne porte **jamais** de valeur : seulement l'empreinte HMAC, qui
 * ne permet pas de remonter au secret. Les commentaires du fichier sont
 * conservés à l'écriture (l'arbre YAML est modifié, pas réécrit à plat).
 */

/** Clé racine du fichier d'exclusions. */
const ROOT_KEY = 'ignore';

/** En-tête écrit à la création du fichier. */
const FILE_HEADER = [
  '# Placard ignore file.',
  '# Fingerprints listed here are deliberately accepted and stay out of the open findings.',
  '# Never put a secret value in this file: the HMAC fingerprint is enough.',
].join('\n');

/** Erreur d'exclusion invalide : ne contient jamais de valeur détectée. */
export class IgnoreFileError extends Error {
  override name = 'IgnoreFileError';
}

function asString(value: unknown): string | undefined {
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : undefined;
}

/** Vue objet d'un nœud YAML (ou d'un objet simple), sinon `undefined`. */
function asRecord(raw: unknown): Record<string, unknown> | undefined {
  if (isMap(raw)) return raw.toJSON() as Record<string, unknown>;
  if (typeof raw === 'object' && raw !== null) return raw as Record<string, unknown>;
  return undefined;
}

/** Convertit une entrée YAML inconnue en `IgnoreFileEntry`, ou `undefined`. */
function toEntry(raw: unknown): IgnoreFileEntry | undefined {
  const record = asRecord(raw);
  if (record === undefined) return undefined;
  const fingerprint = asString(record.fingerprint);
  const reason = asString(record.reason);
  if (fingerprint === undefined || reason === undefined) return undefined;
  const entry: IgnoreFileEntry = {
    fingerprint,
    reason,
    author: asString(record.author) ?? 'unknown',
    date: asString(record.date) ?? '',
  };
  const rule = asString(record.rule);
  if (rule !== undefined) entry.rule = rule;
  return entry;
}

/** Analyse le texte d'un fichier d'exclusions ; retourne la carte des empreintes. */
export function parseIgnoreText(text: string): IgnoreMap {
  const document = parseDocument(text);
  if (document.errors.length > 0) {
    throw new IgnoreFileError(`Invalid ignore file: ${document.errors[0]?.message ?? 'parse error'}`);
  }
  const root = document.get(ROOT_KEY);
  if (root === null || root === undefined) return new Map();
  if (!isSeq(root)) throw new IgnoreFileError(`Invalid ignore file: "${ROOT_KEY}" must be a list`);

  const map = new Map<string, IgnoreFileEntry>();
  const items = (root as YAMLSeq).items;
  items.forEach((item, index) => {
    const entry = toEntry(item);
    if (entry === undefined) {
      throw new IgnoreFileError(
        `Invalid ignore file: entry #${index + 1} needs a "fingerprint" and a "reason"`,
      );
    }
    map.set(entry.fingerprint, entry);
  });
  return map;
}

/**
 * Lit `.placard/ignore.yml`. Un chemin absent, un fichier absent ou un fichier
 * vide donnent une carte vide : aucune exclusion, jamais d'échec de l'analyse.
 */
export async function loadIgnoreFile(path: string | undefined): Promise<IgnoreMap> {
  if (path === undefined || path.trim().length === 0) return new Map();
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return new Map();
  }
  return parseIgnoreText(text);
}

/** Construit le document YAML prêt à écrire pour une entrée donnée. */
function withEntry(text: string, entry: IgnoreFileEntry): string {
  const document = parseDocument(text.length > 0 ? text : `${FILE_HEADER}\n`);
  const plain = {
    fingerprint: entry.fingerprint,
    ...(entry.rule === undefined ? {} : { rule: entry.rule }),
    reason: entry.reason,
    author: entry.author,
    date: entry.date,
  };
  const root = document.get(ROOT_KEY);
  if (root === null || root === undefined) {
    // Fichier neuf (ou sans clé `ignore`) : on crée la liste, en-tête comprise.
    document.set(ROOT_KEY, [plain]);
  } else if (isSeq(root)) {
    root.items.push(document.createNode(plain));
  } else {
    throw new IgnoreFileError(`Invalid ignore file: "${ROOT_KEY}" must be a list`);
  }
  return document.toString();
}

/**
 * Ajoute une exclusion sans écraser les entrées existantes ni perdre les
 * commentaires (PLA-F-29). Une raison vide est refusée : une exclusion doit
 * toujours pouvoir s'expliquer plus tard.
 */
export async function appendIgnoreEntry(path: string, entry: IgnoreFileEntry): Promise<void> {
  if (entry.reason.trim().length === 0) {
    throw new IgnoreFileError('An ignore entry needs a non-empty reason');
  }
  if (entry.fingerprint.trim().length === 0) {
    throw new IgnoreFileError('An ignore entry needs a fingerprint');
  }
  let existing = '';
  try {
    existing = await readFile(path, 'utf8');
  } catch {
    existing = '';
  }
  const next = withEntry(existing, entry);
  await mkdir(dirname(path), { recursive: true });
  await writeFile(path, next, 'utf8');
}
