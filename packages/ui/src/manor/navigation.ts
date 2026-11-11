import type { Door, FootprintTrail } from '@placard/core';

import type { DoorSlot, ManorLayout } from './layout.js';

/**
 * Navigation clavier du manoir (PLA-F-21) : Tab entre dans le manoir, les
 * flèches parcourent les portes, Entrée ouvre, Échap ferme (géré par la fiche).
 *
 * Toute la logique est **pure** : les mêmes fonctions servent au rendu et aux
 * tests, sans dépendre du DOM.
 */

/** Touches prises en charge par le couloir. */
export const MANOR_KEYS = ['ArrowRight', 'ArrowLeft', 'ArrowUp', 'ArrowDown', 'Home', 'End'] as const;

export type ManorKey = (typeof MANOR_KEYS)[number];

export function isManorKey(key: string): key is ManorKey {
  return (MANOR_KEYS as readonly string[]).includes(key);
}

/** Index borné dans [0, length - 1] ; -1 si la liste est vide. */
export function clampIndex(index: number, length: number): number {
  if (length === 0) return -1;
  if (index < 0) return 0;
  if (index > length - 1) return length - 1;
  return index;
}

/** Porte la plus proche d'une abscisse donnée sur un étage. */
function nearestOnFloor(slots: readonly DoorSlot[], x: number): number {
  let best = 0;
  let bestDistance = Number.POSITIVE_INFINITY;
  for (let index = 0; index < slots.length; index += 1) {
    const slot = slots[index];
    if (slot === undefined) continue;
    const distance = Math.abs(slot.x - x);
    if (distance < bestDistance) {
      bestDistance = distance;
      best = index;
    }
  }
  return best;
}

/** Change d'étage en conservant l'abscisse : le couloir reste « sous la lanterne ». */
function verticalTarget(order: readonly DoorSlot[], from: number, delta: number): number {
  const current = order[from];
  if (current === undefined) return from;
  const target = current.floorIndex + delta;
  const onFloor = order.filter((slot) => slot.floorIndex === target);
  if (onFloor.length === 0) return from;
  const local = nearestOnFloor(onFloor, current.x);
  const picked = onFloor[local];
  if (picked === undefined) return from;
  return order.indexOf(picked);
}

/**
 * Index de la porte atteinte par une touche, depuis l'index courant.
 * `ArrowRight`/`ArrowLeft` parcourent le couloir dans l'ordre chronologique,
 * `ArrowUp`/`ArrowDown` changent d'étage (donc d'année).
 */
export function nextDoorIndex(layout: ManorLayout, from: number, key: ManorKey): number {
  const { order } = layout;
  if (order.length === 0) return -1;
  const current = clampIndex(from, order.length);
  if (key === 'Home') return 0;
  if (key === 'End') return order.length - 1;
  if (key === 'ArrowRight') return clampIndex(current + 1, order.length);
  if (key === 'ArrowLeft') return clampIndex(current - 1, order.length);
  if (key === 'ArrowUp') return verticalTarget(order, current, -1);
  return verticalTarget(order, current, 1);
}

/** Porte correspondant à un index, si elle existe. */
export function doorAtIndex(layout: ManorLayout, index: number): Door | undefined {
  return layout.order[index]?.door;
}

/** Index de la porte d'un commit donné, ou -1. */
export function indexOfCommit(layout: ManorLayout, commit: string): number {
  return layout.order.findIndex((slot) => slot.door.commit === commit);
}

/** Étiquettes des portes reliées par une trace, dans l'ordre du couloir. */
export function trailDoors(trail: FootprintTrail | null | undefined): readonly string[] {
  if (trail === null || trail === undefined) return [];
  return trail.doors.map((door) => door.commit);
}

/** Vrai si une porte porte au moins une trouvaille scellée. */
export function hasSeal(door: Door): boolean {
  return door.sealed > 0;
}

/** Vrai si une porte porte au moins une trouvaille écartée. */
export function hasRibbon(door: Door): boolean {
  return door.dismissed > 0;
}
