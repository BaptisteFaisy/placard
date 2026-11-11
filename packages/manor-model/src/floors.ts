import { maxSeverity } from '@placard/core';
import type { CommitRef, CorridorItem, Door, Finding, Floor, PlacardReport, WallStretch } from '@placard/core';

import { timeOf, yearOf } from './dates.js';
import { buildDoor, indexByCommit, touchedCommits } from './doors.js';
import { plural } from './labels.js';

/**
 * Les couloirs du manoir (PLA-F-14).
 *
 * - **Un étage par année** : grenier = année la plus ancienne (index 0),
 *   rez-de-chaussée = année en cours.
 * - **Une porte par commit qui contient au moins une trouvaille**, dans l'ordre
 *   chronologique, de gauche à droite.
 * - **Un pan de mur** compresse une suite de commits qui ne cachent aucune
 *   trouvaille retenue : le pan porte leur nombre (`WallStretch.commits`).
 *
 * Le rapport n'énumère pas les commits sans trouvaille (il ne contient que les
 * trouvailles) : la chronologie connue est donc l'ensemble des commits cités
 * par le rapport — introduction, retraits, emplacements. Un commit de cette
 * chronologie qui ne porte aucune trouvaille *retenue par le filtre* devient un
 * pan de mur : le couloir reste la vraie histoire du dépôt, et le filtre se lit
 * comme « ce commit ne cache rien qui vous concerne ».
 */

/** Références de commits connues du rapport, triées chronologiquement. */
export function buildTimeline(report: PlacardReport): CommitRef[] {
  const refs = new Map<string, CommitRef>();
  for (const finding of report.findings) {
    for (const ref of touchedCommits(finding)) {
      if (!refs.has(ref.commit)) refs.set(ref.commit, ref);
    }
  }
  return [...refs.values()].sort(compareRefs);
}

/** Ordre chronologique ; à date égale, ordre des SHA pour rester déterministe. */
function compareRefs(a: CommitRef, b: CommitRef): number {
  const delta = timeOf(a.date) - timeOf(b.date);
  return delta !== 0 ? delta : a.commit.localeCompare(b.commit);
}

/** Groupe des références déjà triées par année, en conservant l'ordre. */
export function groupByYear(refs: readonly CommitRef[]): Map<number, CommitRef[]> {
  const byYear = new Map<number, CommitRef[]>();
  for (const ref of refs) {
    const year = yearOf(ref.date);
    const bucket = byYear.get(year);
    if (bucket === undefined) byYear.set(year, [ref]);
    else bucket.push(ref);
  }
  return byYear;
}

/** Pan de mur compressant une suite de commits sans trouvaille retenue. */
function buildWall(run: readonly CommitRef[], year: number): WallStretch {
  const first = run[0];
  const last = run[run.length - 1];
  return {
    kind: 'wall',
    commits: run.length,
    year,
    fromCommit: first === undefined ? '' : first.commit,
    toCommit: last === undefined ? '' : last.commit,
  };
}

/** Couloir d'un étage : portes dans l'ordre chronologique, murs compressés. */
export function buildCorridor(
  refs: readonly CommitRef[],
  byCommit: ReadonlyMap<string, Finding[]>,
  year: number,
  now: Date,
): CorridorItem[] {
  const items: CorridorItem[] = [];
  let run: CommitRef[] = [];
  for (const ref of refs) {
    const findings = byCommit.get(ref.commit) ?? [];
    if (findings.length === 0) {
      run.push(ref);
      continue;
    }
    if (run.length > 0) {
      items.push(buildWall(run, year));
      run = [];
    }
    items.push(buildDoor(ref, findings, now));
  }
  if (run.length > 0) items.push(buildWall(run, year));
  return items;
}

/** Trouvailles d'un étage : celles de ses portes (une trouvaille peut hanter plusieurs étages). */
function floorFindings(items: readonly CorridorItem[]): Finding[] {
  const findings: Finding[] = [];
  for (const item of items) if (item.kind === 'door') findings.push(...item.findings);
  return findings;
}

/** Année du rez-de-chaussée : l'année en cours si elle figure dans l'histoire, sinon la plus récente. */
function groundYear(years: readonly number[], now: Date): number {
  const current = yearOf(now.toISOString());
  if (years.includes(current)) return current;
  return years[years.length - 1] ?? current;
}

/** Un étage = une année d'historique. */
function buildFloor(
  year: number,
  refs: readonly CommitRef[],
  byCommit: ReadonlyMap<string, Finding[]>,
  now: Date,
  ground: number,
  attic: boolean,
): Floor {
  const items = buildCorridor(refs, byCommit, year, now);
  const findings = floorFindings(items);
  return {
    year,
    attic,
    ground: year === ground,
    items,
    findings: findings.length,
    severity: maxSeverity(findings.map((finding) => finding.danger)),
  };
}

/** Tous les étages, du grenier (index 0) au rez-de-chaussée. */
export function buildFloors(report: PlacardReport, findings: readonly Finding[], now: Date): Floor[] {
  const byCommit = indexByCommit(findings);
  const byYear = groupByYear(buildTimeline(report));
  const years = [...byYear.keys()].sort((a, b) => a - b);
  const ground = groundYear(years, now);
  return years.map((year, index) =>
    buildFloor(year, byYear.get(year) ?? [], byCommit, now, ground, index === 0),
  );
}

/** Compte les portes et les pans de mur d'un ensemble d'étages, en une passe. */
export function countItems(floors: readonly Floor[]): { doors: number; walls: number } {
  let doors = 0;
  let walls = 0;
  for (const floor of floors) {
    for (const item of floor.items) {
      if (item.kind === 'door') doors += 1;
      else walls += 1;
    }
  }
  return { doors, walls };
}

/** Libellé de légende d'un étage : « Floor 2024, 3 doors, 12 commits behind walls ». */
export function floorLabel(floor: Floor): string {
  let doors = 0;
  let wallCommits = 0;
  for (const item of floor.items) {
    if (item.kind === 'door') doors += 1;
    else wallCommits += item.commits;
  }
  const parts = [`Floor ${floor.year}`, plural(doors, 'door')];
  if (wallCommits > 0) parts.push(`${plural(wallCommits, 'commit')} behind walls`);
  return parts.join(', ');
}

/** Type garde utile aux consommateurs du modèle. */
export function isDoor(item: CorridorItem): item is Door {
  return item.kind === 'door';
}
