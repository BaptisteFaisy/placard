import { describe, expect, it } from 'vitest';

import { NOW, makeFinding, makeReport, refOf } from './fixtures';
import { buildViewModel, emptyFilter } from './index';

const A = refOf('hall-a', '2022-02-01T10:00:00Z');
const B = refOf('hall-b', '2024-03-01T10:00:00Z');

describe('hall d’entrée (PLA-F-20)', () => {
  it('synthétise total, debout, gravités, familles, sceaux et rubans', () => {
    const report = makeReport(
      [
        makeFinding({ id: 1, introduced: A, danger: 95, family: 'cloud-key', inHead: true, state: 'open' }),
        makeFinding({ id: 2, introduced: A, danger: 70, family: 'bank-data', inHead: false, state: 'sealed' }),
        makeFinding({ id: 3, introduced: B, danger: 20, family: 'identity', inHead: true, state: 'ignored' }),
        makeFinding({ id: 4, introduced: B, danger: 45, family: 'cloud-key', inHead: false, state: 'rotated' }),
      ],
      { publicRemote: true },
    );
    const hall = buildViewModel(report, emptyFilter(), NOW).hall;
    expect(hall.total).toBe(4);
    expect(hall.standing).toBe(2);
    expect(hall.bySeverity).toEqual({ critical: 1, high: 1, medium: 1, low: 1 });
    expect(hall.byFamily['cloud-key']).toBe(2);
    expect(hall.byFamily['bank-data']).toBe(1);
    expect(hall.byFamily['risky-file']).toBe(0);
    expect(hall.sealed).toBe(1);
    expect(hall.dismissed).toBe(1);
    expect(hall.open).toBe(1);
    expect(hall.publicRemote).toBe(true);
  });

  it('suit le filtre : le hall ne compte que les trouvailles retenues', () => {
    const report = makeReport([
      makeFinding({ id: 1, introduced: A, danger: 95, inHead: true }),
      makeFinding({ id: 2, introduced: B, danger: 20, inHead: true }),
    ]);
    const hall = buildViewModel(report, { ...emptyFilter(), severities: ['critical'] }, NOW).hall;
    expect(hall.total).toBe(1);
    expect(hall.standing).toBe(1);
    expect(hall.bySeverity.critical).toBe(1);
  });

  it('rend un hall vide cohérent quand le filtre ne retient rien', () => {
    const report = makeReport([makeFinding({ id: 1, introduced: A })]);
    const hall = buildViewModel(report, { ...emptyFilter(), families: ['bank-data'] }, NOW).hall;
    expect(hall.total).toBe(0);
    expect(hall.standing).toBe(0);
    expect(hall.sealed).toBe(0);
    expect(hall.dismissed).toBe(0);
    expect(hall.open).toBe(0);
    expect(hall.publicRemote).toBe(false);
  });
});
