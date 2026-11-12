import React from 'react';

import { illustrationOpacity, illustrationTransform, type IllustrationProps } from './scale';

/**
 * Fenêtre ouverte du couloir (C.4) : le dépôt a un distant **public**, donc
 * l'exposition est réelle. Fermée (absente) quand le distant est privé.
 */
export function OpenWindow(props: IllustrationProps): React.ReactElement {
  return (
    <g
      className="placard-window"
      transform={illustrationTransform(props)}
      opacity={illustrationOpacity(props)}
      aria-hidden="true"
    >
      <path d="M0 0 L34 0 L34 40 L0 40 Z" fill="#14101F" stroke="#EDE6D6" strokeWidth="1.4" />
      <path d="M17 0 L17 40 M0 20 L34 20" stroke="#2A2140" strokeWidth="1" />
      <path d="M34 2 L54 -6 L54 30 L34 38 Z" fill="#2A2140" stroke="#EDE6D6" strokeWidth="1.1" opacity="0.9" />
      <path d="M40 8 Q46 14 40 20 M46 4 Q54 12 46 24" stroke="#EDE6D6" strokeWidth="0.7" fill="none" opacity="0.5" />
    </g>
  );
}
