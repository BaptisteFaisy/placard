import { maxSeverity } from '@placard/core';
import type { CommitRef, Door, Finding, SeverityLevel } from '@placard/core';

import { ageInDays, yearOf } from './dates.js';
import { doorAriaLabel } from './labels.js';

/**
 * Les portes du manoir : un commit qui contient au moins une trouvaille (C.4).
 *
 * Une porte porte la gravité maximale de ce qu'elle cache (lueur sous la
 * porte), l'âge du commit (toiles d'araignée), le décompte des trouvailles
 * scellées et écartées, et un libellé accessible complet (PLA-F-21).
 */

/** Commits touchés par une trouvaille : introduction, retraits, emplacements. */
export function touchedCommits(finding: Finding): CommitRef[] {
  const refs = new Map<string, CommitRef>();
  const add = (ref: CommitRef): void => {
    if (ref.commit !== '' && !refs.has(ref.commit)) refs.set(ref.commit, ref);
  };
  add(finding.introduced);
  for (const removed of finding.removed) add(removed);
  for (const location of finding.locations) {
    // Un emplacement ne porte pas la date du commit : on retombe sur la date
    // d'introduction, sauf si le commit est déjà connu par un CommitRef daté.
    add({
      commit: location.commit,
      shortCommit: location.commit.slice(0, 7),
      date: finding.introduced.date,
    });
  }
  return [...refs.values()];
}

/** Gravité d'une porte : la plus grave de ses trouvailles (jamais `'none'`). */
export function doorSeverity(findings: readonly Finding[]): SeverityLevel {
  const level = maxSeverity(findings.map((finding) => finding.danger));
  return level === 'none' ? 'low' : level;
}

/** Compte les trouvailles dans un état donné (sceau de cire, ruban). */
export function countState(findings: readonly Finding[], state: Finding['state']): number {
  let total = 0;
  for (const finding of findings) if (finding.state === state) total += 1;
  return total;
}

/** Construit une porte à partir de son commit de référence et de ses trouvailles. */
export function buildDoor(ref: CommitRef, findings: Finding[], now: Date): Door {
  const severity = doorSeverity(findings);
  const sealed = countState(findings, 'sealed');
  const dismissed = countState(findings, 'ignored');
  const ageDays = ageInDays(ref.date, now);
  const shortCommit = ref.shortCommit === '' ? ref.commit.slice(0, 7) : ref.shortCommit;
  return {
    kind: 'door',
    commit: ref.commit,
    shortCommit,
    date: ref.date,
    year: yearOf(ref.date),
    severity,
    ageDays,
    findings,
    sealed,
    dismissed,
    ariaLabel: doorAriaLabel({
      shortCommit,
      date: ref.date,
      findings: findings.length,
      severity,
      ageDays,
      sealed,
      dismissed,
    }),
  };
}

/** Index commit → trouvailles, construit en une passe (pas de boucle imbriquée). */
export function indexByCommit(findings: readonly Finding[]): Map<string, Finding[]> {
  const index = new Map<string, Finding[]>();
  for (const finding of findings) {
    for (const ref of touchedCommits(finding)) {
      const bucket = index.get(ref.commit);
      if (bucket === undefined) index.set(ref.commit, [finding]);
      else if (!bucket.includes(finding)) bucket.push(finding);
    }
  }
  return index;
}
