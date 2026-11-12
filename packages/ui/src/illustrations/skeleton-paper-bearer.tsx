import React from 'react';

import type { PartProps } from './skeleton-parts';
import { Legs, RibCage, Skull } from './skeleton-parts';

/**
 * Squelette à papiers : données bancaires et identité (`bank-data`, `identity`).
 * Il porte deux feuilles qui dépassent de ses côtes.
 */
export function SkeletonPaperBearer({ color }: PartProps): React.ReactElement {
  return (
    <g className="placard-skeleton placard-skeleton--paper-bearer">
      <Skull color={color} />
      <RibCage color={color} />
      <Legs color={color} />
      <g className="placard-skeleton__papers">
        <path d="M26 26 L36 29 L34 40 L24 37 Z" fill="#EDE6D6" stroke={color} strokeWidth="1" />
        <path d="M28 31 L33 32 M27.5 34 L32.5 35" stroke={color} strokeWidth="0.9" />
        <path d="M4 28 L12 26 L13 36 L5 38 Z" fill="#EDE6D6" stroke={color} strokeWidth="1" />
      </g>
    </g>
  );
}
