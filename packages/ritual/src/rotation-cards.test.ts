import fc from 'fast-check';
import { describe, expect, it } from 'vitest';

import { FAMILIES } from '@placard/core';

import { PROVIDER_IDS, rotationCard } from './rotation-cards';

/** Les cinq fournisseurs attendus, plus le repli générique. */
const PROVIDER_RULES = [
  { rule: 'aws-access-key', name: 'Amazon Web Services' },
  { rule: 'github-personal-access-token', name: 'GitHub' },
  { rule: 'stripe-secret-key', name: 'Stripe' },
  { rule: 'google-api-key', name: 'Google Cloud' },
  { rule: 'slack-bot-token', name: 'Slack' },
];

describe('rotationCard', () => {
  it('ships the five provider cards', () => {
    expect(PROVIDER_IDS).toEqual(['aws', 'github', 'stripe', 'google', 'slack']);
  });

  it.each(PROVIDER_RULES)('returns a documented card for $rule', ({ rule, name }) => {
    const card = rotationCard(rule, 'cloud-key');
    expect(card.name).toBe(name);
    expect(card.docUrl).toMatch(/^https:\/\//);
    expect(card.whereToRevoke.length).toBeGreaterThan(20);
    expect(card.checklist.length).toBeGreaterThanOrEqual(3);
    expect(card.notApplicable).toBe(false);
  });

  it('points every provider card at an official documentation host', () => {
    const hosts = PROVIDER_RULES.map(({ rule }) => new URL(rotationCard(rule, 'cloud-key').docUrl).host);
    expect(hosts).toEqual([
      'docs.aws.amazon.com',
      'docs.github.com',
      'docs.stripe.com',
      'cloud.google.com',
      'api.slack.com',
    ]);
  });

  it('falls back to an honest generic card, without inventing a provider URL', () => {
    const card = rotationCard('some-unknown-rule', 'suspicious-string');
    expect(card.provider).toBe('generic');
    expect(card.whereToRevoke).toMatch(/no provider-specific guide/i);
    expect(card.docUrl).toMatch(/^https:\/\//);
    expect(new URL(card.docUrl).host).toBe('cheatsheetseries.owasp.org');
    expect(card.checklist.length).toBeGreaterThanOrEqual(3);
  });

  it('treats personal data as not rotatable, with a cautious notice', () => {
    const card = rotationCard('french-ssn', 'identity');
    expect(card.notApplicable).toBe(true);
    expect(card.notice).toMatch(/notification obligations/i);
    expect(card.notice).toMatch(/does not assess/i);
    expect(card.checklist.join(' ')).toMatch(/legal counsel/i);
  });

  it('adds a key-pair warning to the generic card for private keys', () => {
    const card = rotationCard('rsa-private-key', 'private-key');
    expect(card.notApplicable).toBe(false);
    expect(card.checklist[0]).toMatch(/key pair/i);
  });

  it('never leaks a value: a card only carries guidance text', () => {
    const card = rotationCard('aws-access-key', 'cloud-key');
    const serialized = JSON.stringify(card);
    expect(serialized).not.toMatch(/AKIA[A-Z0-9]{16}/);
  });

  it('always returns a usable card, whatever the rule string', () => {
    fc.assert(
      fc.property(fc.string({ maxLength: 60 }), fc.constantFrom(...FAMILIES), (rule, family) => {
        const card = rotationCard(rule, family);
        expect(card.name.length).toBeGreaterThan(0);
        expect(card.whereToRevoke.length).toBeGreaterThan(20);
        expect(card.docUrl.startsWith('https://')).toBe(true);
        expect(card.checklist.length).toBeGreaterThan(0);
        expect(typeof card.notApplicable).toBe('boolean');
      }),
      { numRuns: 120 },
    );
  });
});
