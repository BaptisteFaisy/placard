import React from 'react';
import type { Door, ManorViewModel } from '@placard/core';

import { Lantern } from '../illustrations/Lantern';
import { OpenWindow } from '../illustrations/OpenWindow';
import { Footprints } from '../Footprints';
import type { FootprintTrail } from '@placard/core';
import { FloorRow } from './FloorRow';
import type { ManorLayout } from './layout';

/**
 * La scène SVG du manoir : un étage par année, couloirs horizontaux, portes,
 * pans de mur, fenêtre ouverte et lanterne.
 *
 * Composant **purement présentationnel** : il reçoit le plan déjà calculé et
 * remonte les intentions (ouvrir, activer) au conteneur `Manor`, qui tient
 * l'état de navigation.
 */

export interface ManorSceneProps {
  model: ManorViewModel;
  layout: ManorLayout;
  activeIndex: number;
  openedCommit?: string;
  /** Position de la lanterne (focus ou pointeur), en coordonnées du manoir. */
  lantern: { x: number; y: number };
  trail?: FootprintTrail | null;
  onOpen: (door: Door, index: number) => void;
  onActivate: (index: number) => void;
  onKeyDown: (event: React.KeyboardEvent<SVGGElement>, index: number) => void;
  registerRef: (commit: string, node: SVGGElement | null) => void;
}

/** Index de la première porte de chaque étage, pour la numérotation globale. */
function firstDoorIndexes(layout: ManorLayout): number[] {
  const indexes: number[] = [];
  let cursor = 0;
  for (const floor of layout.floors) {
    indexes.push(cursor);
    cursor += floor.doors.length;
  }
  return indexes;
}

/** Fenêtre ouverte : le dépôt a un distant public (C.4). */
function RemoteWindow({ model, layout }: { model: ManorViewModel; layout: ManorLayout }): React.ReactElement | null {
  if (!model.repo.publicRemote) return null;
  return (
    <g className="placard-manor__window" role="img" aria-label="Open window: the repository has a public remote">
      <OpenWindow x={layout.width - 84} y={10} scale={1} />
      <text x={layout.width - 84} y={64} className="placard-manor__window-label">
        public remote
      </text>
    </g>
  );
}

/** La scène complète : étages, empreintes, lanterne, fenêtre. */
export function ManorScene(props: ManorSceneProps): React.ReactElement {
  const { layout, model } = props;
  const offsets = firstDoorIndexes(layout);
  return (
    <svg
      className="placard-manor__svg"
      viewBox={`0 0 ${layout.width} ${layout.height}`}
      width={layout.width}
      height={layout.height}
      role="application"
      aria-label={`Haunted manor: ${model.floors.length} floors, ${model.doorCount} doors, ${model.wallCount} walls`}
      data-doors={model.doorCount}
    >
      {layout.floors.map((floor) => (
        <FloorRow
          key={floor.floor.year}
          layout={floor}
          firstDoorIndex={offsets[floor.index] ?? 0}
          activeIndex={props.activeIndex}
          openedCommit={props.openedCommit}
          onOpen={props.onOpen}
          onActivate={props.onActivate}
          onKeyDown={props.onKeyDown}
          registerRef={props.registerRef}
        />
      ))}
      <Footprints layout={layout} trail={props.trail ?? null} />
      <RemoteWindow model={model} layout={layout} />
      <Lantern x={props.lantern.x} y={props.lantern.y} lit={props.activeIndex >= 0} />
    </svg>
  );
}
