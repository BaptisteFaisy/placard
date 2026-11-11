import type { SeverityLevel } from './types.js';

/**
 * Gravité déduite du score de danger (0-100). Les seuils sont figés ici pour
 * que le manoir, le registre et le rapport parlent exactement la même langue.
 *
 * L'information n'est jamais portée par la seule couleur (PLA-N-05) : chaque
 * niveau a une couleur, un pictogramme et un libellé textuel.
 */
export const SEVERITY_THRESHOLDS = {
  critical: 85,
  high: 65,
  medium: 40,
} as const;

export const SEVERITY_ORDER: readonly SeverityLevel[] = ['critical', 'high', 'medium', 'low'];

/** Palette de la direction artistique (steering `art-direction.md`). */
export const SEVERITY_COLORS: Record<SeverityLevel, string> = {
  critical: '#E4572E',
  high: '#F2A541',
  medium: '#EDE6D6',
  low: '#7C6DB8',
};

/** Pictogramme textuel, doublure de la couleur pour les lecteurs d'écran. */
export const SEVERITY_GLYPHS: Record<SeverityLevel, string> = {
  critical: '!!!',
  high: '!!',
  medium: '!',
  low: '.',
};

export function severityOf(danger: number): SeverityLevel {
  if (danger >= SEVERITY_THRESHOLDS.critical) return 'critical';
  if (danger >= SEVERITY_THRESHOLDS.high) return 'high';
  if (danger >= SEVERITY_THRESHOLDS.medium) return 'medium';
  return 'low';
}

/** Compare deux niveaux de gravité : > 0 si `a` est plus grave que `b`. */
export function compareSeverity(a: SeverityLevel, b: SeverityLevel): number {
  return SEVERITY_ORDER.indexOf(a) - SEVERITY_ORDER.indexOf(b);
}

/** Gravité maximale d'une liste de scores (utilisée pour la lueur sous la porte). */
export function maxSeverity(dangers: readonly number[]): SeverityLevel | 'none' {
  if (dangers.length === 0) return 'none';
  let worst: SeverityLevel = 'low';
  for (const danger of dangers) {
    const level = severityOf(danger);
    if (compareSeverity(level, worst) < 0) worst = level;
  }
  return worst;
}
