import {
  severityOf,
  type CliErrorCode,
  type CliResult,
  type Finding,
  type PlacardReport,
} from '@placard/core';

/**
 * Sortie console (PLA-F-08, PLA-N-02) : TOUT texte est en anglais, et AUCUNE
 * valeur détectée n'est interpolée — seuls les aperçus caviardés (`preview`),
 * les empreintes (`fingerprint`), les scores et les chemins sont affichés.
 */

export interface ReportSummaryCounts {
  total: number;
  open: number;
  dismissed: number;
  critical: number;
  high: number;
  medium: number;
  low: number;
}

export function countSeverities(findings: readonly Finding[]): ReportSummaryCounts {
  let critical = 0;
  let high = 0;
  let medium = 0;
  let low = 0;
  let dismissed = 0;
  for (const f of findings) {
    if (f.state === 'ignored') dismissed += 1;
    const s = severityOf(f.danger);
    if (s === 'critical') critical += 1;
    else if (s === 'high') high += 1;
    else if (s === 'medium') medium += 1;
    else low += 1;
  }
  return {
    total: findings.length,
    open: findings.length - dismissed,
    dismissed,
    critical,
    high,
    medium,
    low,
  };
}

function findingRow(finding: Finding): string {
  const sev = severityOf(finding.danger).toUpperCase();
  const status = finding.state === 'ignored' ? 'DISMISSED' : 'OPEN';
  const head = finding.inHead ? ' [in HEAD]' : '';
  const loc = finding.locations[0];
  const place = loc !== undefined ? ` at ${loc.path}:${loc.line}` : '';
  return `  - [${sev}] ${finding.id} (${finding.family}/${finding.rule}) danger=${finding.danger}${head} ${status}${place}\n    preview: ${finding.preview}  fingerprint: ${finding.fingerprint}`;
}

/** Rendu texte en anglais du résumé d'un rapport. */
export function renderSummary(report: PlacardReport, reportPath?: string): string {
  const c = countSeverities(report.findings);
  const lines: string[] = [
    `Placard scan report for ${report.repo.name}`,
    `Commit: ${report.repo.head} (${report.repo.totalCommits} commits analyzed)`,
    `Findings: ${c.total} total (${c.open} open, ${c.dismissed} dismissed)`,
    `Severity: ${c.critical} critical, ${c.high} high, ${c.medium} medium, ${c.low} low`,
  ];
  if (report.skipped.binary > 0 || report.skipped.tooLarge > 0) {
    lines.push(`Skipped: ${report.skipped.binary} binary, ${report.skipped.tooLarge} oversized`);
  }
  if (report.findings.length > 0) {
    lines.push('', 'Findings:');
    for (const f of report.findings) lines.push(findingRow(f));
  }
  if (reportPath !== undefined) {
    lines.push('', `Report written to: ${reportPath}`);
  }
  return lines.join('\n');
}

/** Sérialisation JSON d'un résultat CLI pour `--json`. */
export function toResultJson(result: CliResult, report?: PlacardReport): string {
  const body = {
    exitCode: result.exitCode,
    ...(result.errorCode !== undefined ? { errorCode: result.errorCode } : {}),
    ...(result.reportPath !== undefined ? { reportPath: result.reportPath } : {}),
    ...(result.url !== undefined ? { url: result.url } : {}),
    ...(report !== undefined ? { report } : {}),
  };
  return JSON.stringify(body, null, 2);
}

export function renderJsonLine(result: CliResult, report?: PlacardReport): void {
  process.stdout.write(`${toResultJson(result, report)}\n`);
}

/** Message d'erreur clair pour `filter-repo-missing` (PLA-N-07). */
export function renderFilterRepoMissingMessage(): string {
  return [
    'Error: git-filter-repo is not installed or not available on PATH.',
    'The remediation purge script relies on git-filter-repo to rewrite history safely.',
    'Install it via your package manager (e.g. brew install git-filter-repo, pip install git-filter-repo).',
    'Other placard commands (scan, serve, demo, selftest) continue to function normally.',
  ].join('\n');
}

export function renderErrorMessage(code: CliErrorCode, detail?: string): string {
  if (code === 'filter-repo-missing') return renderFilterRepoMissingMessage();
  const base =
    code === 'not-a-git-repo'
      ? 'Error: The target directory is not a Git repository.'
      : code === 'git-missing'
        ? 'Error: git command is missing or not reachable on PATH.'
        : code === 'report-missing'
          ? 'Error: Analysis report not found. Run "placard scan" first.'
          : code === 'report-invalid'
            ? 'Error: The report file does not match the Placard report schema.'
            : code === 'open-findings'
              ? 'Warning: Open findings remain in this repository.'
              : code === 'port-busy'
                ? 'Error: The requested port is already in use.'
                : 'Error: An unknown error occurred.';
  return detail !== undefined ? `${base}\n${detail}` : base;
}
