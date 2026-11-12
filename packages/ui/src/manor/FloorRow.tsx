import React from 'react';
import type { Door } from '@placard/core';
import { floorLabel } from '@placard/manor-model';

import { Staircase } from '../illustrations/Staircase';
import { DoorNode } from './DoorNode';
import { WallNode } from './WallNode';
import { CORRIDOR_START, FLOOR_BASELINE, FLOOR_HEIGHT, STAIR_WIDTH, type FloorLayout } from './layout';

/**
 * Un étage du manoir : une année d'historique (C.4).
 *
 * Le grenier (étage 0) est l'année la plus ancienne, le rez-de-chaussée la plus
 * récente. Le couloir va de gauche à droite dans l'ordre chronologique des
 * commits ; l'escalier, à gauche, matérialise le passage d'une année à l'autre.
 */

/** Abscisse de l'escalier, alignée sur la marge du couloir. */
const STAIR_LEFT = 10;

export interface FloorRowProps {
  layout: FloorLayout;
  /** Index global de la porte qui porte le focus logique. */
  activeIndex: number;
  /** Commit de la porte ouverte, s'il y a une fiche. */
  openedCommit?: string;
  /** Index global de la première porte de l'étage. */
  firstDoorIndex: number;
  onOpen: (door: Door, index: number) => void;
  onActivate: (index: number) => void;
  onKeyDown: (event: React.KeyboardEvent<SVGGElement>, index: number) => void;
  registerRef: (commit: string, node: SVGGElement | null) => void;
}

/** Bandeau de l'étage : année et position dans la maison. */
function FloorHeading({ layout }: { layout: FloorLayout }): React.ReactElement {
  const { floor } = layout;
  const position = floor.attic ? 'attic' : floor.ground ? 'ground floor' : 'upper floor';
  return (
    <g className="placard-floor__heading" aria-hidden="true">
      <text x={STAIR_LEFT} y={layout.y + 16} className="placard-floor__year">
        {floor.year}
      </text>
      <text x={STAIR_LEFT} y={layout.y + 28} className="placard-floor__position">
        {position}
      </text>
    </g>
  );
}

/** Sol du couloir : la ligne sur laquelle les portes se dressent. */
function FloorBoard({ layout }: { layout: FloorLayout }): React.ReactElement {
  const width = Math.max(layout.width, CORRIDOR_START + 8);
  return (
    <line
      className="placard-floor__ground"
      x1={STAIR_LEFT + STAIR_WIDTH - 8}
      y1={layout.y + FLOOR_BASELINE}
      x2={width}
      y2={layout.y + FLOOR_BASELINE}
      aria-hidden="true"
    />
  );
}

/** Un étage complet : escalier, bandeau, sol, murs et portes. */
export function FloorRow(props: FloorRowProps): React.ReactElement {
  const { layout } = props;
  return (
    <g
      className="placard-floor"
      data-year={layout.floor.year}
      data-floor-index={layout.index}
      role="group"
      aria-label={floorLabel(layout.floor)}
    >
      <Staircase x={STAIR_LEFT} y={layout.y + 12} height={FLOOR_HEIGHT - 24} />
      <FloorHeading layout={layout} />
      <FloorBoard layout={layout} />
      {layout.walls.map((slot) => (
        <WallNode key={`wall-${slot.wall.year}-${slot.x}`} slot={slot} />
      ))}
      {layout.doors.map((slot, localIndex) => {
        const index = props.firstDoorIndex + localIndex;
        return (
          <DoorNode
            key={slot.door.commit}
            slot={slot}
            index={index}
            active={props.activeIndex === index}
            opened={props.openedCommit === slot.door.commit}
            onOpen={props.onOpen}
            onActivate={props.onActivate}
            onKeyDown={props.onKeyDown}
            registerRef={props.registerRef}
          />
        );
      })}
    </g>
  );
}
