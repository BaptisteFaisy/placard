import { describe, expect, it } from 'vitest';

import { NOW, makeFinding, makeReport, refOf } from './fixtures.js';
import { buildViewModel, emptyFilter } from './index.js';
import type { Door, WallStretch } from '@placard/core';

const C1 = refOf('c1', '2021-02-01T10:00:00Z');
const C2 = refOf('c2', '2021-05-01T10:00:00Z');
const C3 = refOf('c3', '2024-01-10T10:00:00Z');
const C4 = refOf('c4', '2024-02-10T10:00:00Z');
const C5 = refOf('c5', '2024-03-10T10:00:00Z');
const C6 = refOf('c6', '2024-04-10T10:00:00Z');
const C7 = refOf('c7', '2024-05-10T10:00:00Z');

/** Deux étages : 2021 (deux portes) et 2024 (cinq portes, trois discrètes). */
function hauntedReport() {
  return makeReport([
    makeFinding({ id: 1, introduced: C1, danger: 90 }),
    makeFinding({ id: 2, introduced: C2, danger: 20 }),
    makeFinding({ id: 3, introduced: C3, danger: 88 }),
    makeFinding({ id: 4, introduced: C4, danger: 30 }),
    makeFinding({ id: 5, introduced: C5, danger: 35 }),
    makeFinding({ id: 6, introduced: C6, danger: 10 }),
    makeFinding({ id: 7, introduced: C7, danger: 95 }),
  ]);
}

describe('étages (PLA-F-14)', () => {
  it('place un étage par année, du grenier au rez-de-chaussée', () => {
    const model = buildViewModel(hauntedReport(), emptyFilter(), NOW);
    expect(model.floors.map((floor) => floor.year)).toEqual([2021, 2024]);
    expect(model.floors[0]?.attic).toBe(true);
    expect(model.floors[1]?.attic).toBe(false);
    expect(model.floors[1]?.ground).toBe(true);
    expect(model.floors[0]?.ground).toBe(false);
  });

  it('donne une porte par commit contenant une trouvaille, dans l’ordre chronologique', () => {
    const model = buildViewModel(hauntedReport(), emptyFilter(), NOW);
    const doors2024 = (model.floors[1]?.items ?? []).filter((item): item is Door => item.kind === 'door');
    expect(doors2024.map((door) => door.commit)).toEqual([C3.commit, C4.commit, C5.commit, C6.commit, C7.commit]);
    const dates = doors2024.map((door) => Date.parse(door.date));
    expect([...dates].sort((a, b) => a - b)).toEqual(dates);
  });

  it('n’a aucun pan de mur quand aucune trouvaille n’est masquée', () => {
    const model = buildViewModel(hauntedReport(), emptyFilter(), NOW);
    expect(model.wallCount).toBe(0);
    expect(model.doorCount).toBe(7);
  });

  it('compresse une suite de N commits sans trouvaille retenue en un pan de N', () => {
    const filter = { ...emptyFilter(), severities: ['critical' as const] };
    const model = buildViewModel(hauntedReport(), filter, NOW);
    const items = model.floors[1]?.items ?? [];
    expect(items.map((item) => item.kind)).toEqual(['door', 'wall', 'door']);
    const wall = items[1] as WallStretch;
    expect(wall.commits).toBe(3);
    expect(wall.year).toBe(2024);
    expect(wall.fromCommit).toBe(C4.commit);
    expect(wall.toCommit).toBe(C6.commit);
    expect(model.doorCount).toBe(3);
    // Deux pans au total : les trois commits discrets de 2024, et le commit
    // de 2021 dont la seule trouvaille est masquée par le filtre.
    expect(model.wallCount).toBe(2);
    expect((model.floors[0]?.items[1] as WallStretch).commits).toBe(1);
  });

  it('laisse un étage vide de trouvailles debout, en un seul pan de mur', () => {
    const filter = { ...emptyFilter(), families: ['bank-data' as const] };
    const model = buildViewModel(hauntedReport(), filter, NOW);
    const attic = model.floors[0];
    expect(attic?.findings).toBe(0);
    expect(attic?.severity).toBe('none');
    expect(attic?.items).toHaveLength(1);
    expect((attic?.items[0] as WallStretch).commits).toBe(2);
    expect(model.findings).toEqual([]);
  });

  it('donne à chaque étage la gravité maximale de ses portes', () => {
    const model = buildViewModel(hauntedReport(), emptyFilter(), NOW);
    expect(model.floors[0]?.severity).toBe('critical');
    expect(model.floors[1]?.severity).toBe('critical');
    const atticDoor = model.floors[0]?.items[0] as Door;
    expect(atticDoor.severity).toBe('critical');
    expect(atticDoor.findings).toHaveLength(1);
  });

  it('reste fluide sur 500 portes, sans boucle imbriquée', () => {
    const findings = [];
    for (let index = 0; index < 500; index += 1) {
      const day = String((index % 28) + 1).padStart(2, '0');
      const month = String((index % 12) + 1).padStart(2, '0');
      findings.push(
        makeFinding({
          id: index + 1,
          introduced: refOf(`perf-${index}`, `2024-${month}-${day}T08:00:00Z`),
          danger: index % 100,
        }),
      );
    }
    const started = Date.now();
    const model = buildViewModel(makeReport(findings), emptyFilter(), NOW);
    expect(model.doorCount).toBe(500);
    expect(model.floors).toHaveLength(1);
    expect(Date.now() - started).toBeLessThan(2000);
  });
});
