import React from 'react';

import type { PartProps } from './skeleton-parts';
import { Legs, RibCage, Skull } from './skeleton-parts';

/**
 * Squelette à clé : clés et jetons (`cloud-key`, `platform-token`,
 * `private-key`, `signed-token`, `plaintext-password`). Il tient une clé.
 */
export function SkeletonKeyBearer({ color }: PartProps): React.ReactElement {
  return (
    <g className="placard-skeleton placard-skeleton--key-bearer">
      <Skull color={color} />
      <RibCage color={color} />
      <Legs color={color} />
      <g className="placard-skeleton__key">
        <path d="M26 30 L33 26" stroke={color} strokeWidth="1.6" />
        <circle cx="35" cy="25" r="3" fill="none" stroke={color} strokeWidth="1.4" />
        <path d="M32 28 L31 31 M34 29 L33 32" stroke={color} strokeWidth="1.2" />
      </g>
      <path d="M14 30 L9 34" stroke={color} strokeWidth="1.6" />
    </g>
  );
}
