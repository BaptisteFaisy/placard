import { mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import {
  computeFingerprint,
  fakeValue,
  stringifyReport,
  type AnalysisProgress,
  type FindingFamily,
} from '@placard/core';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';

import { TEST_SALT, makeDetection, makeInput, makeOptions, presenceMap, shaFor } from './fixtures';
import { analyze, appendIgnoreEntry, loadIgnoreFile } from './index';

/** Familles couvertes par le test de non-divulgation. */
const ALL_FAMILIES: readonly FindingFamily[] = [
  'cloud-key',
  'platform-token',
  'private-key',
  'signed-token',
  'plaintext-password',
  'bank-data',
  'identity',
  'risky-file',
  'suspicious-string',
];

let dir = '';

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'placard-analysis-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

async function writeIgnoreFile(fingerprint: string, reason = 'rotated and revoked'): Promise<string> {
  const path = join(dir, '.placard', 'ignore.yml');
  await mkdir(join(dir, '.placard'), { recursive: true });
  await writeFile(
    path,
    [
      '# Placard ignore file',
      'ignore:',
      `  - fingerprint: ${fingerprint}`,
      '    rule: cloud-key-rule',
      `    reason: ${reason}`,
      '    author: alice',
      '    date: 2026-02-01T10:00:00Z',
      '',
    ].join('\n'),
    'utf8',
  );
  return path;
}

describe('analyze — assemblage du rapport', () => {
  it('produit un rapport validé par le schéma de core', async () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'a' }),
      makeDetection({ family: 'cloud-key', seed: 'a', path: 'src/b.ts', line: 4 }),
      makeDetection({ family: 'identity', seed: 'b' }),
    ];
    const result = await analyze(makeInput(detections), makeOptions());

    expect(result.rawDetections).toBe(3);
    expect(result.groups).toBe(2);
    expect(result.report.findings).toHaveLength(2);
    expect(result.report.schema).toBe('1.0.0');
    expect(result.report.tool).toEqual({ name: 'placard', version: '0.1.0-test' });
    expect(result.report.repo.name).toBe('haunted-repo');
    expect(result.report.skipped).toEqual({ binary: 0, tooLarge: 0 });
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('regroupe N emplacements en une trouvaille à N emplacements (PLA-F-06)', async () => {
    const detections = [0, 1, 2, 3].map((index) =>
      makeDetection({
        family: 'cloud-key',
        seed: 'multi',
        commitIndex: index,
        path: `src/file-${index}.ts`,
        line: index + 1,
      }),
    );
    const result = await analyze(makeInput(detections), makeOptions());

    expect(result.report.findings).toHaveLength(1);
    expect(result.report.findings[0]?.locations).toHaveLength(4);
  });

  it('attribue les identifiants dans l’ordre des empreintes (PLA-P-05)', async () => {
    const detections = [
      makeDetection({ family: 'identity', seed: 'i' }),
      makeDetection({ family: 'cloud-key', seed: 'c' }),
      makeDetection({ family: 'bank-data', seed: 'b' }),
    ];
    const result = await analyze(makeInput(detections), makeOptions());
    const byFingerprint = [...result.report.findings].sort((left, right) =>
      left.fingerprint < right.fingerprint ? -1 : 1,
    );
    expect(byFingerprint.map((finding) => finding.id)).toEqual(['sk_0001', 'sk_0002', 'sk_0003']);
  });

  it('reprend les commits d’introduction et de retrait fournis en entrée (PLA-P-03)', async () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 1, path: 'src/a.ts' }),
      makeDetection({ family: 'cloud-key', seed: 'l', commitIndex: 4, path: 'src/a.ts' }),
    ];
    const result = await analyze(makeInput(detections), makeOptions());
    const finding = result.report.findings[0];

    expect(finding?.introduced.commit).toBe(shaFor(1));
    expect(finding?.introduced.shortCommit).toBe(shaFor(1).slice(0, 7));
    expect(finding?.removed.map((commit) => commit.commit)).toEqual([shaFor(4)]);
    expect(finding?.inHead).toBe(false);
    const inputCommits = new Set(detections.map((detection) => detection.commit.commit));
    expect(inputCommits.has(finding!.introduced.commit)).toBe(true);
    for (const removed of finding!.removed) expect(inputCommits.has(removed.commit)).toBe(true);
  });

  it('décide inHead via headPresence et ajuste le score en conséquence', async () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'h', commitIndex: 0, path: 'src/a.ts' }),
      makeDetection({ family: 'cloud-key', seed: 'h', commitIndex: 2, path: 'src/a.ts' }),
    ];
    const absent = await analyze(makeInput(detections), makeOptions());
    const present = await analyze(
      makeInput(detections, { headPresence: presenceMap('src/a.ts') }),
      makeOptions(),
    );

    expect(absent.report.findings[0]?.inHead).toBe(false);
    expect(absent.report.findings[0]?.removed).toHaveLength(1);
    expect(present.report.findings[0]?.inHead).toBe(true);
    expect(present.report.findings[0]?.removed).toEqual([]);
    expect(present.report.findings[0]!.danger).toBeGreaterThanOrEqual(
      absent.report.findings[0]!.danger,
    );
  });

  it('propage les compteurs de fichiers ignorés', async () => {
    const result = await analyze(
      makeInput([makeDetection({ family: 'cloud-key', seed: 's' })], {
        skipped: { binary: 3, tooLarge: 1 },
      }),
      makeOptions(),
    );
    expect(result.report.skipped).toEqual({ binary: 3, tooLarge: 1 });
  });

  it('caviarde l’aperçu, l’empreinte et les extraits (PLA-F-08)', async () => {
    const detection = makeDetection({ family: 'cloud-key', seed: 'p', rawContext: true });
    const value = detection.detection.value;
    const result = await analyze(makeInput([detection]), makeOptions());
    const finding = result.report.findings[0];

    expect(finding?.fingerprint).toBe(computeFingerprint(value, TEST_SALT));
    expect(finding?.preview).not.toBe(value);
    expect(finding?.preview.length).toBeLessThan(value.length);
    expect(finding?.locations[0]?.snippet).toContain('[REDACTED:cloud-key]');
    expect(finding?.locations[0]?.snippet).not.toContain(value);
  });

  it('émet la progression de l’analyse (PLA-F-12)', async () => {
    const events: AnalysisProgress[] = [];
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'a' }),
      makeDetection({ family: 'identity', seed: 'b' }),
    ];
    await analyze(
      makeInput(detections),
      makeOptions({ onProgress: (progress) => events.push(progress) }),
    );

    expect(events.map((event) => event.kind)).toEqual([
      'scanning',
      'grouping',
      'scoring',
      'scoring',
      'report',
    ]);
    expect(events.at(-1)).toEqual({ kind: 'report', findings: 2 });
  });
});

describe('analyze — non-divulgation (PLA-P-01)', () => {
  it('n’expose aucune valeur détectée dans le rapport sérialisé', async () => {
    const detections = ALL_FAMILIES.map((family, index) =>
      makeDetection({ family, seed: `leak-${family}`, commitIndex: index, rawContext: true }),
    );
    const result = await analyze(makeInput(detections), makeOptions());
    const serialized = stringifyReport(result.report);

    expect(result.report.findings).toHaveLength(ALL_FAMILIES.length);
    for (const detection of detections) {
      const value = detection.detection.value;
      const escaped = JSON.stringify(value).slice(1, -1);
      expect(serialized).not.toContain(value);
      expect(serialized).not.toContain(escaped);
    }
  });

  it('ne journalise rien pendant l’analyse', async () => {
    const value = fakeValue('cloud-key', 'silence');
    const spies = [
      vi.spyOn(console, 'log').mockImplementation(() => undefined),
      vi.spyOn(console, 'warn').mockImplementation(() => undefined),
      vi.spyOn(console, 'error').mockImplementation(() => undefined),
      vi.spyOn(console, 'info').mockImplementation(() => undefined),
      vi.spyOn(process.stdout, 'write').mockImplementation(() => true),
    ];
    try {
      await analyze(makeInput([makeDetection({ family: 'cloud-key', value, rawContext: true })]), makeOptions());
      for (const spy of spies) {
        for (const call of spy.mock.calls) {
          expect(JSON.stringify(call)).not.toContain(value);
        }
      }
    } finally {
      for (const spy of spies) spy.mockRestore();
    }
  });
});

describe('analyze — déterminisme et stabilité', () => {
  it('deux analyses du même jeu donnent le même rapport (PLA-P-05)', async () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'a', commitIndex: 0 }),
      makeDetection({ family: 'identity', seed: 'b', commitIndex: 1, path: 'src/b.ts' }),
      makeDetection({ family: 'cloud-key', seed: 'a', commitIndex: 2, path: 'src/c.ts' }),
    ];
    const first = await analyze(makeInput(detections), makeOptions());
    const second = await analyze(makeInput(detections), makeOptions());
    expect(stringifyReport(second.report)).toBe(stringifyReport(first.report));
  });

  it('un commit sans secret ne change aucune trouvaille (PLA-P-12)', async () => {
    const detections = [
      makeDetection({ family: 'cloud-key', seed: 'a', commitIndex: 0 }),
      makeDetection({ family: 'bank-data', seed: 'b', commitIndex: 2, path: 'src/b.ts' }),
    ];
    const before = await analyze(makeInput(detections), makeOptions());
    const after = await analyze(
      makeInput(detections, {
        repoMeta: {
          name: 'haunted-repo',
          head: shaFor(19),
          totalCommits: 11,
          publicRemote: false,
          analyzedAt: '2026-02-01T00:00:00.000Z',
        },
        headPresence: presenceMap('README.md'),
      }),
      makeOptions(),
    );

    expect(after.report.repo.totalCommits).toBe(11);
    expect(after.report.findings).toEqual(before.report.findings);
  });
});

describe('analyze — exclusions (PLA-F-09, PLA-P-08)', () => {
  it('marque une empreinte listée comme ignorée, avec raison, auteur et date', async () => {
    const value = fakeValue('cloud-key', 'ignored');
    const fingerprint = computeFingerprint(value, TEST_SALT);
    const ignoreFile = await writeIgnoreFile(fingerprint);

    const result = await analyze(
      makeInput([makeDetection({ family: 'cloud-key', value }), makeDetection({ family: 'identity', seed: 'x' })]),
      makeOptions({ ignoreFile }),
    );
    const ignored = result.report.findings.find((finding) => finding.fingerprint === fingerprint);
    const open = result.report.findings.filter((finding) => finding.state === 'open');

    expect(ignored?.state).toBe('ignored');
    expect(ignored?.ignoreReason).toContain('rotated and revoked');
    expect(ignored?.ignoreReason).toContain('alice');
    expect(ignored?.ignoreReason).toContain('2026-02-01T10:00:00Z');
    expect(open).toHaveLength(1);
  });

  it('une empreinte écartée n’est plus ouverte à l’analyse suivante (PLA-P-08)', async () => {
    const value = fakeValue('cloud-key', 'ignored-later');
    const fingerprint = computeFingerprint(value, TEST_SALT);
    const detections = [makeDetection({ family: 'cloud-key', value })];
    const ignoreFile = join(dir, '.placard', 'ignore.yml');

    const before = await analyze(makeInput(detections), makeOptions({ ignoreFile }));
    expect(before.report.findings[0]?.state).toBe('open');

    await appendIgnoreEntry(ignoreFile, {
      fingerprint,
      rule: 'cloud-key-rule',
      reason: 'accepted risk',
      author: 'bob',
      date: '2026-03-01T00:00:00Z',
    });

    const after = await analyze(makeInput(detections), makeOptions({ ignoreFile }));
    expect(after.report.findings.every((finding) => finding.state !== 'open')).toBe(true);
    expect(after.report.findings[0]?.ignoreReason).toContain('accepted risk');
    expect((await loadIgnoreFile(ignoreFile)).get(fingerprint)?.author).toBe('bob');
  });
});
