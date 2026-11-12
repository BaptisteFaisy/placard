import React from 'react';

import { illustrationOpacity, illustrationTransform, webStrands, type IllustrationProps } from './scale';

/**
 * Toile d'araignée (C.4) : l'âge du commit. Plus le commit est ancien, plus il
 * y a de brins — 1 brin pour un commit du jour, 5 pour un commit de quatre ans
 * et plus.
 */
export interface SpiderWebProps extends IllustrationProps {
  /** Rayon du quart de toile, en pixels du repère du parent. */
  radius?: number;
}

/** Une toile d'araignée dessinée dans un coin, ancrée en (0, 0). */
export function SpiderWeb(props: SpiderWebProps): React.ReactElement {
  const radius = props.radius ?? 22;
  const strands = webStrands(props.ageDays ?? 0);
  const spokes = [0, 22, 45, 68, 90];
  return (
    <g
      className="placard-web"
      transform={illustrationTransform({ ...props, scale: 1 })}
      opacity={illustrationOpacity(props)}
      data-strands={strands}
      aria-hidden="true"
    >
      {spokes.map((angle) => (
        <line
          key={`spoke-${angle}`}
          x1="0"
          y1="0"
          x2={Math.cos((angle * Math.PI) / 180) * radius}
          y2={Math.sin((angle * Math.PI) / 180) * radius}
          stroke="#EDE6D6"
          strokeWidth="0.6"
          opacity="0.55"
        />
      ))}
      {Array.from({ length: strands }, (_, index) => {
        const ring = (radius / (strands + 1)) * (index + 1);
        return (
          <path
            key={`ring-${index}`}
            d={`M${ring} 0 Q${ring * 0.72} ${ring * 0.72} 0 ${ring}`}
            stroke="#EDE6D6"
            strokeWidth="0.5"
            fill="none"
            opacity="0.5"
          />
        );
      })}
    </g>
  );
}
