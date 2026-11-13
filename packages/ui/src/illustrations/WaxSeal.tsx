import React from 'react';

import { illustrationOpacity, illustrationTransform, type IllustrationProps } from './scale';

/**
 * Sceau de cire rouge (C.4) : trouvaille traitée — rotation effectuée et purge
 * validée. Le sceau est toujours annoncé en texte par le parent.
 */
export function WaxSeal(props: IllustrationProps): React.ReactElement {
  return (
    <g
      className="placard-wax-seal"
      transform={illustrationTransform(props)}
      opacity={illustrationOpacity(props)}
      aria-hidden="true"
    >
      <circle cx="0" cy="0" r="9" fill="#B23A48" />
      <circle cx="0" cy="0" r="6.4" fill="none" stroke="#EDE6D6" strokeWidth="0.9" opacity="0.8" />
      <path d="M-3 -1 L0 -4 L3 -1 L1 3 L-1 3 Z" fill="#EDE6D6" opacity="0.85" />
    </g>
  );
}
