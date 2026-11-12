import { describe, expect, it } from 'vitest';

import { createDetectorEngine } from './index';
import { RULE_IDS } from './registry';
import {
  apiKeyLine,
  assignmentLine,
  envLine,
  fixture,
  fixtureCard,
  fixtureEmail,
  fixtureIban,
  fixtureSsn,
  inputOf,
  passwordLine,
  privateKeyLines,
  riskyFilePath,
  urlWithCredentials,
} from './testing/fixtures';

/**
 * PLA-F-02 : une valeur de chaque famille est détectée, par la règle attendue.
 * Toutes les valeurs sont fabriquées à l'exécution (PLA-N-09).
 */

const engine = createDetectorEngine();

/** Identifiants des règles attendues pour une ligne. */
function rulesOf(line: string, path?: string): string[] {
  const input = path === undefined ? inputOf(line) : inputOf(line, { path });
  return engine.scanLine(input).detections.map((detection) => detection.rule);
}

describe('detection families (PLA-F-02)', () => {
  it('detects cloud provider access key IDs', () => {
    const value = fixture('cloud-key', 'cloud-seed', 0);
    expect(rulesOf(apiKeyLine(value))).toContain(RULE_IDS.cloudAccessKey);
  });

  it('detects every cloud key shape, with the right rule', () => {
    const rules = new Set<string>();
    for (let index = 0; index < 20; index += 1) {
      const value = fixture('cloud-key', 'cloud-seed', index);
      for (const rule of rulesOf(apiKeyLine(value))) rules.add(rule);
    }
    expect(rules).toContain(RULE_IDS.cloudAccessKey);
    expect(rules).toContain(RULE_IDS.cloudApiKey);
  });

  it.each([0, 1, 2, 3, 4, 5])('detects platform token shape %i', (index) => {
    const value = fixture('platform-token', 'token-seed', index);
    const rules = rulesOf(assignmentLine('token', value));
    expect(rules.some((rule) => rule.startsWith('platform-'))).toBe(true);
  });

  it('detects every platform token prefix, with the right rule', () => {
    const rules = new Set<string>();
    for (let index = 0; index < 40; index += 1) {
      const value = fixture('platform-token', 'token-seed', index);
      for (const rule of rulesOf(assignmentLine('token', value))) rules.add(rule);
    }
    expect(rules).toContain(RULE_IDS.githubPat);
    expect(rules).toContain(RULE_IDS.githubFinePat);
    expect(rules).toContain(RULE_IDS.slackToken);
    expect(rules).toContain(RULE_IDS.npmToken);
    expect(rules).toContain(RULE_IDS.stripeLiveKey);
    expect(rules).toContain(RULE_IDS.assistantProjectKey);
  });

  it('detects private key headers on a single line', () => {
    const header = privateKeyLines('pem-seed')[0] ?? '';
    expect(rulesOf(header)).toContain(RULE_IDS.privateKeyHeader);
  });

  it('detects signed tokens (JWT)', () => {
    const value = fixture('signed-token', 'jwt-seed', 0);
    expect(rulesOf(assignmentLine('token', value))).toContain(RULE_IDS.signedToken);
  });

  it('detects plaintext password assignments', () => {
    const value = fixture('plaintext-password', 'pwd-seed', 0);
    expect(rulesOf(passwordLine(value))).toContain(RULE_IDS.passwordAssignment);
  });

  it('detects credentials embedded in a URL', () => {
    const password = fixture('plaintext-password', 'url-seed', 3);
    const line = urlWithCredentials('app_user', password);
    expect(rulesOf(line)).toContain(RULE_IDS.passwordUrl);
  });

  it('detects IBANs with a valid mod-97 checksum', () => {
    expect(rulesOf(`account ${fixtureIban('iban-a')}`)).toContain(RULE_IDS.bankIban);
  });

  it('detects card numbers with a valid Luhn checksum', () => {
    expect(rulesOf(`card ${fixtureCard('card-a')}`)).toContain(RULE_IDS.bankCard);
  });

  it('detects French NIR numbers with a valid key', () => {
    expect(rulesOf(`nir ${fixtureSsn('ssn-a')}`)).toContain(RULE_IDS.identityNir);
  });

  it('detects personal email addresses', () => {
    expect(rulesOf(`mail ${fixtureEmail('mail-a')}`)).toContain(RULE_IDS.identityEmail);
  });

  it('detects long high-entropy strings next to a secret keyword', () => {
    const value = fixture('suspicious-string', 'susp-seed', 0);
    expect(rulesOf(apiKeyLine(value))).toContain(RULE_IDS.suspiciousString);
  });

  it('flags risky files by name (PLA-F-04)', () => {
    const detections = engine.scanPath(riskyFilePath('env-seed')).detections;
    expect(detections.map((detection) => detection.family)).toContain('risky-file');
  });

  it('flags environment files and key files by name', () => {
    expect(engine.scanPath('config/.env.local').detections).toHaveLength(1);
    expect(engine.scanPath('deploy/id_rsa').detections).toHaveLength(1);
    expect(engine.scanPath('src/index.ts').detections).toHaveLength(0);
  });

  it('reports the family and a bounded span for every detection', () => {
    const value = fixture('cloud-key', 'cloud-seed', 1);
    const line = apiKeyLine(value);
    const [detection] = engine.scanLine(inputOf(line)).detections;
    expect(detection).toBeDefined();
    expect(line.slice(detection!.start, detection!.end)).toBe(value);
    expect(detection!.confidence).toBeGreaterThan(0);
    expect(detection!.confidence).toBeLessThanOrEqual(1);
  });

  it('detects credentials in environment files without quotes', () => {
    const value = fixture('plaintext-password', 'env-seed', 1);
    expect(rulesOf(envLine('DB_PASSWORD', value))).toContain(RULE_IDS.passwordEnv);
  });
});
