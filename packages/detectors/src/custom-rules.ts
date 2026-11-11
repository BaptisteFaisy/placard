import { readFile } from 'node:fs/promises';

import { FAMILIES } from '@placard/core';
import type { DetectorRule, FindingFamily } from '@placard/core';

/**
 * Règles personnalisées chargées depuis le dépôt analysé (PLA-F-11).
 *
 * Format attendu, à la racine du dépôt (`/placard.rules.json`) :
 *
 * ```json
 * { "rules": [ { "id": "my-rule", "family": "cloud-key", "name": "My rule",
 *               "keywords": ["acme"], "pattern": "acme_[A-Za-z0-9]{20}",
 *               "flags": "i" } ] }
 * ```
 *
 * Le fichier vient du dépôt analysé : c'est un **contenu non fiable**. Il n'est
 * jamais exécuté (PLA-N-03) — aucun `eval`, aucun `Function` — seulement lu,
 * validé champ par champ et compilé en `RegExp`. `loadCustomRules` ne lève
 * jamais : fichier absent, JSON invalide ou règle douteuse donnent une liste
 * vide ou partielle, jamais une exception.
 */

/** Longueur maximale d'un motif accepté (borne anti-déni de service). */
const MAX_PATTERN_LENGTH = 512;

/** Drapeaux autorisés : jamais `g`/`y` (état partagé) ni `d` (réservé au moteur). */
const SAFE_FLAGS = 'imsu';

/** Identifiant attendu : kebab-case. */
const ID_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

/** Quantificateur appliqué à un groupe qui contient déjà un quantificateur. */
const NESTED_QUANTIFIER = /\((?:[^()\\]|\\.){0,200}[*+][^()]{0,200}\)\s*(?:[*+]|\{\d+,\d*\})/;

/** Un motif est-il raisonnablement sûr (pas de backtracking catastrophique) ? */
export function isSafePatternSource(source: string): boolean {
  if (source.length === 0 || source.length > MAX_PATTERN_LENGTH) return false;
  if (NESTED_QUANTIFIER.test(source)) return false;
  return true;
}

/** Ne garde que les drapeaux autorisés. */
function sanitizeFlags(flags: unknown): string {
  if (typeof flags !== 'string') return '';
  const kept = flags.split('').filter((flag) => SAFE_FLAGS.includes(flag));
  return [...new Set(kept)].join('');
}

/** Compile un motif ; `undefined` s'il est invalide, trop long ou risqué. */
export function compilePattern(source: unknown, flags: unknown): RegExp | undefined {
  if (typeof source !== 'string' || !isSafePatternSource(source)) return undefined;
  try {
    return new RegExp(source, sanitizeFlags(flags));
  } catch {
    return undefined;
  }
}

/** Lit un champ texte obligatoire, ou `undefined`. */
function readText(value: unknown, maxLength = 200): string | undefined {
  if (typeof value !== 'string') return undefined;
  const trimmed = value.trim();
  if (trimmed.length === 0 || trimmed.length > maxLength) return undefined;
  return trimmed;
}

/** Lit la famille, si elle appartient au vocabulaire partagé. */
function readFamily(value: unknown): FindingFamily | undefined {
  if (typeof value !== 'string') return undefined;
  return (FAMILIES as readonly string[]).includes(value) ? (value as FindingFamily) : undefined;
}

/** Lit la liste de mots-clés (vide autorisé : règle structurelle). */
function readKeywords(value: unknown): string[] | undefined {
  if (value === undefined) return [];
  if (!Array.isArray(value)) return undefined;
  const keywords: string[] = [];
  for (const entry of value) {
    const keyword = readText(entry, 64);
    if (keyword === undefined) return undefined;
    keywords.push(keyword);
  }
  return keywords;
}

/** Lit un nombre fini optionnel. */
function readNumber(value: unknown): number | undefined {
  return typeof value === 'number' && Number.isFinite(value) ? value : undefined;
}

/** Transforme une entrée du fichier en règle exploitable, ou `undefined`. */
export function toCustomRule(spec: unknown): DetectorRule | undefined {
  if (typeof spec !== 'object' || spec === null) return undefined;
  const record = spec as Record<string, unknown>;
  const id = readText(record.id, 64);
  const name = readText(record.name, 120);
  const family = readFamily(record.family);
  const keywords = readKeywords(record.keywords);
  const pattern = compilePattern(record.pattern, record.flags);
  if (id === undefined || !ID_PATTERN.test(id)) return undefined;
  if (name === undefined || family === undefined) return undefined;
  if (keywords === undefined || pattern === undefined) return undefined;

  const rule: DetectorRule = { id, family, name, keywords, pattern };
  const priority = readNumber(record.priority);
  if (priority !== undefined) rule.priority = priority;
  const scoreAdjust = readNumber(record.scoreAdjust);
  if (scoreAdjust !== undefined) rule.scoreAdjust = scoreAdjust;
  const provider = readText(record.provider, 64);
  if (provider !== undefined) rule.provider = provider;
  return rule;
}

/**
 * Valide et compile un contenu déjà décodé. Accepte `{ rules: [...] }` ou un
 * tableau nu. Les entrées invalides sont ignorées une à une : une règle
 * malformée ne prive pas l'utilisateur des autres.
 */
export function parseCustomRules(payload: unknown): DetectorRule[] {
  try {
    const list = Array.isArray(payload)
      ? payload
      : typeof payload === 'object' && payload !== null
        ? (payload as { rules?: unknown }).rules
        : undefined;
    if (!Array.isArray(list)) return [];
    const rules: DetectorRule[] = [];
    const seen = new Set<string>();
    for (const spec of list) {
      const rule = toCustomRule(spec);
      if (rule === undefined || seen.has(rule.id)) continue;
      seen.add(rule.id);
      rules.push(rule);
    }
    return rules;
  } catch {
    return [];
  }
}

/** Charge les règles personnalisées d'un fichier JSON ; ne lève jamais. */
export async function loadCustomRules(path: string): Promise<DetectorRule[]> {
  if (typeof path !== 'string' || path.length === 0) return [];
  let text: string;
  try {
    text = await readFile(path, 'utf8');
  } catch {
    return [];
  }
  try {
    return parseCustomRules(JSON.parse(text) as unknown);
  } catch {
    return [];
  }
}
