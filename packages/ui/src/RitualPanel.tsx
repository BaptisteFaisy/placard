import React from 'react';
import type { PreventionProposal, PurgeArtifacts, RitualStep, RitualStepId, RotateInput, RotationCard } from '@placard/core';

import { PreventionStep } from './ritual/PreventionStep.js';
import { PurgeStep } from './ritual/PurgeStep.js';
import { RotationStep } from './ritual/RotationStep.js';
import { StepHeader } from './ritual/StepHeader.js';
import { VerifyStep } from './ritual/VerifyStep.js';

/**
 * Le rituel de remédiation, en quatre étapes ordonnées (PLA-F-22 à PLA-F-28).
 *
 * **L'ordre est la garantie** : on tourne d'abord, on purge ensuite. Ce
 * composant ne calcule aucun verrou — il reçoit `steps` de `@placard/ritual` et
 * se contente de rendre ce que le métier a décidé, en remontant les intentions
 * par callbacks. Il n'exécute rien, ne touche à aucun fichier, n'écrit aucune
 * valeur : uniquement des chemins et des commandes à relire.
 */

/** État d'une vérification, tel que le rend le métier. */
export interface RitualVerification {
  verifiedAt: string;
  stillFound: boolean;
  reportPath: string;
}

export interface RitualPanelProps {
  /** Les quatre étapes, avec leurs verrous, telles que les a construites le métier. */
  steps: RitualStep[];
  /** Fiche fournisseur de la règle concernée. */
  rotation: RotationCard;
  purge?: PurgeArtifacts | null;
  prevention?: PreventionProposal | null;
  verification?: RitualVerification | null;
  certificatePath?: string | null;
  onRotate: (input: RotateInput) => void;
  onGeneratePurge: () => void;
  onApplyPrevention: () => void;
  onVerify: () => void;
  onCertificate: () => void;
}

/** Retrouve une étape par identifiant, sans jamais jeter. */
export function stepOf(steps: readonly RitualStep[], id: RitualStepId): RitualStep | undefined {
  return steps.find((step) => step.id === id);
}

/** Numéro d'affichage d'une étape, stable quel que soit l'ordre reçu. */
const ORDER: readonly RitualStepId[] = ['rotate', 'purge', 'prevent', 'verify'];

/** Une étape et son contenu : le contenu vient du composant spécialisé. */
function RitualStepView({
  id,
  steps,
  children,
}: {
  id: RitualStepId;
  steps: readonly RitualStep[];
  children: React.ReactNode;
}): React.ReactElement | null {
  const step = stepOf(steps, id);
  if (step === undefined) return null;
  const position = ORDER.indexOf(id) + 1;
  return (
    <li className="placard-ritual__step" data-step={id}>
      <StepHeader step={step} position={position} />
      {children}
    </li>
  );
}

/** Le panneau complet du rituel. */
export function RitualPanel(props: RitualPanelProps): React.ReactElement {
  const purgeStep = stepOf(props.steps, 'purge');
  const rotateStep = stepOf(props.steps, 'rotate');
  return (
    <section className="placard-ritual" aria-label="Remediation ritual">
      <h2 className="placard-ritual__heading">The ritual: rotate, purge, prevent, verify</h2>
      <p className="placard-ritual__lede">
        The order is the safety. Placard never touches your repository: it writes a script and the commands you run
        yourself, after reading them.
      </p>
      <ol className="placard-ritual__steps">
        <RitualStepView id="rotate" steps={props.steps}>
          <RotationStep card={props.rotation} done={rotateStep?.done ?? false} onRotate={props.onRotate} />
        </RitualStepView>
        <RitualStepView id="purge" steps={props.steps}>
          <PurgeStep
            locked={purgeStep?.locked ?? true}
            lockReason={purgeStep?.lockReason}
            artifacts={props.purge ?? null}
            onGenerate={props.onGeneratePurge}
          />
        </RitualStepView>
        <RitualStepView id="prevent" steps={props.steps}>
          <PreventionStep
            proposal={props.prevention ?? null}
            done={stepOf(props.steps, 'prevent')?.done ?? false}
            onApply={props.onApplyPrevention}
          />
        </RitualStepView>
        <RitualStepView id="verify" steps={props.steps}>
          <VerifyStep
            onVerify={props.onVerify}
            onCertificate={props.onCertificate}
            verification={props.verification ?? null}
            certificatePath={props.certificatePath ?? null}
          />
        </RitualStepView>
      </ol>
    </section>
  );
}
