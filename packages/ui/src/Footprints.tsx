import React from 'react';
import type { FootprintTrail } from '@placard/core';

import { DOOR_WIDTH, FLOOR_BASELINE, type DoorSlot, type ManorLayout } from './manor/layout';

/**
 * Empreintes de pas osseuses (C.4, PLA-F-17) : la durée de vie d'un même
 * secret, de la porte d'introduction aux portes de retrait — y compris quand
 * la trace traverse plusieurs étages.
 *
 * Le tracé est déduit du plan du manoir : chaque porte de la trace est placée
 * par `layout`, aucune coordonnée n'est inventée. Une porte absente du plan
 * (filtrée) est simplement ignorée : les empreintes ne mentent jamais sur ce
 * qui est affiché.
 */

export interface FootprintsProps {
  layout: ManorLayout;
  trail: FootprintTrail | null;
}

/** Position du bas d'une porte : le point de départ de l'empreinte. */
export function footPoint(slot: DoorSlot): { x: number; y: number } {
  return { x: slot.x + DOOR_WIDTH / 2, y: slot.y + FLOOR_BASELINE + 4 };
}

/** Points de la trace, dans l'ordre chronologique du modèle. */
export function trailPoints(layout: ManorLayout, trail: FootprintTrail | null): { x: number; y: number }[] {
  if (trail === null) return [];
  const points: { x: number; y: number }[] = [];
  for (const door of trail.doors) {
    const slot = layout.byCommit.get(door.commit);
    if (slot !== undefined) points.push(footPoint(slot));
  }
  return points;
}

/** Tracé en escalier : horizontal sur le couloir, vertical entre les étages. */
export function trailPath(points: readonly { x: number; y: number }[]): string {
  const first = points[0];
  if (first === undefined) return '';
  const segments = [`M${first.x} ${first.y}`];
  let previous = first;
  for (const point of points.slice(1)) {
    segments.push(`L${point.x} ${previous.y}`, `L${point.x} ${point.y}`);
    previous = point;
  }
  return segments.join(' ');
}

/** Empreinte isolée : un petit os, doublure textuelle de la couleur. */
function FootMark({ x, y, role }: { x: number; y: number; role: string }): React.ReactElement {
  return (
    <g className={`placard-footprint placard-footprint--${role}`} transform={`translate(${x} ${y})`}>
      <ellipse cx="0" cy="0" rx="3.4" ry="2.2" fill="#EDE6D6" opacity="0.9" />
      <ellipse cx="0" cy="-3.4" rx="2.2" ry="1.6" fill="#EDE6D6" opacity="0.7" />
    </g>
  );
}

/** Les empreintes d'un secret sélectionné, ou rien. */
export function Footprints({ layout, trail }: FootprintsProps): React.ReactElement | null {
  if (trail === null || trail.doors.length === 0) return null;
  const points = trailPoints(layout, trail);
  if (points.length === 0) return null;
  return (
    <g className="placard-footprints" role="img" aria-label={trail.ariaLabel} data-fingerprint={trail.fingerprint}>
      <path className="placard-footprints__trail" d={trailPath(points)} />
      {trail.doors.map((door, index) => {
        const point = points[index];
        if (point === undefined) return null;
        return <FootMark key={`${door.commit}-${door.role}`} x={point.x} y={point.y} role={door.role} />;
      })}
    </g>
  );
}
