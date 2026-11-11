import type { Finding, RitualOptions, RitualState, RitualStep, RotateInput } from '@placard/core';

import { EVALUATE_TITLE, isPersonalData } from './families.js';
import { baseState, loadState, saveState } from './state.js';

/**
 * Les quatre étapes du rituel et leurs verrous (PLA-F-23).
 *
 * L'ordre est imposé : tant que l'étape 1 n'est ni cochée ni déclarée sans
 * objet avec une raison, l'étape 2 reste verrouillée. Les étapes 3 et 4 ne
 * touchent pas à l'historique, elles restent donc accessibles à tout moment :
 * proposer une prévention ou relancer une analyse n'a jamais détruit quoi que
 * ce soit.
 */

/** Raison du verrou, affichée telle quelle dans l'interface (anglais). */
export const PURGE_LOCK_REASON =
  'Rotate the credential first: a purge without rotation leaves a live secret ' +
  'in the wild. Mark step 1 as done, or declare it not applicable with a reason.';

/** Variante pour les données personnelles, où il n'y a rien à révoquer. */
export const PURGE_LOCK_REASON_PERSONAL =
  'Evaluate the exposure first: declare step 1 as not applicable with a reason ' +
  'once you have assessed who is affected. A purge alone does not undo an exposure.';

/** La rotation est-elle validée (cochée ou déclarée sans objet) ? */
export function isRotationDone(state: RitualState | undefined): boolean {
  return state?.rotate !== undefined;
}

function rotateDoneAt(state: RitualState | undefined): string | undefined {
  const rotate = state?.rotate;
  if (rotate === undefined) return undefined;
  return 'doneAt' in rotate ? rotate.doneAt : rotate.date;
}

function rotateStep(finding: Finding, state: RitualState | undefined): RitualStep {
  const personal = isPersonalData(finding.family);
  const done = isRotationDone(state);
  const step: RitualStep = {
    id: 'rotate',
    title: personal ? EVALUATE_TITLE : 'Rotate the credential',
    description: personal
      ? 'There is nothing to revoke: assess who is affected by the exposed personal data and record your decision.'
      : `Revoke the leaked ${finding.family} at the provider, then confirm it here. Nothing is purged before this.`,
    locked: false,
    done,
  };
  const doneAt = rotateDoneAt(state);
  if (doneAt !== undefined) step.doneAt = doneAt;
  return step;
}

function purgeStep(finding: Finding, state: RitualState | undefined): RitualStep {
  const unlocked = isRotationDone(state);
  const step: RitualStep = {
    id: 'purge',
    title: 'Purge the history',
    description:
      'Generate a git-filter-repo script that rewrites the whole history, and run it on a mirror clone yourself.',
    locked: !unlocked,
    done: state?.purge !== undefined,
  };
  if (!unlocked) {
    step.lockReason = isPersonalData(finding.family) ? PURGE_LOCK_REASON_PERSONAL : PURGE_LOCK_REASON;
  }
  if (state?.purge !== undefined) step.doneAt = state.purge.generatedAt;
  return step;
}

function preventStep(state: RitualState | undefined): RitualStep {
  const step: RitualStep = {
    id: 'prevent',
    title: 'Prevent the next leak',
    description:
      'Propose .gitignore entries and a pre-commit hook that scans staged changes before they are committed.',
    locked: false,
    done: state?.prevent !== undefined,
  };
  if (state?.prevent !== undefined) step.doneAt = state.prevent.appliedAt;
  return step;
}

function verifyStep(state: RitualState | undefined): RitualStep {
  const step: RitualStep = {
    id: 'verify',
    title: 'Verify and seal',
    description:
      'Re-run the analysis. If the value is gone, the door is sealed and the certificate is issued.',
    locked: false,
    done: state?.sealedAt !== undefined,
  };
  const doneAt = state?.sealedAt ?? state?.verify?.verifiedAt;
  if (doneAt !== undefined) step.doneAt = doneAt;
  return step;
}

/** Construit les 4 étapes, dans l'ordre, avec leurs verrous. */
export function steps(finding: Finding, state: RitualState | undefined): RitualStep[] {
  return [rotateStep(finding, state), purgeStep(finding, state), preventStep(state), verifyStep(state)];
}

/**
 * Coche l'étape 1 : rotation attestée, ou déclarée sans objet avec une raison.
 * Sans l'une des deux, l'étape 2 reste verrouillée (PLA-F-23).
 */
export async function markRotated(
  options: RitualOptions,
  finding: Finding,
  input: RotateInput,
): Promise<RitualState> {
  const existing = (await loadState(options.placardDir, finding.fingerprint)) ?? baseState(finding);
  const now = new Date().toISOString();
  const state: RitualState = {
    ...existing,
    fingerprint: finding.fingerprint,
    findingId: finding.id,
  };
  if (input.done) {
    const by = input.by.trim();
    if (by === '') throw new Error('Rotation needs an attestation: say who rotated the credential.');
    state.rotate = { doneAt: now, by };
  } else {
    const reason = input.reason.trim();
    if (reason === '') throw new Error('Declaring the rotation not applicable needs a reason.');
    state.rotate = { notApplicable: true, reason, date: now };
  }
  await saveState(options.placardDir, state);
  return state;
}
