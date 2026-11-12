import type { RitualApi } from '@placard/core';

import { certificate } from './certificate';
import { dryRun } from './dry-run';
import { prevention } from './prevention';
import { generatePurge } from './purge';
import { rotationCard } from './rotation-cards';
import { loadState, saveState } from './state';
import { markRotated, steps } from './steps';
import { verify } from './verify';

/**
 * `@placard/ritual` — le rituel de remédiation.
 *
 * Quatre étapes dans un ordre imposé : rotation → purge → prévention →
 * vérification. Le verrou d'ordre (PLA-F-23) interdit la purge avant la
 * rotation, et l'outil n'exécute jamais la réécriture d'historique (PLA-F-24).
 */

export * from './families';
export * from './steps';
export * from './rotation-cards';
export * from './state';
export * from './value-recovery';
export * from './purge-script';
export * from './purge';
export * from './dry-run';
export * from './prevention';
export * from './verify';
export * from './certificate';

/** Interface du paquet, plus l'essai à blanc qui n'est pas au contrat. */
export interface RitualApiWithDryRun extends RitualApi {
  /** Exécute le script sur un clone miroir jetable et compte les commits réécrits. */
  dryRun: typeof dryRun;
}

/** Construit l'API du rituel. */
export function createRitualApi(): RitualApiWithDryRun {
  return {
    steps,
    rotationCard,
    markRotated,
    generatePurge,
    prevention,
    verify,
    certificate,
    loadState,
    saveState,
    dryRun,
  };
}
