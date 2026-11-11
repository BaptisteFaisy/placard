import { describe, expect, it } from 'vitest';
import { render } from '@testing-library/react';
import React from 'react';
import axe from 'axe-core';

import { createManorModel } from '@placard/manor-model';
import { Manor, Registry, Hall, Legend, FindingSheet, RitualPanel } from './index.js';
import { makeFinding, makeReport, refOf } from './testing/fixtures.js';

describe('a11y — conformité WCAG AA (PLA-F-21, PLA-N-05)', () => {
  const report = makeReport(
    [
      makeFinding({ id: 1, family: 'cloud-key', danger: 90, inHead: true, introduced: refOf('c1', '2024-03-11') }),
      makeFinding({ id: 2, family: 'bank-data', danger: 70, inHead: false, introduced: refOf('c2', '2023-07-04') }),
    ],
    { name: 'a11y-fixture-repo', totalCommits: 42, publicRemote: true },
  );
  const model = createManorModel();
  const viewModel = model.buildViewModel(report, model.emptyFilter());

  async function assertNoSevereViolations(container: HTMLElement): Promise<void> {
    const results = await axe.run(container, {
      runOnly: { type: 'tag', values: ['wcag2a', 'wcag2aa'] },
    });
    const severe = results.violations.filter((v) => v.impact === 'critical' || v.impact === 'serious');
    expect(severe).toHaveLength(0);
  }

  it('le manoir ne présente aucune violation d’accessibilité critique/sérieuse', async () => {
    const { container } = render(<Manor model={viewModel} onSelectFinding={() => {}} />);
    await assertNoSevereViolations(container);
  });

  it('le registre ne présente aucune violation d’accessibilité critique/sérieuse', async () => {
    const { container } = render(
      <Registry model={viewModel} sort={{ field: 'danger', direction: 'desc' }} onSortChange={() => {}} onSelect={() => {}} />,
    );
    await assertNoSevereViolations(container);
  });

  it('le hall, la légende et la fiche respectent WCAG AA', async () => {
    const finding = viewModel.findings[0]!;
    const { container: hallEl } = render(<Hall hall={viewModel.hall} repoName="a11y-fixture-repo" />);
    const { container: legendEl } = render(<Legend open onClose={() => {}} />);
    const { container: sheetEl } = render(<FindingSheet finding={finding} onClose={() => {}} />);
    await assertNoSevereViolations(hallEl);
    await assertNoSevereViolations(legendEl);
    await assertNoSevereViolations(sheetEl);
  });

  it('le panneau de rituel avec ses verrous respecte WCAG AA', async () => {
    const steps = [
      { id: 'rotate' as const, title: 'Rotate secret', description: 'Revoke key with provider', locked: false, done: false },
      { id: 'purge' as const, title: 'Purge history', description: 'Run git-filter-repo', locked: true, lockReason: 'Rotate the secret first', done: false },
      { id: 'prevent' as const, title: 'Prevent recurrence', description: 'Install pre-commit hook', locked: true, done: false },
      { id: 'verify' as const, title: 'Verify remediation', description: 'Re-scan repository', locked: true, done: false },
    ];
    const rotation = {
      provider: 'aws',
      name: 'Amazon Web Services',
      whereToRevoke: 'IAM Console → Access keys',
      docUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html',
      checklist: ['Revoke old key', 'Verify last used date'],
      notApplicable: false,
    };
    const { container } = render(
      <RitualPanel
        steps={steps}
        rotation={rotation}
        onRotate={() => {}}
        onGeneratePurge={() => {}}
        onApplyPrevention={() => {}}
        onVerify={() => {}}
        onCertificate={() => {}}
      />,
    );
    await assertNoSevereViolations(container);
  });
});
