import { buildViewModel, emptyFilter } from '@placard/manor-model';
import type { FindingFilter, ManorViewModel, PlacardReport } from '@placard/core';

import { NOW, makeFinding, makeReport, refOf } from './fixtures';

/**
 * Rapport de démonstration partagé par les tests d'interface : trois étages,
 * des portes, et des pans de mur obtenus en filtrant une trouvaille écartée.
 */

export const OLD = refOf('ui-old', '2021-04-02T10:00:00Z');
export const MID = refOf('ui-mid', '2023-02-11T08:30:00Z');
export const RECENT = refOf('ui-recent', '2024-03-05T10:00:00Z');
export const TODAY = refOf('ui-today', '2024-05-20T16:00:00Z');

/** Rapport de démonstration : aucune valeur de secret, seulement des aperçus masqués. */
export function demoReport(): PlacardReport {
  return makeReport(
    [
      makeFinding({
        id: 1,
        family: 'cloud-key',
        danger: 95,
        introduced: OLD,
        state: 'open',
        path: 'deploy/prod.env',
        fingerprintSeed: 'shared-secret',
        reasons: ['base cloud-key: +85', 'still present in HEAD: +15'],
      }),
      makeFinding({
        id: 2,
        family: 'identity',
        danger: 45,
        introduced: MID,
        state: 'ignored',
        inHead: false,
        path: 'fixtures/users.json',
        reasons: ['base identity: +30', 'test/example directory path: -30'],
      }),
      makeFinding({
        id: 3,
        family: 'risky-file',
        danger: 70,
        introduced: RECENT,
        state: 'sealed',
        path: 'secrets/id_rsa',
        reasons: ['base risky-file: +50', 'still present in HEAD: +15'],
      }),
      makeFinding({
        id: 4,
        family: 'bank-data',
        danger: 62,
        introduced: TODAY,
        state: 'open',
        path: 'notes/bank.txt',
        reasons: ['base bank-data: +70', 'public remote repository: +10'],
      }),
    ],
    { publicRemote: true, name: 'haunted-demo' },
  );
}

/** Modèle sans filtre : quatre portes sur trois étages. */
export function demoModel(filter: FindingFilter = emptyFilter()): ManorViewModel {
  return buildViewModel(demoReport(), filter, NOW);
}

/** Modèle filtré sur l'état « open » : deux portes restent, deux pans de mur apparaissent. */
export function openOnlyModel(): ManorViewModel {
  return demoModel({ severities: [], families: [], states: ['open'] });
}
