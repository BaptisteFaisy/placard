import React from 'react';
import type { RitualStep } from '@placard/core';

/**
 * En-tête commun aux quatre étapes du rituel.
 *
 * Il porte le verrou et sa **raison visible** : un bouton grisé sans
 * explication est une impasse, pas une contrainte (PLA-F-23).
 */
export interface StepHeaderProps {
  step: RitualStep;
  /** Numéro d'ordre affiché (1 à 4). */
  position: number;
}

/** Vrai si l'étape est verrouillée. */
export function isLocked(step: RitualStep): boolean {
  return step.locked;
}

/** Statut lisible d'une étape : done, locked, ready. */
export function stepStatus(step: RitualStep): 'done' | 'locked' | 'ready' {
  if (step.done) return 'done';
  if (step.locked) return 'locked';
  return 'ready';
}

/** Libellé textuel du statut, doublure du style (jamais la couleur seule). */
export function stepStatusLabel(step: RitualStep): string {
  const status = stepStatus(step);
  if (status === 'done') return 'Done';
  if (status === 'locked') return 'Locked';
  return 'Ready';
}

/** En-tête d'étape : numéro, titre, description, statut et raison du verrou. */
export function StepHeader({ step, position }: StepHeaderProps): React.ReactElement {
  const status = stepStatus(step);
  return (
    <header className="placard-ritual__head" data-status={status}>
      <h3 className="placard-ritual__title">
        <span className="placard-ritual__position" aria-hidden="true">
          {position}.
        </span>{' '}
        {step.title}
      </h3>
      <p className="placard-ritual__description">{step.description}</p>
      <p className="placard-ritual__status">
        <strong>{stepStatusLabel(step)}</strong>
        {step.doneAt === undefined ? null : <span className="placard-ritual__done-at"> — {step.doneAt}</span>}
      </p>
      {step.locked && step.lockReason !== undefined ? (
        <p className="placard-ritual__lock" role="note">
          {step.lockReason}
        </p>
      ) : null}
    </header>
  );
}
