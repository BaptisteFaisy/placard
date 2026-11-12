import React from 'react';

import type { PartProps } from './skeleton-parts';
import { Skull } from './skeleton-parts';

/** Un os long, dessiné entre deux extrémités. */
function Bone({ color, d }: PartProps & { d: string }): React.ReactElement {
  return <path className="placard-bone" d={d} stroke={color} strokeWidth="2.2" strokeLinecap="round" fill="none" />;
}

/**
 * Os épars : une chaîne suspecte (`suspicious-string`).
 * Rien debout, seulement des restes qui traînent.
 */
export function SkeletonLooseBones({ color }: PartProps): React.ReactElement {
  return (
    <g className="placard-skeleton placard-skeleton--loose-bones">
      <Skull color={color} />
      <Bone color={color} d="M6 46 L26 40" />
      <Bone color={color} d="M8 36 L28 50" />
      <Bone color={color} d="M22 52 L34 50" />
      <circle cx="30" cy="44" r="1.6" fill={color} />
    </g>
  );
}
