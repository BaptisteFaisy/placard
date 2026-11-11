import { describe, expect, it } from 'vitest';
import { fakeValue } from '@placard/core';
import { createDetectorEngine } from './index.js';

describe('precision — rejet des six classes de faux positifs', () => {
  const engine = createDetectorEngine();

  function scan(line: string, path = 'src/app.ts') {
    return engine.scanLine({ line, path, commit: '0'.repeat(40), lineNumber: 1, side: 'added' }).detections;
  }

  it('1. écarte les versions npm lues comme e-mails tout en gardant les vrais e-mails', () => {
    expect(scan('  react-dom@19.3.1:', 'pnpm-lock.yaml')).toHaveLength(0);
    expect(scan("  '@jridgewell/trace-mapping@0.3.25':", 'pnpm-lock.yaml')).toHaveLength(0);
    const domain = ['atelier', 'test'].join('-') + '.fr';
    const email = `jean.dupont@${domain}`;
    expect(scan(`contact = "${email}"`).some((d) => d.rule === 'identity-email')).toBe(true);
  });

  it('2. écarte les suites de chiffres séquentielles du motif téléphone', () => {
    expect(scan('/^(0123456789|1234567890|9876543210)$/')).toHaveLength(0);
    const tel = ['06', '42', '89', '17', '53'].join(' ');
    expect(scan(`tel = "${tel}"`).some((d) => d.rule === 'identity-phone')).toBe(true);
  });

  it('3. écarte les valeurs de dictionnaire courtes en kebab-case', () => {
    expect(scan("  'plaintext-password': 'key-bearer',")).toHaveLength(0);
  });

  it('4. écarte les marqueurs de caviardage [REDACTED:...]', () => {
    expect(scan("const DB_PASSWORD = '[REDACTED:plaintext-password]';")).toHaveLength(0);
  });

  it('5. écarte les suites 1111111 sans BIN émetteur tout en gardant les cartes Luhn', () => {
    expect(scan("parser.push('index 0000000..1111111 100644');")).toHaveLength(0);
    const card = fakeValue('bank-data', 'precision-card-0', 1);
    if (!card.startsWith('FR')) {
      expect(scan(`card = "${card}"`).some((d) => d.rule === 'bank-card-number')).toBe(true);
    }
  });

  it('6. écarte les chemins d’URL de documentation et les condensats sha512 de lockfile', () => {
    expect(
      scan("docUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html',"),
    ).toHaveLength(0);
    expect(
      scan('    resolution: {integrity: sha512-Y0bARz53lhEC1NMCASs0/j+faB/zqt3R8hpvg1e8+61ZVJ4UL0UdC4cBbXfZMcIuhrfgeILTLe+ZeBCavQ==}', 'pnpm-lock.yaml'),
    ).toHaveLength(0);
    expect(scan("expect(isPublicRemote('git@github.com:acme/repo.git')).toBe(false);")).toHaveLength(0);
  });
});
