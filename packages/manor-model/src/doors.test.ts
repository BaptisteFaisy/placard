import { describe, expect, it } from 'vitest';

import { NOW, makeFinding, makeReport, refOf } from './fixtures';
import { buildDoor, doorSeverity, emptyFilter, indexByCommit, touchedCommits } from './index';
import { buildViewModel } from './index';
import type { Door } from '@placard/core';

const OLD = refOf('old', '2021-03-11T10:00:00Z');
const MID = refOf('mid', '2024-01-10T10:00:00Z');

describe('portes (PLA-F-15, PLA-F-21)', () => {
  it('calcule la gravité d’une porte sur sa trouvaille la plus grave', () => {
    const findings = [
      makeFinding({ id: 1, introduced: MID, danger: 10 }),
      makeFinding({ id: 2, introduced: MID, danger: 92 }),
      makeFinding({ id: 3, introduced: MID, danger: 70 }),
    ];
    expect(doorSeverity(findings)).toBe('critical');
    const door = buildDoor(MID, findings, NOW);
    expect(door.severity).toBe('critical');
    expect(door.findings).toHaveLength(3);
  });

  it('mesure l’âge du commit en jours, jamais négatif', () => {
    const door = buildDoor(OLD, [makeFinding({ id: 1, introduced: OLD, danger: 90 })], NOW);
    // Du 11 mars 2021 à 10 h au 1er juin 2024 à 0 h : 1177 jours entiers.
    expect(door.ageDays).toBe(1177);
    const future = buildDoor(
      refOf('future', '2030-01-01T00:00:00Z'),
      [makeFinding({ id: 2, introduced: refOf('future', '2030-01-01T00:00:00Z') })],
      NOW,
    );
    expect(future.ageDays).toBe(0);
  });

  it('compte les sceaux de cire et les rubans de la porte', () => {
    const findings = [
      makeFinding({ id: 1, introduced: MID, state: 'sealed' }),
      makeFinding({ id: 2, introduced: MID, state: 'sealed' }),
      makeFinding({ id: 3, introduced: MID, state: 'ignored' }),
      makeFinding({ id: 4, introduced: MID, state: 'open' }),
    ];
    const door = buildDoor(MID, findings, NOW);
    expect(door.sealed).toBe(2);
    expect(door.dismissed).toBe(1);
  });

  it('donne à chaque porte un libellé accessible complet et textuel', () => {
    const finding = makeFinding({ id: 1, introduced: OLD, danger: 90 });
    const model = buildViewModel(makeReport([finding]), emptyFilter(), NOW);
    const door = model.floors[0]?.items[0] as Door;
    expect(door.ariaLabel.length).toBeGreaterThan(20);
    expect(door.ariaLabel).toContain(`Door: commit ${OLD.commit.slice(0, 7)}`);
    expect(door.ariaLabel).toContain('11 March 2021');
    expect(door.ariaLabel).toContain('1 finding');
    expect(door.ariaLabel).toContain('highest severity critical');
    expect(door.ariaLabel).toContain('3 years 3 months old');
    // Le libellé ne porte jamais une valeur : l'aperçu reste caviardé.
    expect(door.ariaLabel).not.toContain('[REDACTED:cloud-key](24), Door');
  });

  it('relie une trouvaille à tous ses commits : introduction, retraits, emplacements', () => {
    const removed = refOf('removed', '2024-02-10T10:00:00Z');
    const present = refOf('present', '2024-01-20T10:00:00Z');
    const finding = makeFinding({ id: 1, introduced: OLD, removed: [removed], presentAt: [present] });
    const commits = touchedCommits(finding).map((ref) => ref.commit);
    expect(commits).toEqual([OLD.commit, removed.commit, present.commit]);
    const index = indexByCommit([finding]);
    expect([...index.keys()].sort()).toEqual([OLD.commit, removed.commit, present.commit].sort());
    expect(index.get(present.commit)).toHaveLength(1);
  });
});
