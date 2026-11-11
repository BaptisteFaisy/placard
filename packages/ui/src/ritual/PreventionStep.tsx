import React from 'react';
import type { PreventionProposal } from '@placard/core';

/**
 * Étape 3 — prévention (PLA-F-26).
 *
 * Deux gestes proposés, jamais appliqués en douce : les lignes `.gitignore` et
 * un crochet `pre-commit` qui refuse un secret avant qu'il n'entre dans
 * l'historique. Les rappels (protection d'envoi de l'hébergeur) restent des
 * rappels : l'outil ne configure pas le dépôt distant à la place de l'humain.
 */
export interface PreventionStepProps {
  proposal?: PreventionProposal | null;
  onApply: () => void;
  /** Prévention déjà appliquée ? */
  done: boolean;
}

/** Lignes à ajouter au `.gitignore`. */
function GitignoreBlock({ lines }: { lines: readonly string[] }): React.ReactElement {
  return (
    <div className="placard-prevention__gitignore">
      <h4>Add to .gitignore</h4>
      <pre>{lines.join('\n')}</pre>
    </div>
  );
}

/** Crochet pre-commit proposé, à relire avant installation. */
function HookBlock({ hook, hookPath }: { hook: string; hookPath: string }): React.ReactElement {
  return (
    <div className="placard-prevention__hook">
      <h4>
        Pre-commit hook (<code>{hookPath}</code>)
      </h4>
      <pre>{hook}</pre>
    </div>
  );
}

/** Rappels côté hébergeur : push protection, secret scanning. */
function Reminders({ reminders }: { reminders: readonly string[] }): React.ReactElement | null {
  if (reminders.length === 0) return null;
  return (
    <ul className="placard-prevention__reminders">
      {reminders.map((reminder) => (
        <li key={reminder}>{reminder}</li>
      ))}
    </ul>
  );
}

/** Étape de prévention complète. */
export function PreventionStep({ proposal, onApply, done }: PreventionStepProps): React.ReactElement {
  if (proposal === null || proposal === undefined) {
    return (
      <div className="placard-prevention">
        <button type="button" onClick={onApply}>
          Propose prevention
        </button>
      </div>
    );
  }
  return (
    <div className="placard-prevention">
      <GitignoreBlock lines={proposal.gitignoreLines} />
      <HookBlock hook={proposal.preCommitHook} hookPath={proposal.hookPath} />
      <Reminders reminders={proposal.reminders} />
      <button type="button" onClick={onApply} disabled={done}>
        {done ? 'Prevention applied' : 'Apply prevention'}
      </button>
    </div>
  );
}
