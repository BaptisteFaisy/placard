import { readFile } from 'node:fs/promises';

import { safeParseReport } from '@placard/core';
import type { Finding, PlacardReport, RitualOptions, RitualState } from '@placard/core';

import { baseState, loadState, saveState } from './state';

/**
 * Vérification (PLA-F-27).
 *
 * Relit le rapport de la nouvelle analyse : si l'empreinte de la trouvaille
 * n'y figure plus, la trouvaille est scellée (`sealedAt`). Sinon elle reste
 * ouverte et l'état dit pourquoi.
 */

/** Lit un rapport Placard ; lève une erreur explicite s'il est illisible. */
export async function readReport(path: string): Promise<PlacardReport> {
  let raw: string;
  try {
    raw = await readFile(path, 'utf8');
  } catch {
    throw new Error(`Cannot read the analysis report at ${path}: re-run 'placard scan' first.`);
  }
  const parsed = safeParseReport(JSON.parse(raw) as unknown);
  if (!parsed.success) {
    throw new Error(
      `The analysis report at ${path} does not match the Placard schema: re-run 'placard scan'.`,
    );
  }
  return parsed.data;
}

/** La trouvaille est-elle encore présente dans ce rapport ? */
export function stillPresent(report: PlacardReport, finding: Finding): boolean {
  return report.findings.some(
    (candidate) =>
      candidate.fingerprint === finding.fingerprint ||
      (candidate.rule === finding.rule && candidate.preview === finding.preview),
  );
}

/** Scelle la trouvaille si la nouvelle analyse ne la retrouve plus. */
export async function verify(
  options: RitualOptions,
  finding: Finding,
  latestReportPath: string,
): Promise<RitualState> {
  const report = await readReport(latestReportPath);
  const existing = await loadState(options.placardDir, finding.fingerprint);
  const verifiedAt = new Date().toISOString();
  const stillFound = stillPresent(report, finding);
  const state: RitualState = {
    ...(existing ?? baseState(finding)),
    fingerprint: finding.fingerprint,
    findingId: finding.id,
    verify: { verifiedAt, reportPath: latestReportPath, stillFound },
  };
  if (stillFound) {
    delete state.sealedAt;
  } else {
    state.sealedAt = verifiedAt;
  }
  await saveState(options.placardDir, state);
  return state;
}
