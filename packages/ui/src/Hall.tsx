import React from 'react';
import { FAMILIES, familyLabel, skeletonLabel } from '@placard/core';
import type { HallSummary, SkeletonKind } from '@placard/core';

import { SeverityMark } from './a11y/SeverityMark';

/**
 * Le hall d'entrée (PLA-F-20) : la synthèse du manoir, en une phrase et une
 * poignée de compteurs. Les squelettes « debout dans le hall » sont les
 * secrets encore présents dans le code courant.
 */
export interface HallProps {
  hall: HallSummary;
  /** Nom du dépôt analysé, pour situer la synthèse. */
  repoName: string;
}

/** Ligne de compteur : libellé, valeur, et doublure de gravité si utile. */
function Count({ label, value }: { label: string; value: number }): React.ReactElement {
  return (
    <div className="placard-hall__count">
      <dt>{label}</dt>
      <dd>{value}</dd>
    </div>
  );
}

/** Le hall complet : total, debout, gravités, familles, scellées, écartées. */
export function Hall({ hall, repoName }: HallProps): React.ReactElement {
  const families = FAMILIES.filter((family) => hall.byFamily[family] > 0);
  return (
    <section className="placard-hall" aria-label="Entrance hall summary">
      <h2 className="placard-hall__title">The entrance hall of {repoName}</h2>
      <p className="placard-hall__lede">
        {hall.total} finding{hall.total === 1 ? '' : 's'} in the manor, {hall.standing} still standing in current code
        {hall.publicRemote ? ', on a repository with a public remote' : ''}.
      </p>
      <dl className="placard-hall__counts">
        <Count label="Total findings" value={hall.total} />
        <Count label="Standing in the hall" value={hall.standing} />
        <Count label="Open" value={hall.open} />
        <Count label="Sealed" value={hall.sealed} />
        <Count label="Dismissed" value={hall.dismissed} />
      </dl>
      <div className="placard-hall__breakdown">
        <h3>By severity</h3>
        <ul className="placard-hall__list">
          {(['critical', 'high', 'medium', 'low'] as const).map((severity) => (
            <li key={severity}>
              <SeverityMark severity={severity} />
              <span className="placard-hall__value">{hall.bySeverity[severity]}</span>
            </li>
          ))}
        </ul>
        <h3>By family</h3>
        <ul className="placard-hall__list">
          {families.map((family) => (
            <li key={family}>
              <span>{familyLabel(family)}</span>
              <span className="placard-hall__value">{hall.byFamily[family]}</span>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

/** Rappel du vocabulaire du costume, pour la légende du hall. */
export function skeletonVocabulary(): string[] {
  const kinds: SkeletonKind[] = ['key-bearer', 'paper-bearer', 'chest', 'loose-bones'];
  return kinds.map((kind) => skeletonLabel(kind));
}
