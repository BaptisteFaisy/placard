import React from 'react';

import type { PartProps } from './skeleton-parts';

/**
 * La malle cadenassée : un fichier sensible (`risky-file`).
 * Ce n'est pas un squelette, c'est ce qu'il garde enfermé.
 */
export function SkeletonChest({ color }: PartProps): React.ReactElement {
  return (
    <g className="placard-skeleton placard-skeleton--chest">
      <path d="M4 24 Q20 14 36 24 L36 26 L4 26 Z" fill="#2A2140" stroke={color} strokeWidth="1.4" />
      <path d="M4 26 L36 26 L36 50 L4 50 Z" fill="#14101F" stroke={color} strokeWidth="1.4" />
      <path d="M4 32 L36 32" stroke={color} strokeWidth="0.9" opacity="0.7" />
      <rect x="16" y="28" width="8" height="9" rx="1.6" fill={color} />
      <path d="M20 37 L20 41" stroke={color} strokeWidth="1.4" />
      <circle cx="20" cy="32.5" r="1.4" fill="#14101F" />
    </g>
  );
}
