import type {
  AnalysisApi,
  AnalysisEngine,
  AnalysisInput,
  AnalyzeOptions,
  AnalysisResult,
  AnchoredDetection,
} from '@placard/core';

import { groupDetections } from './group';
import { appendIgnoreEntry, loadIgnoreFile } from './ignore-file';
import { makePresence } from './lifetime';
import { assembleReport, type ReportContext } from './report';

/**
 * Moteur d'analyse (`@placard/analysis`).
 *
 * Chaîne : regroupement par empreinte (PLA-F-06) → durée de vie (PLA-F-05) →
 * score explicable (PLA-F-07) → exclusions (PLA-F-09) → rapport sans secret
 * (PLA-F-08). Toutes les décisions sont déterministes : mêmes détections,
 * même rapport (PLA-P-05).
 */

/** Nombre de commits distincts portant au moins une détection. */
export function countCommits(detections: readonly AnchoredDetection[]): number {
  return new Set(detections.map((detection) => detection.commit.commit)).size;
}

/** Analyse complète : entrée brute du lecteur + détecteurs → rapport. */
async function analyze(input: AnalysisInput, options: AnalyzeOptions): Promise<AnalysisResult> {
  const startedAt = Date.now();
  const ignore = await loadIgnoreFile(options.ignoreFile);

  const rawDetections = input.detections.length;
  options.onProgress?.({
    kind: 'scanning',
    commits: countCommits(input.detections),
    lines: rawDetections,
    findings: rawDetections,
  });

  const groups = groupDetections(input.detections, options.salt);
  options.onProgress?.({ kind: 'grouping', groups: groups.length });

  const context: ReportContext = {
    salt: options.salt,
    presence: makePresence(input.headPresence),
    ignore,
    repoMeta: input.repoMeta,
    skipped: input.skipped,
    toolVersion: options.toolVersion,
    onProgress: options.onProgress,
  };
  const report = assembleReport(groups, context);
  options.onProgress?.({ kind: 'report', findings: report.findings.length });

  return {
    report,
    rawDetections,
    groups: groups.length,
    durationMs: Date.now() - startedAt,
  };
}

/** Construit un moteur d'analyse vierge (aucun état partagé entre analyses). */
export function createAnalysisEngine(): AnalysisEngine {
  return { analyze };
}

/** L'API du paquet, conforme au contrat `AnalysisApi` de `@placard/core`. */
export const analysisApi: AnalysisApi = { analyze, loadIgnoreFile, appendIgnoreEntry };

export { analyze, appendIgnoreEntry, loadIgnoreFile };
export { assignFindingIds, formatFindingId, FINDING_ID_PREFIX } from './ids';
export { buildSnippet, sanitizeContext, MAX_SNIPPET_CHARS, MAX_SNIPPET_LINES } from './context';
export {
  compareDetections,
  fingerprintOf,
  groupDetections,
  locationsOf,
  sortDetections,
  type DetectionGroup,
} from './group';
export {
  daysBetween,
  lastSightingPerPath,
  makePresence,
  resolveLifetime,
  type HeadPresence,
  type Lifetime,
} from './lifetime';
export { isDummyGroup, isTestOnlyGroup, scoreGroup, type ScoreContext } from './score';
export {
  IgnoreFileError,
  parseIgnoreText,
} from './ignore-file';
export {
  assembleReport,
  buildFinding,
  buildFindings,
  describeIgnore,
  toCommitRef,
  type ReportContext,
} from './report';
