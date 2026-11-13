import React from 'react';

import { illustrationOpacity, illustrationTransform, type IllustrationProps } from './scale';

/**
 * La lanterne (C.4) : **le focus**. Elle suit le curseur et la navigation
 * clavier, et éclaire la trouvaille active. Elle ne code aucune trouvaille :
 * elle code la position du regard.
 */
export interface LanternProps extends IllustrationProps {
  /** La lanterne est-elle allumée (une porte a le focus) ? */
  lit?: boolean;
}

/** Lanterne suspendue, avec son halo. */
export function Lantern({ lit = true, ...props }: LanternProps): React.ReactElement {
  return (
    <g
      className={`placard-lantern${lit ? ' placard-lantern--lit' : ''}`}
      transform={illustrationTransform({ ...props, scale: 1 })}
      opacity={illustrationOpacity(props)}
      aria-hidden="true"
    >
      <path d="M0 0 L0 -14" stroke="#EDE6D6" strokeWidth="1" opacity="0.6" />
      <path d="M-9 -14 L9 -14 L7 -4 L-7 -4 Z" fill="#2A2140" stroke="#EDE6D6" strokeWidth="1" />
      <path d="M-6 -13 L6 -13 L5 -5 L-5 -5 Z" fill="#F2A541" opacity={lit ? 0.95 : 0.25} />
      <path d="M-11 -4 L11 -4 L9 2 L-9 2 Z" fill="#2A2140" stroke="#EDE6D6" strokeWidth="1" />
      {lit ? <circle cx="0" cy="-9" r="20" fill="#F2A541" opacity="0.12" /> : null}
    </g>
  );
}
