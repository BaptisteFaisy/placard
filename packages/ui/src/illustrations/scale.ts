import { SEVERITY_COLORS } from '@placard/core';
import type { SeverityLevel } from '@placard/core';

/**
 * Échelles communes aux illustrations du manoir (steering `costume-mapping.md`).
 *
 * Trois grandeurs du modèle pilotent le dessin, et rien d'autre :
 * - **la taille** code le score de danger (0-100) ;
 * - **l'opacité** code l'âge du commit en jours ;
 * - **la couleur** code la gravité de la direction artistique.
 *
 * Aucune de ces trois informations n'est portée par la seule couleur
 * (PLA-N-05) : chaque illustration est toujours accompagnée d'un libellé
 * textuel fourni par le modèle.
 */

/** Échelle minimale d'un squelette (score 0). */
export const MIN_SCALE = 0.6;
/** Échelle maximale d'un squelette (score 100). */
export const MAX_SCALE = 1.4;
/** Au-delà de quatre ans, l'encre est au plus pâle. */
export const OLDEST_DAYS = 1460;
/** Opacité d'une illustration très ancienne. */
export const MIN_OPACITY = 0.45;

/** Borne une valeur dans [0, 1] ; `NaN` devient 0 (jamais de rendu cassé). */
export function clamp01(value: number): number {
  if (!Number.isFinite(value)) return 0;
  if (value < 0) return 0;
  if (value > 1) return 1;
  return value;
}

/** Taille d'une illustration : le score de danger devient une échelle. */
export function scaleForDanger(danger: number): number {
  return MIN_SCALE + clamp01(danger / 100) * (MAX_SCALE - MIN_SCALE);
}

/** Opacité d'une illustration : plus le commit est vieux, plus l'encre est pâle. */
export function opacityForAge(ageDays: number): number {
  const ratio = clamp01(Math.max(0, ageDays) / OLDEST_DAYS);
  return 1 - ratio * (1 - MIN_OPACITY);
}

/** Couleur d'une illustration : la gravité, jamais seule (toujours doublée d'un texte). */
export function severityColor(severity: SeverityLevel | 'none'): string {
  return severity === 'none' ? SEVERITY_COLORS.low : SEVERITY_COLORS[severity];
}

/** Nombre de brins de toile d'araignée : l'âge, de 1 brin à 5. */
export function webStrands(ageDays: number): number {
  return 1 + Math.round(clamp01(Math.max(0, ageDays) / OLDEST_DAYS) * 4);
}

/** Propriétés communes à toute illustration : trois données, jamais de décor gratuit. */
export interface IllustrationProps {
  /** Score de danger 0-100 → taille. */
  danger?: number;
  /** Âge du commit en jours → opacité. */
  ageDays?: number;
  /** Gravité → couleur. */
  severity?: SeverityLevel | 'none';
  /** Position horizontale dans le repère du parent. */
  x?: number;
  /** Position verticale dans le repère du parent. */
  y?: number;
  /** Échelle imposée, prioritaire sur `danger`. */
  scale?: number;
  /** Classe CSS supplémentaire. */
  className?: string;
}

/** Transformation SVG dérivée des propriétés d'une illustration. */
export function illustrationTransform(props: IllustrationProps): string {
  const scale = props.scale ?? scaleForDanger(props.danger ?? 50);
  return `translate(${props.x ?? 0} ${props.y ?? 0}) scale(${scale.toFixed(3)})`;
}

/** Opacité SVG dérivée de l'âge d'une illustration. */
export function illustrationOpacity(props: IllustrationProps): number {
  return opacityForAge(props.ageDays ?? 0);
}
