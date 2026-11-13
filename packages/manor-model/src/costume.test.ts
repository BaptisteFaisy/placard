import { FAMILY_TO_SKELETON } from '@placard/core';
import { describe, expect, it } from 'vitest';

import { NOW, makeFinding, makeReport, refOf } from './fixtures';
import { buildViewModel, emptyFilter } from './index';
import type { Door, WallStretch } from '@placard/core';

const OLD = refOf('costume-old', '2021-04-02T10:00:00Z');
const NEW = refOf('costume-new', '2024-03-05T10:00:00Z');

/**
 * Preuve de la table C.4 (steering `costume-mapping.md`) : chaque élément du
 * décor doit être calculable depuis le modèle, sans que le rendu ait à
 * reconstruire une donnée (PLA-F-15).
 */
describe('correspondance costume ↔ données (PLA-F-15)', () => {
  const report = makeReport(
    [
      makeFinding({ id: 1, introduced: OLD, danger: 92, family: 'private-key', state: 'sealed' }),
      makeFinding({ id: 2, introduced: NEW, danger: 30, family: 'identity', state: 'ignored', inHead: false }),
      makeFinding({ id: 3, introduced: NEW, danger: 55, family: 'risky-file', state: 'open', inHead: true }),
    ],
    { publicRemote: true },
  );

  it('code chaque ligne du décor depuis le modèle', () => {
    const model = buildViewModel(report, emptyFilter(), NOW);
    // Un étage = une année ; grenier = la plus ancienne.
    expect(model.floors.map((floor) => floor.year)).toEqual([2021, 2024]);
    expect(model.floors[0]?.attic).toBe(true);
    expect(model.floors.at(-1)?.ground).toBe(true);

    const doors = model.floors.flatMap((floor) =>
      floor.items.filter((item): item is Door => item.kind === 'door'),
    );
    // Une porte = un commit qui contient au moins une trouvaille.
    expect(doors.map((door) => door.commit)).toEqual([OLD.commit, NEW.commit]);
    // Un pan de mur porterait le nombre de commits compressés.
    const walls = model.floors.flatMap((floor) =>
      floor.items.filter((item): item is WallStretch => item.kind === 'wall'),
    );
    expect(walls.every((wall) => wall.commits > 0)).toBe(true);

    // Lueur sous la porte = gravité maximale derrière la porte.
    expect(doors[0]?.severity).toBe('critical');
    expect(doors[1]?.severity).toBe('medium');
    // Toiles d'araignée = âge du commit en jours.
    expect(doors[0]?.ageDays).toBeGreaterThan(doors[1]?.ageDays ?? 0);

    // Squelette et taille : la famille donne le type, le score donne la taille.
    const first = doors[0]?.findings[0];
    expect(FAMILY_TO_SKELETON['private-key']).toBe('key-bearer');
    expect(first?.family).toBe('private-key');
    expect(first?.danger).toBe(92);

    // Sceau de cire = traitée ; ruban = écartée.
    expect(doors[0]?.sealed).toBe(1);
    expect(doors[1]?.dismissed).toBe(1);
    // Squelette debout dans le hall = encore présent dans HEAD.
    expect(model.hall.standing).toBe(2);
    // Fenêtre ouverte = dépôt distant public.
    expect(model.hall.publicRemote).toBe(true);
  });

  it('expose les mêmes trouvailles au manoir et au registre, décor compris', () => {
    const model = buildViewModel(report, { ...emptyFilter(), inHead: true }, NOW);
    const doorFindings = model.floors.flatMap((floor) =>
      floor.items.flatMap((item) => (item.kind === 'door' ? item.findings : [])),
    );
    expect(doorFindings.map((finding) => finding.id).sort()).toEqual(
      model.findings.map((finding) => finding.id).sort(),
    );
  });
});
