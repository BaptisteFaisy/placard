import type { DetectorRule } from '@placard/core';

import {
  ASSISTANT_PROJECT_PREFIX,
  GITHUB_FINE_PAT_PREFIX,
  GITHUB_PAT_PREFIX,
  NPM_TOKEN_PREFIX,
  SLACK_TOKEN_PREFIX,
  STRIPE_LIVE_PREFIX,
} from '../signatures.js';
import { matchesAlphabet, matchesAlphabetRange } from '../validators.js';

/**
 * Famille `platform-token` : jetons à préfixe des plateformes.
 *
 * Chaque règle vérifie **longueur et alphabet** du corps : le préfixe seul ne
 * suffit pas (un tutoriel écrit `ghp_xxxx` dans une page de documentation).
 * Les bornes de longueur sont explicites, jamais `+` ou `*` ouverts.
 */

const ALNUM = /^[A-Za-z0-9]+$/;
const ALNUM_UNDERSCORE = /^[A-Za-z0-9_]+$/;
const ALNUM_DASH = /^[A-Za-z0-9-]+$/;
const URL_SAFE = /^[A-Za-z0-9_-]+$/;

const GH_PAT_LENGTH = 36;
const NPM_TOKEN_LENGTH = 36;
const SLACK_BODY = '[A-Za-z0-9]{2,80}';
const STRIPE_MIN = 20;
const STRIPE_MAX = 99;
const ASSISTANT_MIN = 20;
const ASSISTANT_MAX = 120;
const FINE_PAT_MIN = 36;
const FINE_PAT_MAX = 120;

const GH_PAT_PATTERN = new RegExp(
  `(?<![\\w-])${GITHUB_PAT_PREFIX}[A-Za-z0-9]{${GH_PAT_LENGTH}}(?![\\w-])`,
);
const GH_FINE_PAT_PATTERN = new RegExp(
  `(?<![\\w-])${GITHUB_FINE_PAT_PREFIX}[A-Za-z0-9_]{${FINE_PAT_MIN},${FINE_PAT_MAX}}(?![\\w-])`,
);
const SLACK_PATTERN = new RegExp(
  `(?<![\\w-])${SLACK_TOKEN_PREFIX}[a-z](?:-${SLACK_BODY}){1,4}(?![\\w-])`,
);
const NPM_PATTERN = new RegExp(
  `(?<![\\w-])${NPM_TOKEN_PREFIX}[A-Za-z0-9]{${NPM_TOKEN_LENGTH}}(?![\\w-])`,
);
const STRIPE_PATTERN = new RegExp(
  `(?<![\\w-])${STRIPE_LIVE_PREFIX}[A-Za-z0-9]{${STRIPE_MIN},${STRIPE_MAX}}(?![\\w-])`,
);
const ASSISTANT_PATTERN = new RegExp(
  `(?<![\\w-])${ASSISTANT_PROJECT_PREFIX}[A-Za-z0-9_-]{${ASSISTANT_MIN},${ASSISTANT_MAX}}(?![\\w-])`,
);

/** Identifiants stables des règles de plateforme. */
export const RULE_GITHUB_PAT = 'platform-github-pat';
export const RULE_GITHUB_FINE_PAT = 'platform-github-fine-grained-pat';
export const RULE_SLACK_TOKEN = 'platform-slack-token';
export const RULE_NPM_TOKEN = 'platform-npm-token';
export const RULE_STRIPE_LIVE_KEY = 'platform-stripe-live-key';
export const RULE_ASSISTANT_PROJECT_KEY = 'platform-assistant-project-key';

export const tokenRules: readonly DetectorRule[] = [
  {
    id: RULE_GITHUB_PAT,
    family: 'platform-token',
    name: 'GitHub personal access token',
    keywords: [GITHUB_PAT_PREFIX],
    pattern: GH_PAT_PATTERN,
    validate: (value) =>
      matchesAlphabet(value.slice(GITHUB_PAT_PREFIX.length), ALNUM, GH_PAT_LENGTH),
    priority: 80,
    provider: 'github',
  },
  {
    id: RULE_GITHUB_FINE_PAT,
    family: 'platform-token',
    name: 'GitHub fine-grained personal access token',
    keywords: [GITHUB_FINE_PAT_PREFIX],
    pattern: GH_FINE_PAT_PATTERN,
    validate: (value) =>
      matchesAlphabetRange(
        value.slice(GITHUB_FINE_PAT_PREFIX.length),
        ALNUM_UNDERSCORE,
        FINE_PAT_MIN,
        FINE_PAT_MAX,
      ),
    priority: 80,
    provider: 'github',
  },
  {
    id: RULE_SLACK_TOKEN,
    family: 'platform-token',
    name: 'Slack token',
    keywords: [SLACK_TOKEN_PREFIX],
    pattern: SLACK_PATTERN,
    validate: (value) => /^[a-z]-[A-Za-z0-9]{2,80}(?:-[A-Za-z0-9]{2,80}){0,3}$/.test(
      value.slice(SLACK_TOKEN_PREFIX.length),
    ),
    priority: 80,
    provider: 'slack',
  },
  {
    id: RULE_NPM_TOKEN,
    family: 'platform-token',
    name: 'npm access token',
    keywords: [NPM_TOKEN_PREFIX],
    pattern: NPM_PATTERN,
    validate: (value) => matchesAlphabet(value.slice(NPM_TOKEN_PREFIX.length), ALNUM, NPM_TOKEN_LENGTH),
    priority: 80,
    provider: 'npm',
  },
  {
    id: RULE_STRIPE_LIVE_KEY,
    family: 'platform-token',
    name: 'Stripe live secret key',
    keywords: [STRIPE_LIVE_PREFIX],
    pattern: STRIPE_PATTERN,
    validate: (value) =>
      matchesAlphabetRange(
        value.slice(STRIPE_LIVE_PREFIX.length),
        ALNUM,
        STRIPE_MIN,
        STRIPE_MAX,
      ),
    priority: 82,
    provider: 'stripe',
  },
  {
    id: RULE_ASSISTANT_PROJECT_KEY,
    family: 'platform-token',
    name: 'Assistant project API key',
    keywords: [ASSISTANT_PROJECT_PREFIX],
    pattern: ASSISTANT_PATTERN,
    validate: (value) =>
      matchesAlphabetRange(
        value.slice(ASSISTANT_PROJECT_PREFIX.length),
        URL_SAFE,
        ASSISTANT_MIN,
        ASSISTANT_MAX,
      ),
    priority: 82,
    provider: 'assistant',
  },
];

/** Alphabet exporté pour les règles dérivées (gabarits de test). */
export const TOKEN_ALPHABETS = { ALNUM, ALNUM_UNDERSCORE, ALNUM_DASH, URL_SAFE } as const;
