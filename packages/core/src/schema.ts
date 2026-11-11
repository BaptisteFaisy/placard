import { z } from 'zod';

import type { PlacardReport } from './types.js';

/**
 * Schéma Zod du rapport Placard.
 *
 * Deux garanties (PLA-F-08, PLA-N-02) :
 *  1. le rapport est validé à la lecture comme à l'écriture ;
 *  2. aucun champ ne peut porter une valeur détectée — les seuls textes
 *     autorisés sont l'aperçu masqué, l'empreinte HMAC et le contexte caviardé.
 */

const FAMILY_VALUES = [
  'cloud-key',
  'platform-token',
  'private-key',
  'signed-token',
  'plaintext-password',
  'bank-data',
  'identity',
  'risky-file',
  'suspicious-string',
] as const;

const STATE_VALUES = ['open', 'rotated', 'purged', 'sealed', 'ignored'] as const;

export const commitRefSchema = z.object({
  commit: z.string().min(7).max(64),
  shortCommit: z.string().min(4).max(16),
  date: z.string(),
  author: z.string().optional(),
  message: z.string().optional(),
});

export const locationSchema = z.object({
  commit: z.string().min(7).max(64),
  path: z.string().min(1),
  line: z.number().int().nonnegative(),
  /** Extrait déjà caviardé : `[REDACTED:<family>]` remplace la valeur. */
  snippet: z.string().optional(),
});

export const findingSchema = z.object({
  id: z.string().regex(/^sk_\d{4,}$/),
  family: z.enum(FAMILY_VALUES),
  rule: z.string().min(1),
  fingerprint: z.string().regex(/^hmac256:[0-9a-f]{16,64}$/),
  preview: z.string().min(1),
  danger: z.number().int().min(0).max(100),
  reasons: z.array(z.string()).default([]),
  inHead: z.boolean(),
  introduced: commitRefSchema,
  removed: z.array(commitRefSchema).default([]),
  locations: z.array(locationSchema).min(1),
  state: z.enum(STATE_VALUES),
  ignoreReason: z.string().optional(),
  rotatedAt: z.string().optional(),
});

export const reportSchema = z.object({
  schema: z.string().default('1.0.0'),
  tool: z.object({ name: z.literal('placard'), version: z.string() }),
  repo: z.object({
    name: z.string(),
    head: z.string().min(7).max(64),
    totalCommits: z.number().int().nonnegative(),
    publicRemote: z.boolean(),
    analyzedAt: z.string(),
  }),
  findings: z.array(findingSchema),
  skipped: z.object({
    binary: z.number().int().nonnegative(),
    tooLarge: z.number().int().nonnegative(),
  }),
});

/** Valide un JSON inconnu et retourne un rapport typé, ou une erreur explicite. */
export function parseReport(input: unknown): PlacardReport {
  return reportSchema.parse(input) as PlacardReport;
}

/** Version non lançante, pour l'interface qui accepte un dépôt de rapport local. */
export function safeParseReport(input: unknown): z.SafeParseReturnType<unknown, PlacardReport> {
  return reportSchema.safeParse(input) as z.SafeParseReturnType<unknown, PlacardReport>;
}

/** Sérialise un rapport : tri stable des trouvailles pour un rendu déterministe. */
export function stringifyReport(report: PlacardReport): string {
  const ordered = [...report.findings].sort((a, b) => a.id.localeCompare(b.id));
  return JSON.stringify({ ...report, findings: ordered }, null, 2);
}
