import type { FindingFamily, RotationCard } from '@placard/core';

import { isPersonalData, PERSONAL_DATA_NOTICE } from './families.js';

/**
 * Fiches de rotation (PLA-F-22).
 *
 * Règle : aucune URL inventée. Chaque lien ci-dessous a été vérifié et pointe
 * vers la documentation officielle du fournisseur. Quand aucune fiche
 * spécifique n'existe, la fiche générique le dit explicitement au lieu de
 * fabriquer une adresse plausible.
 */

interface ProviderSpec {
  id: string;
  name: string;
  /** Motif testé sur l'identifiant de règle, en minuscules. */
  pattern: RegExp;
  whereToRevoke: string;
  docUrl: string;
  checklist: string[];
}

const PROVIDERS: readonly ProviderSpec[] = [
  {
    id: 'aws',
    name: 'Amazon Web Services',
    pattern: /aws|amazon|akia|asia/,
    whereToRevoke:
      'AWS Management Console → IAM → Users → <user> → Security credentials → ' +
      'Access keys: choose the key, set it to Inactive, then Delete. Root account ' +
      'keys live in the same screen under "Root access keys".',
    docUrl: 'https://docs.aws.amazon.com/IAM/latest/UserGuide/id_credentials_access-keys.html',
    checklist: [
      'Deactivate the key first, then delete it once nothing depends on it.',
      'Search CloudTrail event history for the leaked access key id over the exposure window.',
      'Check IAM Access Analyzer for unused credentials and overly broad policies.',
      'Hunt the same value in Lambda environment variables, CI secrets, launch templates and .env files.',
    ],
  },
  {
    id: 'github',
    name: 'GitHub',
    pattern: /github|ghp_|github_pat/,
    whereToRevoke:
      'GitHub → Settings → Developer settings → Personal access tokens (classic or ' +
      'fine-grained) → Delete. For an OAuth app token: Settings → Applications → ' +
      'Authorized OAuth Apps → Revoke.',
    docUrl:
      'https://docs.github.com/en/authentication/keeping-your-account-and-data-secure/managing-your-personal-access-tokens',
    checklist: [
      'Delete the token rather than only generating a replacement.',
      'Read the audit log of the affected organization for actions taken with the token.',
      'Check deploy keys, GitHub Apps and Actions secrets for the same value.',
      'Rotate every secret the token could read (repository secrets, packages, environments).',
    ],
  },
  {
    id: 'stripe',
    name: 'Stripe',
    pattern: /stripe|sk_live|sk_test|rk_live/,
    whereToRevoke:
      'Stripe Dashboard → Developers → API keys → Roll (or Delete) the leaked key. ' +
      'Restricted keys are revoked from the same screen.',
    docUrl: 'https://docs.stripe.com/keys',
    checklist: [
      'Roll the key, deploy the new one, then delete the old key once the grace period ends.',
      'Review Developers → Logs for requests made with the leaked key.',
      'Rotate the webhook signing secret if it appears in the same file.',
      'Check for charges, refunds or payouts created with the leaked key.',
    ],
  },
  {
    id: 'google',
    name: 'Google Cloud',
    pattern: /google|gcp|gcloud|gemini|aiza/,
    whereToRevoke:
      'Google Cloud console → APIs & Services → Credentials → select the API key → ' +
      'Delete. Service account keys: IAM & Admin → Service Accounts → Keys → Delete.',
    docUrl: 'https://cloud.google.com/docs/authentication/api-keys',
    checklist: [
      'Delete the key; restricting an already leaked key is not enough.',
      'Review the API usage and quotas dashboard for the leaked key id.',
      'List remaining service account keys and remove the unused ones.',
      'Restrict new keys to the APIs, referrers or IP ranges that need them.',
    ],
  },
  {
    id: 'slack',
    name: 'Slack',
    pattern: /slack|xoxb-|xoxp-|xoxa-/,
    whereToRevoke:
      'Slack API → Your Apps → <app> → OAuth & Permissions → Reinstall the app, which ' +
      'revokes the previous bot and user tokens. Legacy tokens are managed from the ' +
      'workspace administration screen.',
    docUrl: 'https://api.slack.com/authentication/rotation',
    checklist: [
      'Reinstall the app or rotate the token in the app configuration.',
      'Rotate the signing secret if it appears in the same file.',
      'Review workspace access logs for messages or files posted by the app.',
      'Update the token everywhere the app is installed, not only in this repository.',
    ],
  },
];

/** Fiche de repli : réelle, mais honnête sur son absence de spécificité. */
const GENERIC_DOC_URL =
  'https://cheatsheetseries.owasp.org/cheatsheets/Secrets_Management_Cheat_Sheet.html';

const PERSONAL_DATA_DOC_URL = 'https://www.cnil.fr/fr/les-violations-de-donnees-personnelles';

const GENERIC_CHECKLIST = [
  'Find the credential in the provider console (API keys, tokens, credentials, integrations).',
  'Revoke or delete it, then issue a new one; do not reuse the leaked value.',
  'Look for the provider usage or audit log and check what the credential did while exposed.',
  'Update every place the value was pasted: CI secrets, deployment config, local .env files.',
];

function genericCard(rule: string, family: FindingFamily): RotationCard {
  const checklist = [...GENERIC_CHECKLIST];
  if (family === 'private-key') {
    checklist.unshift(
      'Generate a new key pair and distribute the public key; the old private key stays compromised forever.',
    );
  }
  if (family === 'risky-file') {
    checklist.unshift(
      'Treat the whole file as exposed: list every secret it contained, not only the one reported.',
    );
  }
  return {
    provider: 'generic',
    name: `Generic rotation guide (${rule})`,
    whereToRevoke:
      'No provider-specific guide exists for this rule, and Placard will not invent one. ' +
      'Open your provider console, go to its API keys / credentials / tokens section, ' +
      'revoke (delete) the credential, then create a new one. The link below is the ' +
      'vendor-neutral OWASP secrets management cheat sheet, not a provider page.',
    docUrl: GENERIC_DOC_URL,
    checklist,
    notApplicable: false,
  };
}

function personalDataCard(): RotationCard {
  return {
    provider: 'personal-data',
    name: 'Personal data — nothing to revoke',
    whereToRevoke:
      'There is no credential to revoke: the leaked content is data about a person. ' +
      'Locate every copy (file, commit, export, backup), stop the exposure, and record ' +
      'who could have accessed it and when.',
    docUrl: PERSONAL_DATA_DOC_URL,
    checklist: [
      'Identify exactly which people and which data fields are exposed.',
      'Stop the exposure: restrict access, remove the file from the current branch, then purge the history.',
      'Record the exposure window and who could have read the data.',
      'Decide, with your legal counsel, whether a notification is required.',
    ],
    notApplicable: true,
    notice: PERSONAL_DATA_NOTICE,
  };
}

/** Fiche de rotation de la règle ; repli explicite sur une fiche générique. */
export function rotationCard(rule: string, family: FindingFamily): RotationCard {
  if (isPersonalData(family)) return personalDataCard();
  const haystack = rule.toLowerCase();
  const spec = PROVIDERS.find((candidate) => candidate.pattern.test(haystack));
  if (spec === undefined) return genericCard(rule, family);
  return {
    provider: rule,
    name: spec.name,
    whereToRevoke: spec.whereToRevoke,
    docUrl: spec.docUrl,
    checklist: [...spec.checklist],
    notApplicable: false,
  };
}

/** Identifiants des fiches spécifiques livrées (utile aux tests et à l'interface). */
export const PROVIDER_IDS: readonly string[] = PROVIDERS.map((spec) => spec.id);
