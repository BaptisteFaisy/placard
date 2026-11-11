import React from 'react';

/**
 * Pièces communes aux quatre squelettes du costume (C.4).
 * Une seule implémentation du crâne et de la cage thoracique, partagée par les
 * quatre figures : aucune duplication de tracé.
 */

export interface PartProps {
  /** Couleur du trait : la gravité de la trouvaille. */
  color: string;
}

/** Crâne : boîte osseuse, orbites et mâchoire. */
export function Skull({ color }: PartProps): React.ReactElement {
  return (
    <g className="placard-skull">
      <path d="M12 14 Q12 4 20 4 Q28 4 28 14 Q28 20 24 22 L16 22 Q12 20 12 14 Z" fill={color} opacity="0.9" />
      <circle cx="16.4" cy="12" r="2" fill="#14101F" />
      <circle cx="23.6" cy="12" r="2" fill="#14101F" />
      <path d="M18 18 L22 18 M19 20 L21 20" stroke="#14101F" strokeWidth="1" />
    </g>
  );
}

/** Cage thoracique : trois côtes et la colonne. */
export function RibCage({ color }: PartProps): React.ReactElement {
  return (
    <g className="placard-ribs">
      <path d="M20 24 L20 40" stroke={color} strokeWidth="1.6" />
      <path d="M14 27 Q20 31 26 27" stroke={color} strokeWidth="1.2" fill="none" />
      <path d="M14 32 Q20 36 26 32" stroke={color} strokeWidth="1.2" fill="none" />
      <path d="M15 37 Q20 40 25 37" stroke={color} strokeWidth="1.2" fill="none" />
    </g>
  );
}

/** Jambes : deux os qui pendent. */
export function Legs({ color }: PartProps): React.ReactElement {
  return (
    <g className="placard-legs">
      <path d="M18 40 L16 54 M22 40 L24 54" stroke={color} strokeWidth="1.6" />
      <path d="M13 54 L19 54 M21 54 L27 54" stroke={color} strokeWidth="1.6" />
    </g>
  );
}
