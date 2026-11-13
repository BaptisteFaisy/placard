import type { CommitRef, Finding, FootprintTrail, PlacardReport } from '@placard/core';

import { daysBetween, timeOf, yearOf } from './dates';
import { footprintAriaLabel } from './labels';

/**
 * Empreintes de pas osseuses (PLA-F-17, C.4).
 *
 * Une trace relie **toutes** les portes où le même secret est présent — même
 * empreinte HMAC, donc même valeur d'origine — de la porte d'introduction à la
 * dernière porte de retrait. Elle porte le rôle de chaque porte, la durée de
 * vie en jours et un libellé accessible du type
 * « lived 14 months across 11 doors on 2 floors ».
 *
 * Le rapport date les introductions et les retraits, mais pas les emplacements
 * (`locations`) : un commit connu seulement par un emplacement est placé juste
 * après l'introduction, dans l'ordre où le rapport le cite, c'est-à-dire dans
 * l'ordre de parcours de l'historique produit par le moteur d'analyse.
 */

type FootprintRole = FootprintTrail['doors'][number]['role'];

/** Tri chronologique stable : à date égale, l'ordre d'insertion est conservé. */
function byDate(a: CommitRef, b: CommitRef): number {
  return timeOf(a.date) - timeOf(b.date);
}

/** Rôle d'une porte dans la vie du secret. */
function roleOf(
  commit: string,
  introduced: ReadonlySet<string>,
  removed: ReadonlySet<string>,
): FootprintRole {
  if (introduced.has(commit)) return 'introduced';
  if (removed.has(commit)) return 'removed';
  return 'present';
}

/** Toutes les trouvailles qui partagent l'empreinte du secret sélectionné. */
function sameSecret(report: PlacardReport, finding: Finding): Finding[] {
  const twins = report.findings.filter((other) => other.fingerprint === finding.fingerprint);
  return twins.length > 0 ? twins : [finding];
}

/** Emplacements cités par le rapport, sans date propre : proxy = date d'introduction. */
function presentRefs(group: readonly Finding[]): CommitRef[] {
  const refs: CommitRef[] = [];
  for (const finding of group) {
    for (const location of finding.locations) {
      refs.push({
        commit: location.commit,
        shortCommit: location.commit.slice(0, 7),
        date: finding.introduced.date,
      });
    }
  }
  return refs;
}

/**
 * Commits du secret dans l'ordre de sa vie : les références datées par le
 * rapport d'abord (introductions et retraits, qui priment sur le proxy), puis
 * les emplacements sans date. Le tri final est stable.
 */
function secretCommits(group: readonly Finding[]): CommitRef[] {
  const refs = new Map<string, CommitRef>();
  const dated = [...group.map((finding) => finding.introduced), ...group.flatMap((f) => f.removed)];
  for (const ref of [...dated, ...presentRefs(group)]) {
    if (!refs.has(ref.commit)) refs.set(ref.commit, ref);
  }
  return [...refs.values()].sort(byDate);
}

/** Date de fin de vie : dernier retrait connu, sinon dernière porte connue. */
function endOfLife(group: readonly Finding[], refs: readonly CommitRef[], report: PlacardReport): string {
  let latest = '';
  for (const finding of group) {
    for (const removed of finding.removed) {
      if (latest === '' || timeOf(removed.date) > timeOf(latest)) latest = removed.date;
    }
  }
  if (latest !== '') return latest;
  const last = refs[refs.length - 1];
  return last === undefined ? report.repo.analyzedAt : last.date;
}

/** Construit la trace d'empreintes d'une trouvaille sélectionnée. */
export function footprints(report: PlacardReport, finding: Finding): FootprintTrail {
  const group = sameSecret(report, finding);
  const refs = secretCommits(group);
  const introduced = new Set(group.map((other) => other.introduced.commit));
  const removed = new Set(group.flatMap((other) => other.removed.map((ref) => ref.commit)));
  const doors = refs.map((ref) => ({
    commit: ref.commit,
    year: yearOf(ref.date),
    role: roleOf(ref.commit, introduced, removed),
  }));
  const start = refs[0];
  const lifetimeDays = start === undefined ? 0 : daysBetween(start.date, endOfLife(group, refs, report));
  const floors = new Set(doors.map((door) => door.year)).size;
  return {
    fingerprint: finding.fingerprint,
    doors,
    lifetimeDays,
    ariaLabel: footprintAriaLabel({
      family: finding.family,
      preview: finding.preview,
      lifetimeDays,
      doors: doors.length,
      floors,
    }),
  };
}
