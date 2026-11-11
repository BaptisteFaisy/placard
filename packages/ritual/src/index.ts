import type { RitualApi } from '@placard/core';

import { certificate } from './certificate.js';
import { dryRun } from './dry-run.js';
import { prevention } from './prevention.js';
import { generatePurge } from './purge.js';
import { rotationCard } from './rotation-cards.js';
import { loadState, saveState } from './state.js';
import { markRotated, steps } from './steps.js';
import { verify } from './verify.js';

/**
 * `@placard/ritual` — le rituel de remédiation.
 *
 * Quatre étapes dans un ordre imposé : rotation → purge → prévention →
 * vérification. Le verrou d'ordre (PLA-F-23) interdit la purge avant la
 * rotation, et l'outil n'exécute jamais la réécriture d'historique (PLA-F-24).
 */

export * from './families.js';
export * from './steps.js';
export * from './rotation-cards.js';
export * from './state.js';
export * from './value-recovery.js';
export * from './purge-script.js';
export * from './purge.js';
export * from './dry-run.js';
export * from './prevention.js';
export * from './verify.js';
export * from './certificate.js';

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
