import React from 'react';

import { WallPanel } from '../illustrations/WallPanel';
import { wallLabel } from '@placard/manor-model';
import type { WallSlot } from './layout';

/**
 * Un pan de mur (C.4) : une suite de commits **sans aucune trouvaille**,
 * compressée. L'étiquette « 312 commits » est la donnée : elle n'est pas
 * décorative, elle dit exactement combien d'historique est résumé ici.
 */
export interface WallNodeProps {
  slot: WallSlot;
}

/** Pan de pierre étiqueté, largeur proportionnelle au nombre de commits. */
export function WallNode({ slot }: WallNodeProps): React.ReactElement {
  const label = wallLabel(slot.wall.commits);
  return (
    <g
      className="placard-wall-node"
      transform={`translate(${slot.x} ${slot.y + 4})`}
      role="img"
      aria-label={`Wall: ${label} without any finding`}
      data-commits={slot.wall.commits}
    >
      <WallPanel width={slot.width} height={76} />
      <text
        className="placard-wall-node__label"
        x={slot.width / 2}
        y="42"
        textAnchor="middle"
        aria-hidden="true"
      >
        {label}
      </text>
    </g>
  );
}
