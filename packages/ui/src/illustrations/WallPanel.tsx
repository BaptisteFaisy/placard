import React from 'react';

import { illustrationTransform, type IllustrationProps } from './scale';

/**
 * Pan de mur (C.4) : une suite de commits **sans aucune trouvaille**,
 * compressée. Le nombre de commits est écrit sur le pan par `WallNode` ;
 * ce composant ne dessine que la pierre.
 */
export interface WallPanelProps extends IllustrationProps {
  /** Largeur du pan, proportionnelle au nombre de commits compressés. */
  width: number;
  /** Hauteur du pan. */
  height?: number;
}

/** Pierre fissurée, avec ses joints. */
export function WallPanel({ width, height = 62, ...props }: WallPanelProps): React.ReactElement {
  const stones = Math.max(2, Math.round(width / 26));
  const step = width / stones;
  return (
    <g className="placard-wall" transform={illustrationTransform({ ...props, scale: 1 })} aria-hidden="true">
      <rect x="0" y="0" width={width} height={height} fill="#2A2140" />
      <rect x="0" y="0" width={width} height={height} fill="none" stroke="#14101F" strokeWidth="1" />
      {Array.from({ length: stones - 1 }, (_, index) => (
        <line
          key={`joint-${index}`}
          x1={step * (index + 1)}
          y1="0"
          x2={step * (index + 1)}
          y2={height}
          stroke="#14101F"
          strokeWidth="1"
          opacity="0.7"
        />
      ))}
      <path
        d={`M${step * 0.4} 12 L${step * 1.1} 26 L${step * 0.8} 40 L${step * 1.4} 52`}
        stroke="#14101F"
        strokeWidth="0.8"
        fill="none"
        opacity="0.8"
      />
    </g>
  );
}
