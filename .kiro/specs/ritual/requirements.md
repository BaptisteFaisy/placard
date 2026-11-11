# Requirements — The Remediation Ritual (`@placard/ritual`)

> Kiro spec · workflow: **requirements first**
> Requirements: PLA-F-22 … PLA-F-29 · Property: PLA-P-09
> Package: `packages/ritual/` · Contract: `packages/core/src/contracts/ritual.ts`
> Steering: `.kiro/steering/remediation-order.md`

## 1. Context

Finding a leaked secret is the easy half. The hard half is that the instinctive
fix — *delete the line, rewrite history* — is wrong when done first: a key that
is purged from Git without being revoked stays valid in the wild, and the person
who has it is now invisible to you. Placard therefore imposes an order:

```
1. ROTATE / REVOKE   → the key is dead at the provider
2. PURGE             → the value leaves the history (only now does it make sense)
3. PREVENT           → it cannot come back (gitignore + pre-commit + push protection)
4. VERIFY            → a new scan proves it is gone; the door gets its wax seal
```

The ritual is the part of the product that turns a finding into a state machine.
It must be impossible to jump a step, and it must be impossible for the tool to
rewrite the user's history on its own.

## 2. Goals

1. Enforce the order, in the UI and in the API, not just in the documentation.
2. Give a precise, provider-specific rotation sheet (where to revoke, what to
   check afterwards).
3. Generate a purge script the user runs — never run it for them.
4. Keep the replacement values out of the repository, in a `0600` file outside
   the working tree.
5. Prove the result: re-scan, seal, and issue a certificate.

## 3. Non-goals

- Calling provider APIs to revoke a credential. No network (PLA-N-01), no stored
  credentials.
- Executing `git filter-repo`, `git push --force`, or any destructive command.
- Legal advice. Personal-data findings carry a cautious notice, not a legal
  opinion.
- Hosting secrets. The replacements file is temporary and local.

## 4. Glossary

| Term | Meaning |
|---|---|
| Step | One of `rotate`, `purge`, `prevent`, `verify`, with `locked`, `lockReason`, `done`, `doneAt`. |
| Rotation card | Provider-specific instructions: where to revoke, doc link, checklist. |
| Not applicable | A finding that has nothing to rotate (personal data): the step is closed with a mandatory reason. |
| Purge artifacts | Generated script (inside the repo) + replacements file (outside, 0600) + commands + warnings. |
| Seal | Terminal state of a finding whose verification scan no longer finds it. |
| Certificate | `PLACARD.md` + badge SVG summarising treated/dismissed/open counts, without any secret. |

## 5. Requirements (EARS)

### PLA-F-22 — Rotation cards

- **PLA-F-22.1** WHEN `rotationCard(rule, family)` is called THE SYSTEM SHALL
  return a card with `provider`, `name`, `whereToRevoke`, `docUrl`, `checklist`,
  `notApplicable` and optional `notice`.
- **PLA-F-22.2** THE SYSTEM SHALL ship dedicated cards for at least: Amazon Web
  Services, GitHub, Stripe, Google Cloud, Slack, and a generic provider card
  used as a fallback for any unknown rule.
- **PLA-F-22.3** WHEN the rule is unknown THE SYSTEM SHALL return the generic
  card, never `undefined` and never a throw.
- **PLA-F-22.4** WHERE the family is `identity` or `bank-data` THE SYSTEM SHALL
  set `notApplicable: true` and SHALL provide a `notice` explaining that the data
  cannot be rotated, that history purge and access review apply, and that this is
  not legal advice.
- **PLA-F-22.5** THE SYSTEM SHALL populate `checklist` with at least: confirm
  the revocation took effect, check the last usage date, look for downstream
  copies, and update the deployments that used the value.

*Acceptance criteria*

- [ ] Every built-in detector rule id resolves to a card (mapped or generic).
- [ ] `rotationCard('iban', 'bank-data').notApplicable === true` with a notice.
- [ ] Each dedicated card's `docUrl` is an `https://` URL of the provider.

### PLA-F-23 — Order lock

- **PLA-F-23.1** THE SYSTEM SHALL return four steps in the fixed order
  `rotate`, `purge`, `prevent`, `verify`.
- **PLA-F-23.2** THE SYSTEM SHALL leave `rotate` unlocked; `purge` SHALL be
  `locked: true` with `lockReason: "Rotate or revoke the secret first"` until
  `state.rotate` records either `doneAt` or `notApplicable: true`.
- **PLA-F-23.3** THE SYSTEM SHALL keep `prevent` locked until `state.purge`
  records a generated script, with
  `lockReason: "Generate and run the purge script first"`.
- **PLA-F-23.4** THE SYSTEM SHALL keep `verify` locked until `state.prevent`
  records an application, with
  `lockReason: "Apply the prevention steps first"`.
- **PLA-F-23.5** WHEN a step is done THE SYSTEM SHALL set `done: true` and
  `doneAt` to the ISO timestamp recorded in the state, and SHALL keep earlier
  steps done (no regression).
- **PLA-F-23.6** WHEN `markRotated` is called with `notApplicable: true` and a
  reason shorter than 3 characters THE SYSTEM SHALL reject the call with a typed
  error and leave the state untouched.

*Acceptance criteria*

- [ ] With no state, `steps(...)` returns exactly one unlocked step (`rotate`).
- [ ] After `markRotated({done: true, by})`, `purge.locked === false`.
- [ ] Calling `generatePurge` before rotation throws `rotation-required` and
  writes nothing.
- [ ] Steps never regress from `done: true` to `done: false`.

### PLA-F-24 — The tool never purges

- **PLA-F-24.1** THE SYSTEM SHALL NOT execute `git filter-repo`, `git filter-branch`,
  `git push --force`, `git gc`, or any command that rewrites the analysed
  repository.
- **PLA-F-24.2** THE SYSTEM SHALL return the commands to run as data
  (`PurgeArtifacts.commands`), for the user to read and execute manually.
- **PLA-F-24.3** THE SYSTEM SHALL NOT modify the working tree, the index, the refs
  or the `.git` directory of the analysed repository, apart from writing under
  `.placard/`.
- **PLA-F-24.4** WHEN the generated script is executed by the user it SHALL
  require an explicit confirmation argument and SHALL refuse to run on a
  repository whose `HEAD` does not match the commit recorded at generation time.

*Acceptance criteria*

- [ ] A test asserting the ritual never spawns a `git` process other than
  read-only plumbing (`rev-parse`, `log -1`).
- [ ] `commands` is non-empty and contains a mirror-clone step and a
  `filter-repo --replace-text` step.
- [ ] The generated script exits non-zero when run without its confirmation flag.

### PLA-F-25 — Purge artifacts

- **PLA-F-25.1** WHEN `generatePurge` succeeds THE SYSTEM SHALL write a script at
  `.placard/scripts/purge-<fingerprint-suffix>.sh`, executable, containing no
  secret value, and SHALL return its path in `scriptPath`.
- **PLA-F-25.2** THE SYSTEM SHALL write the replacements file in `tmpDir`
  (outside the repository), with mode `0600`, and SHALL set `secure: true` only
  when both conditions (outside the repository, mode `0600`) are verified with
  `stat`.
- **PLA-F-25.3** THE SYSTEM SHALL write the replacement lines in the
  `filter-repo --replace-text` format, one `value==>***REMOVED***` rule per
  finding, deduplicated by fingerprint.
- **PLA-F-25.4** THE SYSTEM SHALL populate `warnings` with at least: force-push
  required on every clone, collaborators must re-clone, CI caches and artefacts
  may retain the value, the hosting platform may keep cached views, forks keep
  their own history, and the secret must already be revoked.
- **PLA-F-25.5** THE SYSTEM SHALL NOT print the replacements file content to
  stdout, and SHALL delete it on request (`--cleanup`) or after the verification
  step, never silently.

*Acceptance criteria*

- [ ] `stat` on the replacements path reports mode `0600` and the path is not
  under `repoDir`.
- [ ] The script contains the fingerprint and the paths, never the value.
- [ ] `warnings` has at least six entries.

### PLA-F-26 — Prevention

- **PLA-F-26.1** WHEN `prevention(options)` is called THE SYSTEM SHALL propose
  `gitignoreLines` covering the paths and patterns of the findings' risky files,
  `preCommitHook` containing a `placard scan --staged` invocation,
  `hookPath` (`.git/hooks/pre-commit`), and `reminders`.
- **PLA-F-26.2** THE SYSTEM SHALL make `reminders` include enabling the hosting
  platform's push protection and secret scanning, and rotating any other
  credential that shared the same scope.
- **PLA-F-26.3** THE SYSTEM SHALL NOT install the hook itself: it returns the
  content and the target path, and the user (or `placard ritual prevent --apply`)
  writes it.
- **PLA-F-26.4** THE SYSTEM SHALL keep the proposed hook free of any value and
  free of network calls.

*Acceptance criteria*

- [ ] `gitignoreLines` is non-empty for a finding whose rule is `dotenv-file`.
- [ ] The hook content contains `--staged` and no secret-shaped literal.
- [ ] Calling `prevention` twice returns the same proposal (deterministic).

### PLA-F-27 — Verification and seal

- **PLA-F-27.1** WHEN `verify(options, finding, latestReportPath)` is called THE
  SYSTEM SHALL load the new report, look for the finding's fingerprint, and
  record `stillFound`.
- **PLA-F-27.2** IF the fingerprint is absent THEN THE SYSTEM SHALL set
  `verify.verifiedAt`, set `sealedAt`, and return a state whose finding is
  sealed.
- **PLA-F-27.3** IF the fingerprint is still present THEN THE SYSTEM SHALL keep
  the finding unsealed, record `stillFound: true`, and explain that the purge is
  incomplete or that another ref still contains the value.
- **PLA-F-27.4** WHEN the latest report is missing or invalid THEN THE SYSTEM
  SHALL fail with `report-missing` / `report-invalid` and leave the state
  untouched.
- **PLA-F-27.5** THE SYSTEM SHALL NOT seal a finding whose `rotate` step is not
  done or declared not applicable.

*Acceptance criteria*

- [ ] Verifying against a report without the fingerprint sets `sealedAt`.
- [ ] Verifying against the original report keeps the finding open and
  `stillFound: true`.
- [ ] A sealed finding never becomes unsealed by a later verification.

### PLA-F-28 — Certificate

- **PLA-F-28.1** WHEN `certificate(options, input)` is called THE SYSTEM SHALL
  write `PLACARD.md` and a badge SVG and return their paths and contents.
- **PLA-F-28.2** THE SYSTEM SHALL include in the certificate: repository name,
  `HEAD`, analysis date, tool version, counts of treated/dismissed/open findings,
  the remediation order reminder, and the list of remaining open findings by
  fingerprint and preview.
- **PLA-F-28.3** THE SYSTEM SHALL NOT include any value, any snippet, or any
  excerpt of a diff.
- **PLA-F-28.4** THE SYSTEM SHALL render the badge from the counts only (shields
  style SVG), with a text alternative inside the SVG (`<title>`), and SHALL keep
  it under 4 KiB.

*Acceptance criteria*

- [ ] `markdown` and `badgeSvg` contain no planted value (property test).
- [ ] The badge `<title>` reads e.g. "Placard: 12 treated, 0 open".
- [ ] Regenerating the certificate is deterministic apart from the date.

### PLA-F-29 — Dismissal with rationale

- **PLA-F-29.1** WHEN the ritual CLI receives `ritual --action rotate --reason`
  on a personal-data finding THE SYSTEM SHALL record a not-applicable rotation
  with that reason, never a silent skip.
- **PLA-F-29.2** WHEN a finding is dismissed as a false positive THE SYSTEM SHALL
  write an exclusion entry through `appendIgnoreEntry` from `@placard/analysis`
  (one implementation), keyed by fingerprint, with the mandatory reason, the
  author and the date.
- **PLA-F-29.3** THE SYSTEM SHALL NOT accept a dismissal without a rationale of
  at least 3 characters.
- **PLA-F-29.4** WHEN a finding is dismissed THE SYSTEM SHALL keep it visible in
  the manor (ribbon) and in the registry, and SHALL exclude it from the open
  count of the hall.

*Acceptance criteria*

- [ ] Dismissing writes exactly one YAML entry and the next scan reports the
      finding as `ignored` with the reason.
- [ ] An empty rationale is rejected with a typed error.
- [ ] The exclusion entry contains the fingerprint, never the value.

### PLA-P-09 — Order lock is unbreakable (property)

- **PLA-P-09.1** FOR ALL sequences of ritual calls (any order, any repetition),
  `generatePurge` SHALL succeed only if `rotate` is done or not applicable.
- **PLA-P-09.2** FOR ALL sequences, a finding SHALL be sealed only if its
  `verify.stillFound === false` and its `rotate` step is done or not applicable.
- **PLA-P-09.3** FOR ALL sequences, the state machine SHALL be monotone: once a
  step is `done`, no later call SHALL set it back to `false`, and `sealedAt` SHALL
  never be cleared.
- **PLA-P-09.4** FOR ALL sequences, the persisted state SHALL be schema-valid
  JSON and reloadable, and reloading SHALL yield the same `steps()` locks.

*Acceptance criteria*

- [ ] `fast-check` over random call sequences (100 runs × 20 calls): no
      violation, no throw other than the documented typed errors.
- [ ] Round-trip `saveState` → `loadState` → `steps()` is stable.

## 6. Traceability

| Requirement | Verified by |
|---|---|
| PLA-F-22 | `packages/ritual/src/rotation.test.ts` |
| PLA-F-23 | `packages/ritual/src/steps.test.ts` |
| PLA-F-24 | `packages/ritual/src/no-exec.test.ts` |
| PLA-F-25 | `packages/ritual/src/purge.test.ts` |
| PLA-F-26 | `packages/ritual/src/prevention.test.ts` |
| PLA-F-27 | `packages/ritual/src/verify.test.ts` |
| PLA-F-28 | `packages/ritual/src/certificate.test.ts` |
| PLA-F-29 | `packages/ritual/src/dismiss.test.ts` |
| PLA-P-09 | `packages/ritual/src/properties.test.ts` |
