import type { CorridorItem, Door, Floor, ManorViewModel, WallStretch } from '@placard/core';

/**
 * Géométrie du manoir.
 *
 * Le manoir est une **projection du modèle**, pas une seconde source de vérité :
 * ce module ne calcule aucune donnée métier, il place les éléments déjà
 * construits par `@placard/manor-model`.
 *
 * Repère : x croît de gauche à droite (le temps, dans l'ordre chronologique),
 * y croît de haut en bas. L'étage 0 est le **grenier** (année la plus
 * ancienne) ; le dernier étage est le **rez-de-chaussée** (année courante).
 */

/** Largeur d'une porte, en pixels. */
export const DOOR_WIDTH = 64;
/** Hauteur d'un étage, en pixels. */
export const FLOOR_HEIGHT = 132;
/** Marge à gauche du couloir (l'escalier occupe la bande précédente). */
export const CORRIDOR_START = 56;
/** Largeur minimale d'un pan de mur. */
export const WALL_MIN = 30;
/** Largeur maximale d'un pan de mur : 312 commits tiennent dans 240 px. */
export const WALL_MAX = 240;
/** Pixels par commit compressé, avant bornage. */
export const WALL_UNIT = 6;
/** Hauteur du sol d'un étage dans son propre repère. */
export const FLOOR_BASELINE = 74;
/** Largeur de la bande d'escalier, à gauche. */
export const STAIR_WIDTH = 44;

/** Une porte placée : la porte du modèle et sa position. */
export interface DoorSlot {
  door: Door;
  x: number;
  y: number;
  floorIndex: number;
  year: number;
}

/** Un pan de mur placé. */
export interface WallSlot {
  wall: WallStretch;
  x: number;
  y: number;
  width: number;
  floorIndex: number;
}

/** Un étage placé : ses éléments, dans l'ordre du couloir. */
export interface FloorLayout {
  floor: Floor;
  index: number;
  y: number;
  doors: DoorSlot[];
  walls: WallSlot[];
  /** Largeur occupée par le couloir de cet étage. */
  width: number;
}

/** Plan complet du manoir, partagé par le rendu et les empreintes de pas. */
export interface ManorLayout {
  floors: FloorLayout[];
  /** Portes dans l'ordre de navigation : étage par étage, de gauche à droite. */
  order: DoorSlot[];
  /** Portes indexées par SHA de commit, pour les empreintes de pas. */
  byCommit: Map<string, DoorSlot>;
  width: number;
  height: number;
}

/** Largeur d'un élément de couloir : proportionnelle aux commits pour un mur. */
export function itemWidth(item: CorridorItem): number {
  if (item.kind === 'door') return DOOR_WIDTH;
  const scaled = item.commits * WALL_UNIT;
  if (scaled < WALL_MIN) return WALL_MIN;
  if (scaled > WALL_MAX) return WALL_MAX;
  return scaled;
}

/** Place les éléments d'un couloir, de gauche à droite. */
function placeFloor(floor: Floor, index: number): FloorLayout {
  const y = index * FLOOR_HEIGHT;
  const doors: DoorSlot[] = [];
  const walls: WallSlot[] = [];
  let cursor = CORRIDOR_START;
  for (const item of floor.items) {
    const width = itemWidth(item);
    if (item.kind === 'door') {
      doors.push({ door: item, x: cursor, y, floorIndex: index, year: floor.year });
    } else {
      walls.push({ wall: item, x: cursor, y, width, floorIndex: index });
    }
    cursor += width;
  }
  return { floor, index, y, doors, walls, width: cursor };
}

/**
 * Construit le plan du manoir : une passe par étage, aucune boucle imbriquée
 * sur les trouvailles. 500 portes restent linéaires.
 */
export function layoutManor(model: ManorViewModel): ManorLayout {
  const floors = model.floors.map((floor, index) => placeFloor(floor, index));
  const order: DoorSlot[] = [];
  const byCommit = new Map<string, DoorSlot>();
  for (const floor of floors) {
    for (const slot of floor.doors) {
      order.push(slot);
      byCommit.set(slot.door.commit, slot);
    }
  }
  let width = 0;
  for (const floor of floors) if (floor.width > width) width = floor.width;
  const last = floors[floors.length - 1];
  const height = last === undefined ? FLOOR_HEIGHT : last.y + FLOOR_HEIGHT;
  return { floors, order, byCommit, width: width + STAIR_WIDTH, height };
}
