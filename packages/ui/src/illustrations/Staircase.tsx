import React from 'react';

import { illustrationTransform, type IllustrationProps } from './scale';

/**
 * Escalier (C.4) : la liaison entre deux étages, donc entre deux années.
 * Il ne code aucune trouvaille par lui-même — il matérialise l'ordre
 * chronologique vertical du manoir (grenier en haut, rez-de-chaussée en bas).
 */
export interface StaircaseProps extends IllustrationProps {
  /** Hauteur à couvrir, en pixels du repère du parent. */
  height?: number;
  /** Nombre de marches dessinées. */
  steps?: number;
}

/** Volée de marches reliant le haut d'un étage au haut du suivant. */
export function Staircase(props: StaircaseProps): React.ReactElement {
  const height = props.height ?? 120;
  const count = Math.max(2, props.steps ?? 8);
  const stepHeight = height / count;
  const path = Array.from({ length: count }, (_, index) => {
    const y = height - index * stepHeight;
    return `M0 ${y} L14 ${y} L14 ${y - stepHeight}`;
  }).join(' ');
  return (
    <g
      className="placard-staircase"
      transform={illustrationTransform({ ...props, scale: 1 })}
      aria-hidden="true"
    >
      <path d={`${path} L14 0`} stroke="#2A2140" strokeWidth="3" fill="none" />
      <path d="M0 0 L0 ${height}" stroke="#2A2140" strokeWidth="1" opacity="0.6" />
    </g>
  );
}
