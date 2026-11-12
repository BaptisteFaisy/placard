import React from 'react';

import { illustrationOpacity, illustrationTransform, type IllustrationProps } from './scale';

/**
 * Ruban noué (C.4) : faux positif écarté avec une raison motivée
 * (`.placard/ignore.yml`). Toujours annoncé en texte par le parent.
 */
export function Ribbon(props: IllustrationProps): React.ReactElement {
  return (
    <g
      className="placard-ribbon"
      transform={illustrationTransform(props)}
      opacity={illustrationOpacity(props)}
      aria-hidden="true"
    >
      <path d="M0 0 L-11 -7 L-11 -15 L0 -8 Z" fill="#7C6DB8" />
      <path d="M0 0 L11 -7 L11 -15 L0 -8 Z" fill="#7C6DB8" />
      <path d="M0 0 L-4 14 M0 0 L4 14" stroke="#7C6DB8" strokeWidth="2" fill="none" />
      <circle cx="0" cy="-4" r="3.2" fill="#EDE6D6" stroke="#7C6DB8" strokeWidth="1" />
    </g>
  );
}
