import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

import { fakeValue } from '@placard/core';
import type { Finding } from '@placard/core';
import { describe, expect, it } from 'vitest';

import { BADGE_FILE, CERTIFICATE_FILE, certificate } from './certificate.js';
import { fakeFinding, findingFor, makeOptions } from './test-support.js';

const VALUE = fakeValue('cloud-key', 'certificate-seed');

async function writeReport(dir: string, findings: Finding[]): Promise<string> {
  const { mkdir, writeFile } = await import('node:fs/promises');
  await mkdir(dir, { recursive: true });
  const path = join(dir, 'report.json');
  const report = {
    schema: '1.0.0',
    tool: { name: 'placard', version: '0.1.0' },
    repo: {
      name: 'haunted-repo',
      head: 'f'.repeat(40),
      totalCommits: 42,
      publicRemote: true,
      analyzedAt: '2026-11-11T09:00:00.000Z',
    },
    findings,
    skipped: { binary: 0, tooLarge: 0 },
  };
  await writeFile(path, JSON.stringify(report), 'utf8');
  return path;
}

describe('certificate', () => {
  it('writes PLACARD.md and its badge next to the ritual state', async () => {
    const options = await makeOptions();
    const reportPath = await writeReport(options.tmpDir, []);
    const result = await certificate(options, { reportPath, treated: 3, dismissed: 1, open: 0 });
    expect(result.markdownPath).toBe(join(options.placardDir, CERTIFICATE_FILE));
    expect(result.badgeSvgPath).toBe(join(options.placardDir, BADGE_FILE));
    expect(await readFile(result.markdownPath, 'utf8')).toBe(result.markdown);
    expect(await readFile(result.badgeSvgPath, 'utf8')).toBe(result.badgeSvg);
  });

  it('states the date, the analysed commit, the counts and the tool version', async () => {
    const options = await makeOptions();
    const reportPath = await writeReport(options.tmpDir, []);
    const result = await certificate(options, { reportPath, treated: 3, dismissed: 1, open: 0 });
    expect(result.markdown).toMatch(/^\| Issued \| \d{4}-\d{2}-\d{2}T/m);
    expect(result.markdown).toContain('f'.repeat(40));
    expect(result.markdown).toContain('haunted-repo');
    expect(result.markdown).toContain('| Findings treated | 3 |');
    expect(result.markdown).toContain('| Findings dismissed | 1 |');
    expect(result.markdown).toContain('| Findings still open | 0 |');
    expect(result.markdown).toContain('placard 0.1.0');
  });

  it('says what it does not cover', async () => {
    const options = await makeOptions();
    const reportPath = await writeReport(options.tmpDir, []);
    const result = await certificate(options, { reportPath, treated: 0, dismissed: 0, open: 2 });
    expect(result.markdown).toContain('## What this certificate does not cover');
    expect(result.markdown).toMatch(/does not prove that the credential was rotated/);
    expect(result.markdown).toMatch(/not a legal or compliance attestation/);
    expect(result.markdown).toMatch(/forks/);
  });

  it('seals the badge when nothing is left open', async () => {
    const options = await makeOptions();
    const reportPath = await writeReport(options.tmpDir, []);
    const result = await certificate(options, { reportPath, treated: 5, dismissed: 0, open: 0 });
    expect(result.markdown).toContain('| Status | sealed |');
    expect(result.badgeSvg).toContain('sealed');
    expect(result.badgeSvg).toMatch(/^<svg xmlns="http:\/\/www\.w3\.org\/2000\/svg"/);
  });

  it('shows the number of open findings on the badge', async () => {
    const options = await makeOptions();
    const reportPath = await writeReport(options.tmpDir, []);
    const result = await certificate(options, { reportPath, treated: 2, dismissed: 0, open: 4 });
    expect(result.markdown).toContain('| Status | open |');
    expect(result.badgeSvg).toContain('4 open');
  });

  it('carries no secret, even when the report lists findings', async () => {
    const options = await makeOptions();
    const reportPath = await writeReport(options.tmpDir, [findingFor(VALUE)]);
    const result = await certificate(options, { reportPath, treated: 1, dismissed: 0, open: 1 });
    expect(result.markdown).not.toContain(VALUE);
    expect(result.badgeSvg).not.toContain(VALUE);
    expect(result.markdown).not.toMatch(/AKIA/);
  });

  it('still issues a certificate when the report cannot be read', async () => {
    const options = await makeOptions();
    const result = await certificate(options, {
      reportPath: join(options.tmpDir, 'missing.json'),
      treated: 1,
      dismissed: 0,
      open: 0,
    });
    expect(result.markdown).toContain('| Analyzed commit | unavailable |');
  });

  it('accepts any finding counts without inventing content', async () => {
    const options = await makeOptions();
    const reportPath = await writeReport(options.tmpDir, [fakeFinding()]);
    const result = await certificate(options, { reportPath, treated: 9, dismissed: 4, open: 0 });
    expect(result.markdown).toContain('| Findings treated | 9 |');
    expect(result.badgeSvg).toContain('<title>placard: sealed</title>');
  });
});
