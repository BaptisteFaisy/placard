import {
  REPORT_SCHEMA_VERSION,
  parseReport,
  redactPreview,
  type AnalysisProgress,
  type CommitEvent,
  type CommitRef,
  type Finding,
  type IgnoreFileEntry,
  type IgnoreMap,
  type PlacardReport,
  type RepoMeta,
  type SkippedFiles,
} from '@placard/core';

import { buildSnippet } from './context';
import { locationsOf, type DetectionGroup } from './group';
import { assignFindingIds } from './ids';
import { resolveLifetime, type HeadPresence } from './lifetime';
import { scoreGroup } from './score';

/**
 * Assemblage du rapport (PLA-F-05 à PLA-F-09, PLA-F-08).
 *
 * Le rapport ne contient **aucune valeur détectée** : uniquement l'aperçu
 * masqué, l'empreinte HMAC et des extraits caviardés. Il est validé par le
 * schéma Zod de `@placard/core` avant d'être rendu, ce qui garantit qu'aucun
 * champ inattendu — donc aucun secret — ne peut s'y glisser.
 */

/** Tout ce qu'il faut pour transformer des groupes en rapport. */
export interface ReportContext {
  /** Sel du dépôt, pour l'empreinte HMAC des aperçus. */
  salt: string;
  presence: HeadPresence;
  ignore: IgnoreMap;
  repoMeta: RepoMeta;
  skipped: SkippedFiles;
  toolVersion: string;
  onProgress?: (progress: AnalysisProgress) => void;
}

/** Référence de commit telle qu'elle apparaît dans le rapport. */
export function toCommitRef(event: CommitEvent): CommitRef {
  const commit = event.commit.slice(0, 64);
  const short = (event.shortCommit || commit).slice(0, 12);
  const ref: CommitRef = {
    commit,
    shortCommit: short.length >= 4 ? short : commit.slice(0, 7),
    date: event.date,
    author: event.author,
    message: event.subject,
  };
  return ref;
}

/**
 * Raison d'exclusion lisible. `Finding` ne porte pas de champ auteur/date
 * dédié : ils sont donc repliés dans la raison, en anglais.
 */
export function describeIgnore(entry: IgnoreFileEntry): string {
  const when = entry.date.trim().length > 0 ? ` on ${entry.date}` : '';
  return `${entry.reason} (ignored by ${entry.author}${when})`;
}

/** Construit une trouvaille à partir d'un groupe, sans jamais copier la valeur. */
export function buildFinding(group: DetectionGroup, id: string, context: ReportContext): Finding {
  const lifetime = resolveLifetime(group.detections, context.presence);
  const score = scoreGroup(group, {
    publicRemote: context.repoMeta.publicRemote,
    inHead: lifetime.inHead,
  });
  const ignored = context.ignore.get(group.fingerprint);

  const finding: Finding = {
    id,
    family: group.family,
    rule: group.rule,
    fingerprint: group.fingerprint,
    preview: redactPreview(group.value, group.family),
    danger: Math.max(0, Math.min(100, Math.round(score.score))),
    reasons: [...score.reasons],
    inHead: lifetime.inHead,
    introduced: toCommitRef(lifetime.introduced),
    removed: lifetime.removed.map(toCommitRef),
    locations: locationsOf(group, (detection) =>
      buildSnippet(detection.context, group.value, group.family),
    ),
    state: ignored === undefined ? 'open' : 'ignored',
  };
  if (ignored !== undefined) finding.ignoreReason = describeIgnore(ignored);
  return finding;
}

/** Construit toutes les trouvailles, identifiants stables compris. */
export function buildFindings(
  groups: readonly DetectionGroup[],
  context: ReportContext,
): Finding[] {
  const ids = assignFindingIds(groups.map((group) => group.fingerprint));
  const findings: Finding[] = [];
  groups.forEach((group, index) => {
    const id = ids.get(group.fingerprint);
    if (id === undefined) throw new Error('buildFindings: missing finding id');
    findings.push(buildFinding(group, id, context));
    context.onProgress?.({ kind: 'scoring', done: index + 1, total: groups.length });
  });
  return findings;
}

/** Assemble le rapport complet et le valide par le schéma de `@placard/core`. */
export function assembleReport(
  groups: readonly DetectionGroup[],
  context: ReportContext,
): PlacardReport {
  const findings = buildFindings(groups, context);
  return parseReport({
    schema: REPORT_SCHEMA_VERSION,
    tool: { name: 'placard', version: context.toolVersion },
    repo: context.repoMeta,
    findings,
    skipped: context.skipped,
  });
}
