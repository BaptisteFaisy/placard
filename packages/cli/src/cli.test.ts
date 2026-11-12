import { describe, expect, it } from 'vitest';
import { mkdtemp, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';
import { cli } from './wire';
import { parseArgs } from './args';

describe('cli commands & args', () => {
  it('parseArgs comprend scan et les drapeaux', () => {
    const res = parseArgs(['scan', '.', '--fail-on-open', '--json']);
    expect(res.command).toBe('scan');
    expect(res.positional[0]).toBe('.');
    expect(res.flags['fail-on-open']).toBe(true);
    expect(res.flags['json']).toBe(true);
  });

  it('selftest analyse le dépôt courant sans planter', async () => {
    const res = await cli.selftest();
    expect(res.exitCode).toBe(0);
    expect(res.reportPath).toBeDefined();
  });
});

describe('demo --target', () => {
  it('écrit le dépôt synthétique là où on le demande', async () => {
    const dir = await mkdtemp(join(tmpdir(), 'placard-target-'));
    try {
      const result = await cli.demo({ targetDir: join(dir, 'sous-dossier') });
      expect(result.exitCode).toBe(0);
      expect(result.reportPath).toContain(join(dir, 'sous-dossier'));
      const { stat } = await import('node:fs/promises');
      expect((await stat(join(dir, 'sous-dossier', '.git'))).isDirectory()).toBe(true);
    } finally {
      await rm(dir, { recursive: true, force: true });
    }
  });
});
