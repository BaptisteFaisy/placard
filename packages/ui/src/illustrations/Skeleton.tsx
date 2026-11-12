import React from 'react';
import { FAMILY_TO_SKELETON } from '@placard/core';
import type { FindingFamily, SkeletonKind } from '@placard/core';

import { SkeletonChest } from './skeleton-chest';
import { SkeletonKeyBearer } from './skeleton-key-bearer';
import { SkeletonLooseBones } from './skeleton-loose-bones';
import { SkeletonPaperBearer } from './skeleton-paper-bearer';
import {
  illustrationOpacity,
  illustrationTransform,
  severityColor,
  type IllustrationProps,
} from './scale';

/**
 * Le squelette d'une trouvaille (C.4) : le **type** code la famille, la
 * **taille** code le score de danger, la **couleur** code la gravité.
 *
 * Le type vient de `FAMILY_TO_SKELETON` (vocabulaire partagé de `@placard/core`) :
 * le manoir ne réinvente pas la correspondance famille → squelette.
 */
export interface SkeletonProps extends IllustrationProps {
  kind?: SkeletonKind;
  family?: FindingFamily;
}

/** Choisit la figure à dessiner : la famille prime sur le type explicite. */
export function skeletonKindOf(props: SkeletonProps): SkeletonKind {
  if (props.family !== undefined) return FAMILY_TO_SKELETON[props.family];
  return props.kind ?? 'key-bearer';
}

/** Figure du costume correspondant au type de squelette. */
export function SkeletonFigure({ kind, color }: { kind: SkeletonKind; color: string }): React.ReactElement {
  if (kind === 'paper-bearer') return <SkeletonPaperBearer color={color} />;
  if (kind === 'chest') return <SkeletonChest color={color} />;
  if (kind === 'loose-bones') return <SkeletonLooseBones color={color} />;
  return <SkeletonKeyBearer color={color} />;
}

/** Squelette complet, positionné et mis à l'échelle par le modèle. */
export function Skeleton(props: SkeletonProps): React.ReactElement {
  const kind = skeletonKindOf(props);
  return (
    <g
      className={`placard-figure placard-figure--${kind}`}
      transform={illustrationTransform(props)}
      opacity={illustrationOpacity(props)}
      data-skeleton={kind}
    >
      <SkeletonFigure kind={kind} color={severityColor(props.severity ?? 'low')} />
    </g>
  );
}
