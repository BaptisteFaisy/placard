import { describe, expect, it } from 'vitest';

import { scanFile } from './block-scan.js';
import { createDetectorEngine } from './index.js';
import { RULE_IDS } from './registry.js';
import {
  emailLines,
  fixture,
  fixtureEmail,
  inputOf,
  privateKeyLines,
  riskyFilePath,
} from './testing/fixtures.js';

/**
 * PLA-F-04 : fichiers à risque, **par nom** et **par contenu**.
 *
 * Par nom : `scanPath`. Par contenu : `scanFile` (bloc de clé privée refermé,
 * export de plus de 50 adresses électroniques).
 */

const engine = createDetectorEngine();

describe('risky files by name (PLA-F-04)', () => {
  it.each([
    ['config/.env', RULE_IDS.riskyDotenv],
    ['.env.production', RULE_IDS.riskyDotenv],
    ['keys/id_rsa', RULE_IDS.riskyPrivateKeyFile],
    ['certs/server.pem', RULE_IDS.riskyPrivateKeyFile],
    ['certs/client.p12', RULE_IDS.riskyPrivateKeyFile],
    ['config/credentials.json', RULE_IDS.riskyCredentials],
    ['db/dump.sql', RULE_IDS.riskyDbExport],
    ['data/app.sqlite', RULE_IDS.riskyDbExport],
    ['src/index.ts.bak', RULE_IDS.riskyBackup],
    ['.npmrc', RULE_IDS.riskyToolCredentials],
  ])('flags %s', (path, expected) => {
    const rules = engine.scanPath(path).detections.map((detection) => detection.rule);
    expect(rules).toContain(expected);
  });

  it.each(['src/index.ts', 'README.md', 'packages/core/src/types.ts', 'test/fixtures/data.json'])(
    'does not flag the ordinary path %s',
    (path) => {
      expect(engine.scanPath(path).detections).toHaveLength(0);
    },
  );

  it('flags the risky file path produced by the fixture factory', () => {
    expect(engine.scanPath(riskyFilePath('name')).detections).toHaveLength(1);
  });

  it('keeps the path as the detected value', () => {
    const [detection] = engine.scanPath('config/.env.local').detections;
    expect(detection?.value).toBe('config/.env.local');
    expect(detection?.family).toBe('risky-file');
  });
});

describe('risky files by content (PLA-F-04)', () => {
  it('promotes a private key header to a full block when the footer is present', () => {
    const lines = privateKeyLines('block-seed');
    const inputs = lines.map((line, index) => inputOf(line, { path: 'keys/server.pem', lineNumber: index + 1 }));
    const result = scanFile(engine, inputs);
    const [first] = result.results[0]?.detections ?? [];
    expect(first?.rule).toBe(RULE_IDS.privateKeyBlock);
    expect(first?.value).toContain(lines[0] ?? '');
  });

  it('gives two different keys two different values', () => {
    const build = (seed: string) => {
      const lines = privateKeyLines(seed);
      const inputs = lines.map((line, index) =>
        inputOf(line, { path: 'keys/server.pem', lineNumber: index + 1 }),
      );
      return scanFile(engine, inputs).results[0]?.detections[0]?.value;
    };
    expect(build('block-a')).not.toBe(build('block-b'));
  });

  it('drops a header whose footer never comes', () => {
    const lines = privateKeyLines('orphan');
    const inputs = [
      inputOf(lines[0] ?? '', { path: 'keys/server.pem', lineNumber: 1 }),
      inputOf('just some body line', { path: 'keys/server.pem', lineNumber: 2 }),
    ];
    expect(scanFile(engine, inputs).results[0]?.detections).toHaveLength(0);
  });

  it('flags a file holding more than 50 email addresses', () => {
    const lines = emailLines(60, 'dump-a');
    const inputs = lines.map((line, index) => inputOf(line, { path: 'data/users.csv', lineNumber: index + 1 }));
    const rules = scanFile(engine, inputs).fileDetections.map((detection) => detection.rule);
    expect(rules).toContain(RULE_IDS.riskyEmailDump);
  });

  it('does not flag a file holding only a few addresses', () => {
    const lines = emailLines(5, 'dump-b');
    const inputs = lines.map((line, index) => inputOf(line, { path: 'data/users.csv', lineNumber: index + 1 }));
    const rules = scanFile(engine, inputs).fileDetections.map((detection) => detection.rule);
    expect(rules).not.toContain(RULE_IDS.riskyEmailDump);
  });

  it('honours a custom email dump threshold', () => {
    const lines = emailLines(6, 'dump-c');
    const inputs = lines.map((line, index) => inputOf(line, { path: 'data/users.csv', lineNumber: index + 1 }));
    const rules = scanFile(engine, inputs, { emailDumpThreshold: 3 }).fileDetections.map((d) => d.rule);
    expect(rules).toContain(RULE_IDS.riskyEmailDump);
  });

  it('reports the path detections alongside the line results', () => {
    const result = scanFile(engine, [inputOf('nothing', { path: 'config/.env' })]);
    expect(result.fileDetections.map((detection) => detection.rule)).toContain(RULE_IDS.riskyDotenv);
    expect(result.rulesTried).toBeGreaterThan(0);
  });

  it('detects a secret inside a risky file, at its own line', () => {
    const value = fixture('cloud-key', 'in-file', 0);
    const inputs = [
      inputOf('nothing here', { path: 'config/.env', lineNumber: 1 }),
      inputOf(`AWS_ACCESS_KEY=${value}`, { path: 'config/.env', lineNumber: 2 }),
    ];
    const result = scanFile(engine, inputs);
    const rules = result.results[1]?.detections.map((detection) => detection.rule) ?? [];
    expect(rules.some((rule) => rule.startsWith('cloud-'))).toBe(true);
  });

  it('survives an empty file', () => {
    const result = scanFile(engine, []);
    expect(result.results).toHaveLength(0);
    expect(result.fileDetections).toHaveLength(0);
  });

  it('counts addresses without crossing the threshold on example domains', () => {
    const lines = Array.from({ length: 60 }, (_, index) => `user${index}@example.com`);
    const inputs = lines.map((line, index) => inputOf(line, { path: 'data/users.csv', lineNumber: index + 1 }));
    const rules = scanFile(engine, inputs).fileDetections.map((detection) => detection.rule);
    expect(rules).not.toContain(RULE_IDS.riskyEmailDump);
  });

  it('uses a real address for the dump fixture', () => {
    expect(fixtureEmail('sanity')).toContain('@');
  });
});
