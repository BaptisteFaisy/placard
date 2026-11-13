import React from 'react';
import type { Door, Finding } from '@placard/core';

import { DoorIllustration, type DoorIllustrationState } from '../illustrations/DoorIllustration';
import { Skeleton } from '../illustrations/Skeleton';
import { SpiderWeb } from '../illustrations/SpiderWeb';
import type { DoorSlot } from './layout';

/**
 * Une porte du manoir : un commit qui contient au moins une trouvaille (C.4).
 *
 * Chaque élément graphique porte une donnée du modèle :
 * - l'état de la porte (close, en alerte, scellée, ruban) vient de la gravité et
 *   des compteurs `sealed` / `dismissed` ;
 * - les toiles d'araignée viennent de `ageDays` ;
 * - chaque squelette vient d'une trouvaille : type = famille, taille = score ;
 * - la lueur sous la porte vient de la gravité maximale du commit.
 *
 * Le libellé accessible est `door.ariaLabel`, construit par le modèle : le
 * rendu ne recompose aucun texte de données (PLA-F-21).
 */

/** Nombre maximal de squelettes dessinés dans une porte (lisibilité). */
export const MAX_SKELETONS_PER_DOOR = 3;

/** État visuel d'une porte, déduit du modèle. */
export function doorStateOf(door: Door): DoorIllustrationState {
  if (door.sealed > 0 && door.dismissed === 0) return 'sealed';
  if (door.dismissed > 0 && door.sealed === 0) return 'ribbon';
  if (door.severity === 'critical' || door.severity === 'high') return 'alert';
  return 'normal';
}

/** Les trouvailles les plus dangereuses d'une porte, bornées pour le dessin. */
export function topFindings(door: Door, limit = MAX_SKELETONS_PER_DOOR): Finding[] {
  return [...door.findings].sort((a, b) => b.danger - a.danger).slice(0, limit);
}

/** Squelettes d'une porte : la famille code le type, le score code la taille. */
function DoorSkeletons({ door }: { door: Door }): React.ReactElement {
  const findings = topFindings(door);
  return (
    <g className="placard-door__figures" aria-hidden="true">
      {findings.map((finding, index) => (
        <Skeleton
          key={finding.id}
          family={finding.family}
          danger={finding.danger}
          ageDays={door.ageDays}
          severity={door.severity}
          x={8 + index * 17}
          y={14 + (100 - finding.danger) * 0.12}
        />
      ))}
    </g>
  );
}

/** Étiquette visible sous la porte : le commit court et son décompte. */
function DoorCaption({ door }: { door: Door }): React.ReactElement {
  return (
    <g className="placard-door__caption" aria-hidden="true">
      <text x="32" y="86" textAnchor="middle" className="placard-door__commit">
        {door.shortCommit}
      </text>
      <text x="32" y="96" textAnchor="middle" className="placard-door__count">
        {door.findings.length === 1 ? '1 finding' : `${door.findings.length} findings`}
      </text>
    </g>
  );
}

export interface DoorNodeProps {
  slot: DoorSlot;
  /** Index de la porte dans l'ordre de navigation. */
  index: number;
  /** La porte porte-t-elle le focus logique du manoir ? */
  active: boolean;
  /** La porte est-elle ouverte (fiche affichée) ? */
  opened: boolean;
  onOpen: (door: Door, index: number) => void;
  onActivate: (index: number) => void;
  onKeyDown: (event: React.KeyboardEvent<SVGGElement>, index: number) => void;
  /** Enregistre la référence DOM pour déplacer le focus. */
  registerRef: (commit: string, node: SVGGElement | null) => void;
}

/** Une porte interactive : focusable, ouvrable au clavier et au pointeur. */
export function DoorNode(props: DoorNodeProps): React.ReactElement {
  const { slot, index, active, opened } = props;
  const door = slot.door;
  const state = doorStateOf(door);
  return (
    <g
      ref={(node) => props.registerRef(door.commit, node)}
      className={`placard-door-node${active ? ' placard-door-node--active' : ''}${opened ? ' placard-door-node--open' : ''}`}
      transform={`translate(${slot.x} ${slot.y + 4})`}
      role="button"
      tabIndex={active ? 0 : -1}
      aria-label={door.ariaLabel}
      aria-pressed={opened}
      aria-haspopup="dialog"
      data-commit={door.commit}
      data-state={state}
      onClick={() => props.onOpen(door, index)}
      onFocus={() => props.onActivate(index)}
      onPointerEnter={() => props.onActivate(index)}
      onKeyDown={(event) => props.onKeyDown(event, index)}
    >
      <DoorIllustration state={state} severity={door.severity} ageDays={door.ageDays} scale={1} />
      <SpiderWeb ageDays={door.ageDays} x={52} y={12} radius={14} />
      <DoorSkeletons door={door} />
      <DoorCaption door={door} />
    </g>
  );
}
