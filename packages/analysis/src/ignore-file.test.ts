import { mkdir, mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

import { computeFingerprint, fakeValue } from '@placard/core';
import { afterEach, beforeEach, describe, expect, it } from 'vitest';

import { TEST_SALT } from './fixtures.js';
import { IgnoreFileError, appendIgnoreEntry, loadIgnoreFile, parseIgnoreText } from './ignore-file.js';

const FINGERPRINT_A = computeFingerprint(fakeValue('cloud-key', 'ignore-a'), TEST_SALT);
const FINGERPRINT_B = computeFingerprint(fakeValue('cloud-key', 'ignore-b'), TEST_SALT);

let dir = '';

beforeEach(async () => {
  dir = await mkdtemp(join(tmpdir(), 'placard-ignore-'));
});

afterEach(async () => {
  await rm(dir, { recursive: true, force: true });
});

function ignorePath(): string {
  return join(dir, '.placard', 'ignore.yml');
}

/** Écrit un fichier d'exclusions, dossier créé au besoin. */
async function writeIgnore(text: string): Promise<void> {
  await mkdir(join(dir, '.placard'), { recursive: true });
  await writeFile(ignorePath(), text, 'utf8');
}

describe('loadIgnoreFile', () => {
  it('retourne une carte vide sans chemin', async () => {
    expect((await loadIgnoreFile(undefined)).size).toBe(0);
  });

  it('retourne une carte vide quand le fichier n’existe pas', async () => {
    expect((await loadIgnoreFile(join(dir, 'absent.yml'))).size).toBe(0);
  });

  it('lit les empreintes et leurs métadonnées', async () => {
    await writeIgnore(
      [
        'ignore:',
        `  - fingerprint: ${FINGERPRINT_A}`,
        '    rule: cloud-key-rule',
        '    reason: rotated and revoked',
        '    author: alice',
        '    date: 2026-02-01T10:00:00Z',
        '',
      ].join('\n'),
    );
    const map = await loadIgnoreFile(ignorePath());
    expect(map.size).toBe(1);
    expect(map.get(FINGERPRINT_A)).toEqual({
      fingerprint: FINGERPRINT_A,
      rule: 'cloud-key-rule',
      reason: 'rotated and revoked',
      author: 'alice',
      date: '2026-02-01T10:00:00Z',
    });
  });

  it('accepte un fichier vide ou sans clé ignore', async () => {
    expect(parseIgnoreText('').size).toBe(0);
    expect(parseIgnoreText('# rien à ignorer\n').size).toBe(0);
  });

  it('refuse un YAML invalide', () => {
    expect(() => parseIgnoreText('ignore: [unclosed')).toThrow(IgnoreFileError);
  });

  it('refuse une racine ignore qui n’est pas une liste', () => {
    expect(() => parseIgnoreText('ignore: nope\n')).toThrow(/must be a list/);
  });

  it('refuse une entrée sans raison', () => {
    expect(() => parseIgnoreText(`ignore:\n  - fingerprint: ${FINGERPRINT_A}\n`)).toThrow(
      /needs a "fingerprint" and a "reason"/,
    );
  });
});

describe('appendIgnoreEntry (PLA-F-29)', () => {
  it('crée le fichier et son dossier au besoin', async () => {
    await appendIgnoreEntry(ignorePath(), {
      fingerprint: FINGERPRINT_A,
      rule: 'cloud-key-rule',
      reason: 'rotated',
      author: 'bob',
      date: '2026-02-02T00:00:00Z',
    });
    const text = await readFile(ignorePath(), 'utf8');
    expect(text).toContain('Placard ignore file.');
    const map = await loadIgnoreFile(ignorePath());
    expect(map.get(FINGERPRINT_A)?.reason).toBe('rotated');
    expect(map.get(FINGERPRINT_A)?.author).toBe('bob');
  });

  it('n’écrase pas les entrées existantes et conserve les commentaires', async () => {
    const initial = [
      '# commentaire à conserver',
      'ignore:',
      '  # première exclusion',
      `  - fingerprint: ${FINGERPRINT_A}`,
      '    reason: rotated',
      '    author: alice',
      '    date: 2026-02-01T10:00:00Z',
      '',
    ].join('\n');
    await writeIgnore(initial);

    await appendIgnoreEntry(ignorePath(), {
      fingerprint: FINGERPRINT_B,
      reason: 'false positive in documentation',
      author: 'bob',
      date: '2026-03-01T00:00:00Z',
    });

    const text = await readFile(ignorePath(), 'utf8');
    expect(text).toContain('# commentaire à conserver');
    expect(text).toContain('# première exclusion');
    const map = await loadIgnoreFile(ignorePath());
    expect(map.size).toBe(2);
    expect(map.get(FINGERPRINT_A)?.reason).toBe('rotated');
    expect(map.get(FINGERPRINT_B)?.reason).toBe('false positive in documentation');
  });

  it('conserve les commentaires d’un fichier sans clé ignore', async () => {
    await writeIgnore('# notes de l’équipe\n');
    await appendIgnoreEntry(ignorePath(), {
      fingerprint: FINGERPRINT_A,
      reason: 'rotated',
      author: 'bob',
      date: '2026-02-02T00:00:00Z',
    });
    const text = await readFile(ignorePath(), 'utf8');
    expect(text).toContain('# notes de l’équipe');
    expect((await loadIgnoreFile(ignorePath())).size).toBe(1);
  });

  it('accepte une clé ignore vide', async () => {
    await writeIgnore('ignore:\n');
    await appendIgnoreEntry(ignorePath(), {
      fingerprint: FINGERPRINT_A,
      reason: 'rotated',
      author: 'bob',
      date: '2026-02-02T00:00:00Z',
    });
    expect((await loadIgnoreFile(ignorePath())).get(FINGERPRINT_A)?.author).toBe('bob');
  });

  it('refuse une raison vide', async () => {
    await expect(
      appendIgnoreEntry(ignorePath(), {
        fingerprint: FINGERPRINT_A,
        reason: '   ',
        author: 'bob',
        date: '2026-02-02T00:00:00Z',
      }),
    ).rejects.toThrow(/non-empty reason/);
  });

  it('refuse une empreinte vide', async () => {
    await expect(
      appendIgnoreEntry(ignorePath(), {
        fingerprint: ' ',
        reason: 'rotated',
        author: 'bob',
        date: '2026-02-02T00:00:00Z',
      }),
    ).rejects.toThrow(/needs a fingerprint/);
  });

  it('garde la dernière entrée quand une empreinte apparaît deux fois', async () => {
    const entry = {
      fingerprint: FINGERPRINT_A,
      reason: 'rotated',
      author: 'bob',
      date: '2026-02-02T00:00:00Z',
    };
    await appendIgnoreEntry(ignorePath(), entry);
    await appendIgnoreEntry(ignorePath(), entry);
    const map = await loadIgnoreFile(ignorePath());
    expect(map.size).toBe(1);
  });
});
