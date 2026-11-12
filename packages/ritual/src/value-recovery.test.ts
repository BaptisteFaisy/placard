import { fakeValue, redactPreview } from '@placard/core';
import { describe, expect, it } from 'vitest';

import { extractFromLine, extractKeyBlock, parsePreview, recoverValue } from './value-recovery';
import { findingFor, makeRepoWithSecret } from './test-support';

describe('parsePreview', () => {
  it('decodes a prefix and a length', () => {
    expect(parsePreview('AKIA…(20)')).toEqual({ kind: 'prefix-length', prefix: 'AKIA', length: 20 });
  });

  it('decodes the anchored form used for banking data', () => {
    expect(parsePreview('1234…5678')).toEqual({ kind: 'anchored', head: '1234', tail: '5678' });
  });

  it('decodes the fully redacted form', () => {
    expect(parsePreview('[REDACTED:suspicious-string](40)')).toEqual({ kind: 'length', length: 40 });
  });

  it('gives up on anything else', () => {
    expect(parsePreview('***')).toEqual({ kind: 'none' });
  });
});

describe('extractFromLine', () => {
  it('isolates a cloud key from a line of code', () => {
    const value = fakeValue('cloud-key', 'recovery-a');
    const line = `const apiKey = '${value}'; // rotate me`;
    expect(extractFromLine(line, redactPreview(value, 'cloud-key'))).toBe(value);
  });

  it('isolates a token whose length is the only hint', () => {
    const value = fakeValue('suspicious-string', 'recovery-b');
    const line = `token=${value}`;
    expect(extractFromLine(line, redactPreview(value, 'suspicious-string'))).toBe(value);
  });

  it('isolates banking data by its first and last four characters', () => {
    const value = fakeValue('bank-data', 'recovery-c');
    const line = `iban: ${value}`;
    const preview = redactPreview(value, 'bank-data');
    if (value.length >= 8) expect(extractFromLine(line, preview)).toBe(value);
  });

  it('returns undefined when the hint cannot be matched', () => {
    expect(extractFromLine('nothing here', 'AKIA…(20)')).toBeUndefined();
  });
});

describe('extractKeyBlock', () => {
  it('rebuilds a multi-line private key around its line number', () => {
    // L'en-tête et le pied sont assemblés à l'exécution : aucun bloc de clé
    // privée au format réel n'est écrit dans le dépôt (règle PLA-N-09).
    const header = `-----BEGIN ${'RSA'} PRIVATE KEY-----`;
    const footer = `-----END ${'RSA'} PRIVATE KEY-----`;
    const lines = ['header', header, 'body1', 'body2', footer, 'tail'];
    expect(extractKeyBlock(lines, 2)).toBe(lines.slice(1, 5).join('\n'));
  });

  it('returns undefined when there is no key block', () => {
    expect(extractKeyBlock(['a', 'b'], 0)).toBeUndefined();
  });
});

describe('recoverValue', () => {
  it('reads the value back from the analysed repository', async () => {
    const value = fakeValue('cloud-key', 'recovery-d');
    const repo = await makeRepoWithSecret(value);
    const finding = findingFor(value, { commit: repo.head, path: 'config.js', line: 2 });
    const recovered = await recoverValue(repo.repoDir, finding);
    expect(recovered?.value).toBe(value);
    expect(recovered?.precise).toBe(true);
  });

  it('falls back to the whole line, flagged as imprecise', async () => {
    const value = fakeValue('cloud-key', 'recovery-e');
    const repo = await makeRepoWithSecret(value);
    const finding = findingFor(value, { commit: repo.head, path: 'config.js', line: 2 });
    const broken = { ...finding, preview: '***' };
    const recovered = await recoverValue(repo.repoDir, broken);
    expect(recovered?.precise).toBe(false);
    expect(recovered?.value).toContain(value);
  });

  it('returns undefined when the location does not exist', async () => {
    const repo = await makeRepoWithSecret(fakeValue('cloud-key', 'recovery-f'));
    const finding = findingFor('whatever-value-1234', { commit: 'd'.repeat(40), path: 'nope.js' });
    expect(await recoverValue(repo.repoDir, finding)).toBeUndefined();
  });
});
