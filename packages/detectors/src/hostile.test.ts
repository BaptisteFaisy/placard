import { describe, expect, it } from 'vitest';

import { createDetectorEngine } from './index';
import { fixture, inputOf } from './testing/fixtures';

/**
 * PLA-P-10 / PLA-N-03 : un contenu hostile ne fait jamais lever le moteur et
 * ne le fait jamais sortir de son budget de temps. Aucun contenu n'est exécuté.
 */

const engine = createDetectorEngine();

/** Budget de temps par ligne, très large pour rester stable en CI. */
const BUDGET_MS = 2000;

/** Analyse une ligne en mesurant la durée et vérifie l'absence d'exception. */
function scanSafely(line: string): { count: number; elapsed: number } {
  const started = Date.now();
  const result = engine.scanLine(inputOf(line));
  const elapsed = Date.now() - started;
  expect(Array.isArray(result.detections)).toBe(true);
  expect(result.rulesTried).toBeGreaterThanOrEqual(0);
  return { count: result.detections.length, elapsed };
}

describe('hostile content (PLA-P-10, PLA-N-03)', () => {
  it('survives NUL bytes', () => {
    const line = '\u0000'.repeat(500) + ' password = \u0000abc\u0000';
    expect(scanSafely(line).elapsed).toBeLessThan(BUDGET_MS);
  });

  it('survives a one-megabyte line', () => {
    const line = 'a'.repeat(1024 * 1024);
    const result = scanSafely(line);
    expect(result.elapsed).toBeLessThan(BUDGET_MS);
  });

  it('survives a one-megabyte line of secret-looking digits', () => {
    const line = '4'.repeat(1024 * 1024);
    expect(scanSafely(line).elapsed).toBeLessThan(BUDGET_MS);
  });

  it('survives control sequences and terminal escapes', () => {
    const line = '\u001b[31m\u0007\u0008\u001b[0m password = ' + fixture('plaintext-password', 'ctl', 0);
    expect(scanSafely(line).elapsed).toBeLessThan(BUDGET_MS);
  });

  it('survives unbalanced regex metacharacters', () => {
    for (const line of ['(((((((((((((((((((', '[[[[[[[[[', '\\\\\\', '???+++***', 'a{2,100000}']) {
      expect(scanSafely(line).elapsed).toBeLessThan(BUDGET_MS);
    }
  });

  it('survives nested repetition bait without catastrophic backtracking', () => {
    const bait = `${'a'.repeat(5000)}!`;
    expect(scanSafely(bait).elapsed).toBeLessThan(BUDGET_MS);
  });

  it('survives a line made only of separators', () => {
    expect(scanSafely('.' .repeat(10000)).elapsed).toBeLessThan(BUDGET_MS);
  });

  it('survives a deeply dotted base64url bait', () => {
    const bait = `${'eyJ'.repeat(200)}.${'a'.repeat(5000)}.${'b'.repeat(5000)}`;
    expect(scanSafely(bait).elapsed).toBeLessThan(BUDGET_MS);
  });

  it('survives a hostile path', () => {
    const started = Date.now();
    const result = engine.scanPath(`${'\u0000'.repeat(200)}/${'../'.repeat(500)}.env`);
    expect(Array.isArray(result.detections)).toBe(true);
    expect(Date.now() - started).toBeLessThan(BUDGET_MS);
  });

  it('does not execute template or script payloads', () => {
    const payload = 'password = "${process.exit(1)}"';
    expect(() => engine.scanLine(inputOf(payload))).not.toThrow();
    expect(scanSafely('api_key = {{ 7*7 }}').count).toBeGreaterThanOrEqual(0);
  });

  it('tolerates a malformed input object', () => {
    const malformed = { line: 42, path: null, commit: undefined } as unknown as Parameters<
      typeof engine.scanLine
    >[0];
    expect(() => engine.scanLine(malformed)).not.toThrow();
    expect(engine.scanLine(malformed).detections).toEqual([]);
  });

  it('returns a fresh result for every call (no shared state)', () => {
    const value = fixture('cloud-key', 'state', 0);
    const line = `api_key = ${value}`;
    const first = engine.scanLine(inputOf(line)).detections.length;
    const second = engine.scanLine(inputOf(line)).detections.length;
    expect(first).toBe(second);
    expect(first).toBeGreaterThan(0);
  });
});
