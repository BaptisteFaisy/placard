import React from 'react';
import { describe, expect, it } from 'vitest';
import { within } from '@testing-library/dom';
import type { PreventionProposal, PurgeArtifacts, RitualStep, RotationCard } from '@placard/core';

import { RitualPanel, stepOf } from './RitualPanel.js';
import { Hall } from './Hall.js';
import { Legend, COSTUME_LEGEND } from './Legend.js';
import { demoModel } from './testing/model.js';
import { audit } from './testing/axe.js';
import { click, mount, type as typeText } from './testing/render.js';

/**
 * Le rituel (PLA-F-22 à PLA-F-28), le hall (PLA-F-20) et la légende (PLA-F-15).
 *
 * Le panneau ne calcule aucun verrou : les étapes viennent du métier. Ce que
 * ces tests garantissent, c'est que l'interface **rend fidèlement** ce que le
 * métier a décidé — en particulier que la purge reste verrouillée.
 */

const ROTATION: RotationCard = {
  provider: 'aws-access-key',
  name: 'Amazon Web Services',
  whereToRevoke: 'IAM → Users → Security credentials → Deactivate access key',
  docUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html',
  checklist: ['Create a replacement key', 'Confirm the old key is refused'],
  notApplicable: false,
};

const PURGE: PurgeArtifacts = {
  scriptPath: '.placard/purge-001.sh',
  replacementsPath: '/tmp/placard/replacements-001.txt',
  secure: true,
  commands: ['git filter-repo --replace-text /tmp/placard/replacements-001.txt', 'git push --force-with-lease'],
  warnings: ['Force-pushing rewrites commit ids: tell your collaborators first.'],
};

const PREVENTION: PreventionProposal = {
  gitignoreLines: ['*.env', '*.pem'],
  preCommitHook: '#!/bin/sh\nplacard scan --staged\n',
  hookPath: '.git/hooks/pre-commit',
  reminders: ['Enable push protection on the remote host.'],
};

/** Étapes telles que les construirait le métier : purge verrouillée avant rotation. */
function lockedSteps(): RitualStep[] {
  return [
    { id: 'rotate', title: 'Rotate the secret', description: 'Revoke then reissue.', locked: false, done: false },
    {
      id: 'purge',
      title: 'Purge the history',
      description: 'Rewrite the commits.',
      locked: true,
      lockReason: 'Rotate the secret first',
      done: false,
    },
    { id: 'prevent', title: 'Prevent the next one', description: 'Ignore and hook.', locked: true, lockReason: 'Purge first', done: false },
    { id: 'verify', title: 'Verify and certify', description: 'Scan again.', locked: true, lockReason: 'Prevent first', done: false },
  ];
}

/** Mêmes étapes, une fois la rotation faite. */
function rotatedSteps(): RitualStep[] {
  const steps = lockedSteps();
  return steps.map((step) => {
    if (step.id === 'rotate') return { ...step, done: true, doneAt: '2026-11-11T10:00:00Z' };
    if (step.id === 'purge') return { ...step, locked: false, lockReason: undefined };
    return step;
  });
}

describe('rituel : ordre imposé et purge verrouillée', () => {
  it('affiche les quatre étapes dans l’ordre', () => {
    const view = mount(
      <RitualPanel
        steps={lockedSteps()}
        rotation={ROTATION}
        onRotate={() => undefined}
        onGeneratePurge={() => undefined}
        onApplyPrevention={() => undefined}
        onVerify={() => undefined}
        onCertificate={() => undefined}
      />,
    );
    const steps = [...view.container.querySelectorAll('.placard-ritual__step')];
    expect(steps.map((step) => step.getAttribute('data-step'))).toEqual(['rotate', 'purge', 'prevent', 'verify']);
  });

  it('désactive la purge tant que la rotation n’est pas faite, avec la raison visible', () => {
    const view = mount(
      <RitualPanel
        steps={lockedSteps()}
        rotation={ROTATION}
        onRotate={() => undefined}
        onGeneratePurge={() => undefined}
        onApplyPrevention={() => undefined}
        onVerify={() => undefined}
        onCertificate={() => undefined}
      />,
    );
    const button = within(view.container).getByRole('button', { name: 'Generate the purge script' });
    expect(button.hasAttribute('disabled')).toBe(true);
    const text = view.container.textContent ?? '';
    expect(text).toContain('Locked: Rotate the secret first');
    expect(text).toContain('cannot run before the rotation');
  });

  it('déverrouille la purge une fois la rotation enregistrée', () => {
    const view = mount(
      <RitualPanel
        steps={rotatedSteps()}
        rotation={ROTATION}
        onRotate={() => undefined}
        onGeneratePurge={() => undefined}
        onApplyPrevention={() => undefined}
        onVerify={() => undefined}
        onCertificate={() => undefined}
      />,
    );
    const button = within(view.container).getByRole('button', { name: 'Generate the purge script' });
    expect(button.hasAttribute('disabled')).toBe(false);
    expect(view.container.textContent).toContain('Unlocked: the rotation is recorded.');
  });

  it('remonte l’intention de rotation sans l’exécuter', async () => {
    const inputs: unknown[] = [];
    const view = mount(
      <RitualPanel
        steps={lockedSteps()}
        rotation={ROTATION}
        onRotate={(input) => inputs.push(input)}
        onGeneratePurge={() => undefined}
        onApplyPrevention={() => undefined}
        onVerify={() => undefined}
        onCertificate={() => undefined}
      />,
    );
    const confirm = within(view.container).getByRole('button', { name: 'Mark rotation as done' });
    expect(confirm.hasAttribute('disabled')).toBe(true);
    const field = within(view.container).getByRole('textbox', { name: 'Who rotated it' }) as HTMLInputElement;
    await typeText(field, 'ada');
    await click(confirm);
    expect(inputs).toEqual([{ done: true, by: 'ada' }]);
  });

  it('propose la fiche fournisseur : où révoquer et quoi vérifier', () => {
    const view = mount(
      <RitualPanel
        steps={lockedSteps()}
        rotation={ROTATION}
        onRotate={() => undefined}
        onGeneratePurge={() => undefined}
        onApplyPrevention={() => undefined}
        onVerify={() => undefined}
        onCertificate={() => undefined}
      />,
    );
    const text = view.container.textContent ?? '';
    expect(text).toContain('Amazon Web Services');
    expect(text).toContain('IAM → Users → Security credentials');
    expect(text).toContain('Create a replacement key');
    const link = within(view.container).getByRole('link', { name: 'Official documentation' });
    expect(link.getAttribute('href')).toBe(ROTATION.docUrl);
  });

});

describe('rituel : script, prévention et vérification', () => {
  it('affiche les commandes à relire, jamais exécutées par l’outil', () => {
    const view = mount(
      <RitualPanel
        steps={rotatedSteps()}
        rotation={ROTATION}
        purge={PURGE}
        onRotate={() => undefined}
        onGeneratePurge={() => undefined}
        onApplyPrevention={() => undefined}
        onVerify={() => undefined}
        onCertificate={() => undefined}
      />,
    );
    const text = view.container.textContent ?? '';
    expect(text).toContain('git filter-repo --replace-text');
    expect(text).toContain('Force-pushing rewrites commit ids');
    expect(text).toContain('mode 0600');
  });

  it('affiche la prévention proposée et le résultat de vérification', () => {
    const view = mount(
      <RitualPanel
        steps={rotatedSteps()}
        rotation={ROTATION}
        prevention={PREVENTION}
        verification={{ verifiedAt: '2026-11-11T11:00:00Z', stillFound: false, reportPath: 'report.json' }}
        certificatePath="PLACARD.md"
        onRotate={() => undefined}
        onGeneratePurge={() => undefined}
        onApplyPrevention={() => undefined}
        onVerify={() => undefined}
        onCertificate={() => undefined}
      />,
    );
    const text = view.container.textContent ?? '';
    expect(text).toContain('*.env');
    expect(text).toContain('.git/hooks/pre-commit');
    expect(text).toContain('Enable push protection');
    expect(text).toContain('No longer found by the latest scan');
    expect(text).toContain('PLACARD.md');
  });

  it('retrouve une étape par identifiant sans jeter', () => {
    expect(stepOf(lockedSteps(), 'purge')?.locked).toBe(true);
    expect(stepOf([], 'verify')).toBeUndefined();
  });
});

describe('hall et légende', () => {
  it('résume le hall : total, debout, gravités, familles, scellées, écartées', () => {
    const model = demoModel();
    const view = mount(<Hall hall={model.hall} repoName={model.repo.name} />);
    const text = view.container.textContent ?? '';
    expect(text).toContain('Total findings');
    expect(text).toContain('Standing in the hall');
    expect(text).toContain('Sealed');
    expect(text).toContain('Dismissed');
    expect(text).toContain('public remote');
    expect(within(view.container).getByRole('region', { name: 'Entrance hall summary' })).toBeTruthy();
  });

  it('rend la légende complète de la table C.4', () => {
    const view = mount(<Legend open onClose={() => undefined} />);
    const text = view.container.textContent ?? '';
    for (const entry of COSTUME_LEGEND) {
      expect(text).toContain(entry.element);
    }
    expect(text).toContain('A red wax seal on a door');
    expect(text).toContain('The lantern');
    expect(COSTUME_LEGEND.length).toBe(15);
  });

  it('ne rend rien quand la légende est fermée', () => {
    const view = mount(<Legend open={false} onClose={() => undefined} />);
    expect(view.container.querySelector('.placard-legend')).toBeNull();
  });

  it('reste sans violation axe sur le rituel et la légende', async () => {
    const ritual = mount(
      <RitualPanel
        steps={rotatedSteps()}
        rotation={ROTATION}
        purge={PURGE}
        prevention={PREVENTION}
        onRotate={() => undefined}
        onGeneratePurge={() => undefined}
        onApplyPrevention={() => undefined}
        onVerify={() => undefined}
        onCertificate={() => undefined}
      />,
    );
    expect(await audit(ritual.container)).toEqual([]);
    const legend = mount(<Legend open onClose={() => undefined} />);
    expect(await audit(legend.container)).toEqual([]);
  });
});
