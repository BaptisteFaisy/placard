import React from 'react';
import type { ManorViewModel } from '@placard/core';

import { floorPositionLabel, summarizeFloors } from './fallback';

/**
 * Repli lisible du manoir pour les très gros dépôts.
 *
 * Au-delà du seuil de portes, le SVG complet coûterait des milliers de nœuds :
 * on affiche un résumé par étage, en texte, et on renvoie au registre — qui
 * contient **exactement les mêmes trouvailles** (PLA-P-11). Ce n'est pas une
 * vue dégradée : c'est la même donnée, lisible autrement.
 */
export interface FallbackListProps {
  model: ManorViewModel;
  limit: number;
}

/** Résumé textuel par étage : année, portes, commits sous les murs. */
export function FallbackList({ model, limit }: FallbackListProps): React.ReactElement {
  const lines = summarizeFloors(model);
  return (
    <div className="placard-fallback">
      <p className="placard-fallback__notice" role="note">
        {model.doorCount} doors is more than the {limit} this drawing renders at once. The same findings are listed
        below, floor by floor, and in the registry.
      </p>
      <ul className="placard-fallback__floors">
        {lines.map((line) => (
          <li key={line.year} className="placard-fallback__floor">
            <strong>
              {line.year} — {floorPositionLabel(line)}
            </strong>
            : {line.doors} door{line.doors === 1 ? '' : 's'}, {line.findings} finding
            {line.findings === 1 ? '' : 's'}, {line.wallCommits} commit{line.wallCommits === 1 ? '' : 's'} behind
            walls
          </li>
        ))}
      </ul>
    </div>
  );
}
