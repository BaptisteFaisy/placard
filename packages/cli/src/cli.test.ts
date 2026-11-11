import { describe, expect, it } from 'vitest';
import { cli } from './wire.js';
import { parseArgs } from './args.js';

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
