# Tasks — The Remediation Ritual (`@placard/ritual`)

> Kiro spec · workflow: **requirements first**
> Legend: `[x]` done · `[ ]` to do.

## Phase 0 — Scaffolding

- [x] **T0.1** Package skeleton, contract types re-exported from `@placard/core`.
  *Verify:* `pnpm --filter @placard/ritual typecheck`.

## Phase 1 — Steps and state

- [ ] **T1.1** `src/steps.ts`: build the four steps, derive locks from state,
  fixed titles/descriptions in English.
  *Verify:* `steps.test.ts` — one unlocked step with no state; unlock cascade
  after each recorded fact (PLA-F-23.1 … PLA-F-23.5).
- [ ] **T1.2** `src/state.ts`: `loadState` / `saveState`, atomic write, schema
  validation, corrupt-file tolerance.
  *Verify:* `state.test.ts` — round-trip stability and corrupt-file behaviour.
- [ ] **T1.3** `markRotated`: done or not-applicable, reason ≥ 3 characters,
  refuses on a sealed finding.
  *Verify:* `rotate.test.ts` (PLA-F-23.6, PLA-P-09.3).

## Phase 2 — Rotation cards

- [ ] **T2.1** `src/rotation.ts`: cards for AWS, GitHub, Stripe, Google Cloud,
  Slack + generic fallback; `notApplicable` for `identity` / `bank-data` with a
  notice.
  *Verify:* `rotation.test.ts` — every built-in rule id resolves; `docUrl` is
  `https://` (PLA-F-22.1 … PLA-F-22.4).
- [ ] **T2.2** Checklist with the four mandatory items (revocation confirmed,
  last usage, downstream copies, deployments to update).
  *Verify:* `rotation.test.ts` (PLA-F-22.5).

## Phase 3 — Purge artifacts

- [ ] **T3.1** `src/script-template.ts`: script body with confirmation flag,
  `HEAD` guard, mirror clone, `filter-repo --replace-text`, post-checks.
  *Verify:* `script.test.ts` — running without the flag exits non-zero
  (PLA-F-24.4).
- [ ] **T3.2** `src/purge.ts`: write script (executable, no value), write
  replacements file in `tmpDir` with mode 0600, `secure` verified with `stat`.
  *Verify:* `purge.test.ts` (PLA-F-25.1, PLA-F-25.2, PLA-F-25.5).
- [ ] **T3.3** `commands` and `warnings` content (≥ 6 warnings).
  *Verify:* `purge.test.ts` (PLA-F-25.3, PLA-F-25.4).
- [ ] **T3.4** Refusal path: `generatePurge` without rotation throws
  `rotation-required` and writes nothing.
  *Verify:* `purge.test.ts` (PLA-F-23.2, PLA-P-09.1).
- [ ] **T3.5** `src/no-exec.test.ts`: assert no `filter-repo` / `push --force` /
  `filter-branch` process is ever spawned, and that the repository's refs are
  unchanged after a full ritual.
  *Verify:* `git for-each-ref` identical before and after (PLA-F-24.1 … 24.3).

## Phase 4 — Prevention

- [ ] **T4.1** `src/prevention.ts`: `.gitignore` lines from risky paths,
  pre-commit hook content (`placard scan --staged`), hook path, reminders
  (push protection, secret scanning, shared-scope credentials).
  *Verify:* `prevention.test.ts` (PLA-F-26.1 … PLA-F-26.4).
- [ ] **T4.2** Determinism: two calls return identical proposals.

## Phase 5 — Verification and certificate

- [ ] **T5.1** `src/verify.ts`: load report, build the fingerprint set, set
  `stillFound`, seal only when absent and rotation recorded.
  *Verify:* `verify.test.ts` (PLA-F-27.1 … PLA-F-27.5).
- [ ] **T5.2** `src/certificate.ts`: `PLACARD.md` + badge SVG from counts and
  previews, no snippet, `<title>` in the SVG, badge < 4 KiB.
  *Verify:* `certificate.test.ts` (PLA-F-28.1 … PLA-F-28.4).
- [ ] **T5.3** Property test: no planted value appears in the certificate.
  *Verify:* `fast-check` over generated reports.

## Phase 6 — Dismissal

- [ ] **T6.1** `src/dismiss.ts`: delegate to `appendIgnoreEntry` from
  `@placard/analysis` (one implementation), reject short rationales.
  *Verify:* `dismiss.test.ts` (PLA-F-29.1 … PLA-F-29.4).
- [ ] **T6.2** Cross-check: after dismissal, the next analysis reports
  `state: 'ignored'` with the same reason.
  *Verify:* integration test with the demo repository.

## Phase 7 — Properties and hand-off

- [ ] **T7.1** `src/properties.test.ts`: PLA-P-09 — random call sequences,
  monotonicity, seal precondition, persistence round-trip.
  *Verify:* `pnpm vitest run packages/ritual` green, 100 × 20 calls.
- [ ] **T7.2** Export `ritualApi` exactly as the contract declares it.
  *Verify:* `packages/cli` imports the object without a cast.
- [ ] **T7.3** Document the four steps and the lock reasons in the UI strings
  file (`@placard/core` i18n), so the manor and the CLI share one wording.
  *Verify:* no duplicated step title in `packages/ui`.
