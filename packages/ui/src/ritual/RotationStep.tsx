import React from 'react';
import type { RotationCard, RotateInput } from '@placard/core';

/**
 * Étape 1 — rotation (PLA-F-22).
 *
 * La fiche fournisseur dit **où** révoquer, **quoi** vérifier ensuite, et
 * pointe la documentation officielle. Pour une donnée personnelle, la rotation
 * est sans objet : on la déclare avec une raison, qui est conservée.
 *
 * Composant piloté par props : il ne décide de rien, il remonte l'intention.
 */
export interface RotationStepProps {
  card: RotationCard;
  onRotate: (input: RotateInput) => void;
  /** Rotation déjà faite ? */
  done: boolean;
}

/** Case « rotation faite » : un geste explicite, jamais déduit. */
function RotatedControl({ onRotate }: { onRotate: (input: RotateInput) => void }): React.ReactElement {
  const [by, setBy] = React.useState('');
  return (
    <div className="placard-rotation__confirm">
      <label className="placard-rotation__field">
        Who rotated it
        <input type="text" value={by} onChange={(event) => setBy(event.target.value)} placeholder="your name" />
      </label>
      <button type="button" disabled={by.trim() === ''} onClick={() => onRotate({ done: true, by: by.trim() })}>
        Mark rotation as done
      </button>
    </div>
  );
}

/** Déclaration « sans objet » : la raison est obligatoire et visible. */
function NotApplicableControl({ onRotate }: { onRotate: (input: RotateInput) => void }): React.ReactElement {
  const [reason, setReason] = React.useState('');
  return (
    <div className="placard-rotation__confirm">
      <label className="placard-rotation__field">
        Why rotation does not apply
        <input type="text" value={reason} onChange={(event) => setReason(event.target.value)} placeholder="personal data, no credential to rotate" />
      </label>
      <button
        type="button"
        disabled={reason.trim() === ''}
        onClick={() => onRotate({ done: false, notApplicable: true, reason: reason.trim() })}
      >
        Declare rotation not applicable
      </button>
    </div>
  );
}

/** Fiche fournisseur : où révoquer, quoi vérifier, documentation officielle. */
function RotationCardView({ card }: { card: RotationCard }): React.ReactElement {
  return (
    <div className="placard-rotation__card">
      <p className="placard-rotation__provider">
        <strong>{card.name}</strong> <code>{card.provider}</code>
      </p>
      <p className="placard-rotation__where">Revoke at: {card.whereToRevoke}</p>
      <a className="placard-rotation__doc" href={card.docUrl} rel="noreferrer noopener" target="_blank">
        Official documentation
      </a>
      <h4>Check afterwards</h4>
      <ul className="placard-rotation__checklist">
        {card.checklist.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
      {card.notice === undefined ? null : <p className="placard-rotation__notice">{card.notice}</p>}
    </div>
  );
}

/** Étape de rotation complète. */
export function RotationStep({ card, onRotate, done }: RotationStepProps): React.ReactElement {
  return (
    <div className="placard-rotation">
      <RotationCardView card={card} />
      {done ? (
        <p className="placard-rotation__done">Rotation recorded. The purge step is now unlocked.</p>
      ) : card.notApplicable ? (
        <NotApplicableControl onRotate={onRotate} />
      ) : (
        <RotatedControl onRotate={onRotate} />
      )}
    </div>
  );
}
