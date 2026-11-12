import type { FindingFamily } from './types';

export interface ScoreOptions {
  family: FindingFamily;
  inHead: boolean;
  publicRemote: boolean;
  isTestPath: boolean;
  isDummyValue: boolean;
}

export interface ScoreResult {
  score: number;
  reasons: string[];
}

const BASE_SCORES: Record<FindingFamily, number> = {
  'private-key': 90,
  'cloud-key': 85,
  'platform-token': 75,
  'bank-data': 70,
  'plaintext-password': 60,
  identity: 30,
  'risky-file': 50,
  'signed-token': 40,
  'suspicious-string': 25,
};

/**
 * Calcule le score de danger explicable d'une trouvaille entre 0 et 100.
 * Respecte les exigences PLA-F-07 et la propriété de monotonicité PLA-P-07.
 */
export function computeDangerScore(options: ScoreOptions): ScoreResult {
  const base = BASE_SCORES[options.family] ?? 25;
  const reasons: string[] = [`base ${options.family}: +${base}`];
  let total = base;

  if (options.inHead) {
    total += 15;
    reasons.push('still present in HEAD: +15');
  }

  if (options.publicRemote) {
    total += 10;
    reasons.push('public remote repository: +10');
  }

  if (options.isTestPath) {
    total -= 30;
    reasons.push('test/example directory path: -30');
  }

  if (options.isDummyValue) {
    total -= 20;
    reasons.push('known dummy/mock placeholder: -20');
  }

  const clamped = Math.max(0, Math.min(100, total));
  return { score: clamped, reasons };
}
