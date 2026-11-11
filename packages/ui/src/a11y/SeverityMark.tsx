import React from 'react';
import { SEVERITY_COLORS, SEVERITY_GLYPHS, severityLabel } from '@placard/core';
import type { SeverityLevel } from '@placard/core';

/**
 * Doublure textuelle et pictographique de la couleur (PLA-N-05).
 *
 * L'information n'est **jamais** portée par la seule couleur : chaque gravité
 * expose un libellé anglais, un pictogramme et une couleur. Le pictogramme est
 * décoratif (le libellé porte le sens) mais il rend la couleur lisible même
 * pour qui ne la distingue pas.
 */

export interface SeverityMarkProps {
  severity: SeverityLevel;
  /** Affiche le libellé après le pictogramme. */
  withLabel?: boolean;
  className?: string;
}

/** Couleur d'une gravité, depuis la palette partagée. */
export function colorOf(severity: SeverityLevel): string {
  return SEVERITY_COLORS[severity];
}

/** Pictogramme d'une gravité (`!!!`, `!!`, `!`, `.`). */
export function glyphOf(severity: SeverityLevel): string {
  return SEVERITY_GLYPHS[severity];
}

/** Libellé anglais d'une gravité, capitalisé comme dans le rapport. */
export function labelOf(severity: SeverityLevel): string {
  return severityLabel(severity, 'en');
}

/** Pastille de gravité : couleur + pictogramme + libellé, jamais la couleur seule. */
export function SeverityMark({
  severity,
  withLabel = true,
  className,
}: SeverityMarkProps): React.ReactElement {
  const suffix = className === undefined ? '' : ` ${className}`;
  return (
    <span
      className={`placard-severity placard-severity--${severity}${suffix}`}
      data-severity={severity}
    >
      <span className="placard-severity__glyph" aria-hidden="true" style={{ color: colorOf(severity) }}>
        {glyphOf(severity)}
      </span>
      {withLabel ? <span className="placard-severity__label">{labelOf(severity)}</span> : null}
    </span>
  );
}
