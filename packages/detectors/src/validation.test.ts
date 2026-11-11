import { isDummyValue, invalidChecksumVariant } from '@placard/core';
import { describe, expect, it } from 'vitest';

import { createDetectorEngine } from './index.js';
import { RULE_IDS } from './registry.js';
import {
  QUOTE,
  assignmentLine,
  fixtureCard,
  fixtureEmail,
  fixtureIban,
  fixtureSsn,
  inputOf,
  passwordLine,
} from './testing/fixtures.js';

/**
 * PLA-F-03 : seules les données à somme de contrôle **valide** sont signalées,
 * et le bruit (valeurs factices, gabarits, domaines d'exemple) est écarté.
 */

const engine = createDetectorEngine();

function rulesOf(line: string): string[] {
  return engine.scanLine(inputOf(line)).detections.map((detection) => detection.rule);
}

describe('checksum validation (PLA-F-03)', () => {
  it.each([0, 1, 2, 3, 4])('detects valid IBAN %i and ignores its broken variant', (index) => {
    const iban = fixtureIban(`iban-seed-${index}`);
    const broken = invalidChecksumVariant(iban, 'bank-data');
    expect(broken).not.toBe(iban);
    expect(rulesOf(`account ${iban}`)).toContain(RULE_IDS.bankIban);
    expect(rulesOf(`account ${broken}`)).not.toContain(RULE_IDS.bankIban);
  });

  it.each([0, 1, 2, 3, 4])('detects valid card %i and ignores its broken variant', (index) => {
    const card = fixtureCard(`card-seed-${index}`);
    const broken = invalidChecksumVariant(card, 'bank-data');
    expect(rulesOf(`card ${card}`)).toContain(RULE_IDS.bankCard);
    expect(rulesOf(`card ${broken}`)).not.toContain(RULE_IDS.bankCard);
  });

  it.each([0, 1, 2, 3, 4])('detects valid NIR %i and ignores its broken variant', (index) => {
    const ssn = fixtureSsn(`ssn-seed-${index}`);
    const broken = invalidChecksumVariant(ssn, 'identity');
    expect(rulesOf(`nir ${ssn}`)).toContain(RULE_IDS.identityNir);
    expect(rulesOf(`nir ${broken}`)).not.toContain(RULE_IDS.identityNir);
  });

  it('ignores long digit runs that are not Luhn-valid', () => {
    expect(rulesOf('order 1234567890123456')).not.toContain(RULE_IDS.bankCard);
  });

  it('ignores a 15-digit run shaped like a French NIR but with a wrong key', () => {
    const ssn = fixtureSsn('ssn-shape');
    const broken = invalidChecksumVariant(ssn, 'identity');
    expect(rulesOf(`id ${broken}`)).not.toContain(RULE_IDS.identityNir);
  });
});

describe('dummy and placeholder exclusion', () => {
  it.each(['changeme', 'your_key_here', 'placeholder', '00000000', 'password'])(
    'ignores the dummy password %s',
    (dummy) => {
      expect(isDummyValue(dummy)).toBe(true);
      expect(rulesOf(passwordLine(dummy))).not.toContain(RULE_IDS.passwordAssignment);
    },
  );

  it('ignores template placeholders left in configuration files', () => {
    const template = '${' + 'DB_PASSWORD}';
    expect(rulesOf(passwordLine(template))).toHaveLength(0);
  });

  it('ignores reserved example domains', () => {
    for (const domain of ['example.com', 'example.org', 'example.net', 'host.test', 'host.invalid', 'host.local']) {
      expect(rulesOf(`mail someone@${domain}`)).not.toContain(RULE_IDS.identityEmail);
    }
  });

  it('still detects a real-looking personal address', () => {
    expect(rulesOf(`mail ${fixtureEmail('real-mail')}`)).toContain(RULE_IDS.identityEmail);
  });

  it('ignores semantic versions and dotted identifiers', () => {
    expect(rulesOf('version 1.2.3 released')).toHaveLength(0);
    expect(rulesOf('see com.example.app')).toHaveLength(0);
  });

  it('ignores a password-looking assignment whose value is too short', () => {
    expect(rulesOf(assignmentLine('password', 'ab12'))).toHaveLength(0);
  });

  it('does not report the quoting characters as part of the value', () => {
    const value = 'Zq7' + 'rT2vB9xLm4';
    const line = passwordLine(value);
    const [detection] = engine.scanLine(inputOf(line)).detections;
    expect(detection?.value).toBe(value);
    expect(detection?.value).not.toContain(QUOTE);
  });
});
