import { describe, expect, it } from 'vitest';

import { NOW, makeFinding, makeReport, refOf } from './fixtures.js';
import { buildViewModel, emptyFilter, footprints } from './index.js';

const BIRTH = refOf('fp-birth', '2021-03-11T10:00:00Z');
const MID_2021 = refOf('fp-mid21', '2021-11-02T10:00:00Z');
const MID_2024 = refOf('fp-mid24', '2024-02-14T10:00:00Z');
const DEATH = refOf('fp-death', '2024-05-20T10:00:00Z');

/** Le même secret (même empreinte) : introduit en 2021, présent, retiré en 2024. */
function longLivedFinding() {
  return makeFinding({
    id: 1,
    introduced: BIRTH,
    presentAt: [MID_2021, MID_2024],
    removed: [DEATH],
    fingerprintSeed: 'same-secret',
    danger: 88,
  });
}

describe('empreintes de pas (PLA-F-17)', () => {
  it('relie toutes les portes du secret, dans l’ordre chronologique', () => {
    const finding = longLivedFinding();
    const trail = footprints(makeReport([finding]), finding);
    expect(trail.doors.map((door) => door.commit)).toEqual([
      BIRTH.commit,
      MID_2021.commit,
      MID_2024.commit,
      DEATH.commit,
    ]);
    expect(trail.doors.map((door) => door.role)).toEqual(['introduced', 'present', 'present', 'removed']);
    expect(trail.fingerprint).toBe(finding.fingerprint);
  });

  it('mesure la durée de vie en jours, du premier au dernier commit', () => {
    const finding = longLivedFinding();
    const trail = footprints(makeReport([finding]), finding);
    expect(trail.lifetimeDays).toBe(1166);
  });

  it('compte les étages traversés et le dit dans un libellé accessible', () => {
    const finding = longLivedFinding();
    const trail = footprints(makeReport([finding]), finding);
    const years = new Set(trail.doors.map((door) => door.year));
    expect([...years].sort()).toEqual([2021, 2024]);
    expect(trail.ariaLabel).toContain('lived 3 years 2 months');
    expect(trail.ariaLabel).toContain('across 4 doors');
    expect(trail.ariaLabel).toContain('on 2 floors');
  });

  it('relie deux trouvailles de même empreinte en une seule trace', () => {
    const first = makeFinding({ id: 1, introduced: BIRTH, fingerprintSeed: 'same-secret', removed: [MID_2021] });
    const second = makeFinding({
      id: 2,
      introduced: MID_2024,
      fingerprintSeed: 'same-secret',
      removed: [DEATH],
    });
    const trail = footprints(makeReport([first, second]), second);
    expect(trail.doors.map((door) => door.commit)).toEqual([
      BIRTH.commit,
      MID_2021.commit,
      MID_2024.commit,
      DEATH.commit,
    ]);
    expect(trail.doors.filter((door) => door.role === 'introduced')).toHaveLength(2);
  });

  it('donne une trace courte à un secret qui n’a vécu qu’un commit', () => {
    const finding = makeFinding({ id: 3, introduced: MID_2024 });
    const trail = footprints(makeReport([finding]), finding);
    expect(trail.doors).toHaveLength(1);
    expect(trail.doors[0]?.role).toBe('introduced');
    expect(trail.lifetimeDays).toBe(0);
    expect(trail.ariaLabel).toContain('on 1 floor');
  });

  it('reste cohérent avec le modèle : les portes de la trace existent dans le manoir', () => {
    const finding = longLivedFinding();
    const report = makeReport([finding]);
    const model = buildViewModel(report, emptyFilter(), NOW);
    const doorCommits = new Set(
      model.floors.flatMap((floor) =>
        floor.items.filter((item) => item.kind === 'door').map((item) => item.commit),
      ),
    );
    for (const door of footprints(report, finding).doors) expect(doorCommits.has(door.commit)).toBe(true);
  });
});
