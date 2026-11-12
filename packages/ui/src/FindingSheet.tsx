import React from 'react';
import { familyLabel, severityOf, stateLabel } from '@placard/core';
import type { Finding } from '@placard/core';
import { formatLongDate, humanizeDays } from '@placard/manor-model';

import { SeverityMark } from './a11y/SeverityMark';
import { Skeleton } from './illustrations/Skeleton';
import { lifetimeDaysOf } from './sheet-data';

/**
 * La fiche d'une trouvaille (PLA-F-16).
 *
 * Fond uni, contraste AA, **jamais de valeur brute** : seul `preview` est
 * affiché, et il est déjà caviardé par le moteur (`redactPreview`). La fiche
 * montre le score **et ses raisons** : un danger inexplicable n'est pas un
 * danger qu'on peut traiter.
 */

export interface FindingSheetProps {
  finding: Finding;
  onClose: () => void;
  /** Date de référence pour la durée de vie ; défaut : maintenant. */
  now?: Date;
}

/** En-tête : famille, squelette, état. */
function SheetHeading({ finding }: { finding: Finding }): React.ReactElement {
  return (
    <header className="placard-sheet__head">
      <svg className="placard-sheet__figure" viewBox="0 0 40 56" width="40" height="56" aria-hidden="true">
        <Skeleton family={finding.family} danger={finding.danger} severity={severityOf(finding.danger)} scale={1} />
      </svg>
      <div>
        <h2 className="placard-sheet__title">{familyLabel(finding.family)}</h2>
        <p className="placard-sheet__preview" data-testid="placard-sheet-preview">
          Masked preview: <code>{finding.preview}</code>
        </p>
      </div>
    </header>
  );
}

/** Score de danger et ses raisons, une par ligne. */
function ScoreBlock({ finding }: { finding: Finding }): React.ReactElement {
  return (
    <section className="placard-sheet__section" aria-label="Danger score">
      <h3>Danger {finding.danger} out of 100</h3>
      <SeverityMark severity={severityOf(finding.danger)} />
      <ul className="placard-sheet__reasons" data-testid="placard-sheet-reasons">
        {finding.reasons.map((reason) => (
          <li key={reason}>{reason}</li>
        ))}
      </ul>
    </section>
  );
}

/** Emplacements connus, avec leur commit. */
function LocationsBlock({ finding }: { finding: Finding }): React.ReactElement {
  return (
    <section className="placard-sheet__section" aria-label="Locations">
      <h3>Locations</h3>
      <ul className="placard-sheet__locations">
        {finding.locations.map((location) => (
          <li key={`${location.commit}-${location.path}-${location.line}`}>
            <code>{location.path}</code> line {location.line} — commit {location.commit.slice(0, 7)}
          </li>
        ))}
      </ul>
    </section>
  );
}

/** Extrait de contexte, déjà caviardé par le moteur ; absent s'il est vide. */
function SnippetBlock({ finding }: { finding: Finding }): React.ReactElement | null {
  const snippet = finding.locations.find((location) => (location.snippet ?? '') !== '')?.snippet;
  if (snippet === undefined) return null;
  return (
    <section className="placard-sheet__section" aria-label="Context">
      <h3>Context</h3>
      <pre className="placard-sheet__snippet">{snippet}</pre>
    </section>
  );
}

/** Fiche complète : en-tête, score, emplacements, contexte, état, fermeture. */
export function FindingSheet({ finding, onClose, now }: FindingSheetProps): React.ReactElement {
  const days = lifetimeDaysOf(finding, now ?? new Date());
  return (
    <div
      className="placard-sheet"
      role="dialog"
      aria-modal="false"
      aria-label={`Finding sheet: ${familyLabel(finding.family)}`}
      data-finding={finding.id}
    >
      <button type="button" className="placard-sheet__close" onClick={onClose}>
        Close
      </button>
      <SheetHeading finding={finding} />
      <p className="placard-sheet__meta">
        State: {stateLabel(finding.state)} · {finding.inHead ? 'still standing in current code' : 'absent from current code'} ·{' '}
        {finding.removed.length === 0 ? 'never removed' : `removed in ${finding.removed.length} commit(s)`}
      </p>
      <ScoreBlock finding={finding} />
      <section className="placard-sheet__section" aria-label="Lifetime">
        <h3>Lifetime</h3>
        <p>
          Introduced {formatLongDate(finding.introduced.date)} — lived {humanizeDays(days)}
        </p>
      </section>
      <LocationsBlock finding={finding} />
      <SnippetBlock finding={finding} />
      <p className="placard-sheet__rule">Rule: {finding.rule}</p>
    </div>
  );
}
