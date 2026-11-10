import { describe, expect, it } from 'vitest';
import fc from 'fast-check';
import { computeFingerprint, redactPreview, sanitizeSnippet } from './redact.js';
import { computeDangerScore } from './scoring.js';
import type { FindingFamily } from './types.js';

describe('redact & fingerprint', () => {
  it('calcule une empreinte reproductible', () => {
    const fp1 = computeFingerprint('secret-123', 'salt-abc');
    const fp2 = computeFingerprint('secret-123', 'salt-abc');
    expect(fp1).toBe(fp2);
    expect(fp1.startsWith('hmac256:')).toBe(true);
  });

  it('redactPreview masque les clés avec préfixe et longueur', () => {
    const preview = redactPreview('AKIA1234567890EXAMPLE', 'cloud-key');
    expect(preview).toBe('AKIA…(21)');
    expect(preview.includes('EXAMPLE')).toBe(false);
  });

  it('sanitizeSnippet remplace la valeur exacte', () => {
    const out = sanitizeSnippet('api_key = "secret_value"', 'secret_value', 'cloud-key');
    expect(out).toBe('api_key = "[REDACTED:cloud-key]"');
  });
});

describe('danger scoring (fast-check properties)', () => {
  const families: FindingFamily[] = [
    'private-key',
    'cloud-key',
    'platform-token',
    'bank-data',
    'plaintext-password',
    'identity',
    'risky-file',
    'signed-token',
    'suspicious-string',
  ];

  it('PLA-P-07: le score reste toujours compris entre 0 et 100', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...families),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (family, inHead, publicRemote, isTestPath, isDummyValue) => {
          const res = computeDangerScore({
            family,
            inHead,
            publicRemote,
            isTestPath,
            isDummyValue,
          });
          return res.score >= 0 && res.score <= 100;
        },
      ),
    );
  });

  it('PLA-P-07: monotonicité HEAD >= absent de HEAD', () => {
    fc.assert(
      fc.property(
        fc.constantFrom(...families),
        fc.boolean(),
        fc.boolean(),
        fc.boolean(),
        (family, publicRemote, isTestPath, isDummyValue) => {
          const withHead = computeDangerScore({
            family,
            inHead: true,
            publicRemote,
            isTestPath,
            isDummyValue,
          });
          const withoutHead = computeDangerScore({
            family,
            inHead: false,
            publicRemote,
            isTestPath,
            isDummyValue,
          });
          return withHead.score >= withoutHead.score;
        },
      ),
    );
  });
});
