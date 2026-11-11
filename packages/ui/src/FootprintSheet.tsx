import React from 'react';
import type { FootprintTrail } from '@placard/core';
import { humanizeDays, plural } from '@placard/manor-model';

/**
 * Fiche des empreintes (PLA-F-17) : la durée de vie d'un secret, en texte.
 *
 * Le tracé SVG ne suffit pas : la même information doit être lisible sans voir
 * le dessin — durée, portes traversées, étages, rôle de chaque porte.
 */
export interface FootprintSheetProps {
  trail: FootprintTrail;
}

/** Rôle d'une porte dans la vie du secret, en clair. */
const ROLE_LABELS: Record<FootprintTrail['doors'][number]['role'], string> = {
  introduced: 'introduced here',
  present: 'still present here',
  removed: 'removed here',
};

/** Nombre d'étages distincts traversés par la trace. */
export function floorsSpanned(trail: FootprintTrail): number {
  return new Set(trail.doors.map((door) => door.year)).size;
}

/** Résumé textuel d'une trace : durée, portes, étages. */
export function trailSummary(trail: FootprintTrail): string {
  return `Lived ${humanizeDays(trail.lifetimeDays)} across ${plural(trail.doors.length, 'door')} on ${plural(
    floorsSpanned(trail),
    'floor',
  )}`;
}

/** La fiche des empreintes : résumé puis chaque porte, dans l'ordre chronologique. */
export function FootprintSheet({ trail }: FootprintSheetProps): React.ReactElement {
  return (
    <section className="placard-footprint-sheet" aria-label="Bone footprints">
      <h3>{trailSummary(trail)}</h3>
      <p className="placard-footprint-sheet__label">{trail.ariaLabel}</p>
      <ol className="placard-footprint-sheet__doors">
        {trail.doors.map((door) => (
          <li key={`${door.commit}-${door.role}`} data-role={door.role}>
            <code>{door.commit.slice(0, 7)}</code> — floor {door.year}: {ROLE_LABELS[door.role]}
          </li>
        ))}
      </ol>
    </section>
  );
}
