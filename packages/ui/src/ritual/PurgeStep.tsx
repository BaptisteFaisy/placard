import React from 'react';
import type { PurgeArtifacts } from '@placard/core';

/**
 * Étape 2 — purge (PLA-F-23, PLA-F-24).
 *
 * La purge reste **verrouillée** tant que la rotation n'est pas faite : le
 * bouton est `disabled` et l'explication est affichée à côté, jamais seulement
 * dans une infobulle. L'outil ne purge jamais le dépôt lui-même : il produit un
 * script et des commandes **à relire**, et l'utilisateur les exécute.
 */
export interface PurgeStepProps {
  locked: boolean;
  lockReason?: string;
  artifacts?: PurgeArtifacts | null;
  onGenerate: () => void;
}

/** Avertissements sur le push forcé : identifiants changés, caches hébergeur… */
function PurgeWarnings({ warnings }: { warnings: readonly string[] }): React.ReactElement | null {
  if (warnings.length === 0) return null;
  return (
    <div className="placard-purge__warnings">
      <h4>Read before pushing</h4>
      <ul>
        {warnings.map((warning) => (
          <li key={warning}>{warning}</li>
        ))}
      </ul>
    </div>
  );
}

/** Commandes à relire, copiables mais jamais exécutées par l'outil. */
function PurgeCommands({ commands }: { commands: readonly string[] }): React.ReactElement {
  return (
    <div className="placard-purge__commands">
      <h4>Commands to run yourself</h4>
      <ol>
        {commands.map((command) => (
          <li key={command}>
            <code>{command}</code>
          </li>
        ))}
      </ol>
    </div>
  );
}

/** Script produit, et sécurité du fichier de remplacements. */
function PurgeArtifactSummary({ artifacts }: { artifacts: PurgeArtifacts }): React.ReactElement {
  return (
    <div className="placard-purge__artifacts">
      <p>
        Script: <code>{artifacts.scriptPath}</code>
      </p>
      <p>
        Replacements file: <code>{artifacts.replacementsPath}</code>{' '}
        {artifacts.secure ? '(outside the repository, mode 0600)' : '(WARNING: not secure — move it outside the repository)'}
      </p>
      <PurgeCommands commands={artifacts.commands} />
      <PurgeWarnings warnings={artifacts.warnings} />
    </div>
  );
}

/** Étape de purge complète : verrou, génération, artefacts. */
export function PurgeStep({ locked, lockReason, artifacts, onGenerate }: PurgeStepProps): React.ReactElement {
  const reason = lockReason ?? 'Rotate the secret first';
  return (
    <div className="placard-purge">
      <button type="button" disabled={locked} onClick={onGenerate} aria-describedby="placard-purge-lock">
        Generate the purge script
      </button>
      <p id="placard-purge-lock" className="placard-purge__lock">
        {locked ? `Locked: ${reason}. The purge cannot run before the rotation is done.` : 'Unlocked: the rotation is recorded.'}
      </p>
      {artifacts === null || artifacts === undefined ? null : <PurgeArtifactSummary artifacts={artifacts} />}
    </div>
  );
}
