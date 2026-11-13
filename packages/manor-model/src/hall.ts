import { FAMILIES, severityOf } from '@placard/core';
import type { Finding, HallSummary, PlacardReport, SeverityLevel } from '@placard/core';

/**
 * Synthèse du hall d'entrée (PLA-F-20).
 *
 * Les squelettes debout dans le hall sont les secrets encore présents dans le
 * code courant (`inHead`) ; la fenêtre ouverte du couloir signale un dépôt
 * distant public (`publicRemote`).
 */

/** Table de comptage à zéro pour chaque gravité. */
export function emptySeverityCounts(): Record<SeverityLevel, number> {
  return { critical: 0, high: 0, medium: 0, low: 0 };
}

/** Table de comptage à zéro pour chaque famille. */
export function emptyFamilyCounts(): Record<Finding['family'], number> {
  const counts = {} as Record<Finding['family'], number>;
  for (const family of FAMILIES) counts[family] = 0;
  return counts;
}

/** Construit la synthèse du hall à partir des trouvailles retenues. */
export function buildHall(report: PlacardReport, findings: readonly Finding[]): HallSummary {
  const bySeverity = emptySeverityCounts();
  const byFamily = emptyFamilyCounts();
  let standing = 0;
  let sealed = 0;
  let dismissed = 0;
  let open = 0;
  for (const finding of findings) {
    bySeverity[severityOf(finding.danger)] += 1;
    byFamily[finding.family] += 1;
    if (finding.inHead) standing += 1;
    if (finding.state === 'sealed') sealed += 1;
    if (finding.state === 'ignored') dismissed += 1;
    if (finding.state === 'open') open += 1;
  }
  return {
    total: findings.length,
    standing,
    bySeverity,
    byFamily,
    sealed,
    dismissed,
    open,
    publicRemote: report.repo.publicRemote,
  };
}
