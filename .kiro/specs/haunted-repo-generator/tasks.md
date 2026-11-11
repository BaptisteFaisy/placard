# Tasks — Haunted Repo Generator (`@placard/demo-repo`)

> Kiro spec · workflow: **Quick Spec**
> Legend: `[x]` done · `[ ]` to do.

## Phase 0 — Scaffolding

- [x] **T0.1** Package skeleton, contract types re-exported from `@placard/core`.
  *Verify:* `pnpm --filter @placard/demo-repo typecheck`.

## Phase 1 — Deterministic core

- [ ] **T1.1** `src/prng.ts`: mulberry32 seeded by `sha256(seed)`; `rand`,
  `int`, `pick`, `shuffle`.
  *Verify:* `prng.test.ts` — same seed twice → same first 1 000 values;
  different seeds differ.
- [ ] **T1.2** `src/values.ts`: `fakeValue(family, seed, index)` delegating to
  the `@placard/core` factory.
  *Verify:* `fake-value.test.ts` — determinism, and each value is recognised by
  the detector engine with the family's expected rule (PLA-F-13.9).
- [ ] **T1.3** `src/timeline.ts`: monotonic dates over `years`, filler commits
  interleaved.
  *Verify:* `timeline.test.ts` — dates strictly increasing, count equals
  `commits` (PLA-F-13.10).

## Phase 2 — Planting plan

- [ ] **T2.1** `src/planting.ts`: family/path/lifetime assignment with the
  guaranteed mix (≥ 3 in `HEAD`, ≥ 3 removed, ≥ 2 test paths, ≥ 1 lifetime
  > 1 year), at least one per family.
  *Verify:* `planting.test.ts` — invariants hold for 50 seeds (PLA-F-13.3,
  PLA-F-13.6).
- [ ] **T2.2** `src/templates.ts`: source/config/test file templates with a
  `{{VALUE}}` placeholder; no literal secret-shaped string anywhere.
  *Verify:* review + `self-scan` hook green (PLA-N-09.1).

## Phase 3 — Repository writer

- [ ] **T3.1** `src/repo.ts`: `git init -b main`, identity and dates from
  environment variables, one commit per timeline event, `publicRemote` URL.
  *Verify:* `generator.test.ts` — repository exists, `git log --format=%s`
  matches the plan, remote configured when asked (PLA-F-13.1, PLA-F-13.8).
- [ ] **T3.2** Guard rails: refuse a non-empty `targetDir`, refuse a path inside
  the tool repository.
  *Verify:* `guard.test.ts` (PLA-N-09.3).
- [ ] **T3.3** `src/oracle.ts`: patch `introducedCommit` / `removedCommit` from
  real SHAs, keep `inHead` and `locations`.
  *Verify:* `oracle.test.ts` — every planted record verified with `git show`
  and `git grep -F` (PLA-F-13.5).

## Phase 4 — Determinism and safety

- [ ] **T4.1** `src/determinism.test.ts`: two runs, same seed and `headDate` →
  identical `head` SHA and identical `planted` metadata.
  *Verify:* PLA-F-13.4.
- [ ] **T4.2** `src/no-secret.test.ts`: after a full run, no planted value is
  present in the tool repository (`git grep -F` over the worktree).
  *Verify:* PLA-N-09.1, PLA-N-09.2.
- [ ] **T4.3** Zero new dependency check.
  *Verify:* `git diff origin/main -- packages/demo-repo/package.json` shows no
  added dependency (PLA-N-09.4).

## Phase 5 — Hand-off

- [ ] **T5.1** Publish the oracle type so `@placard/analysis` and
  `@placard/detectors` property tests consume it without a local copy.
  *Verify:* PLA-P-02 / PLA-P-06 tests import from `@placard/demo-repo`.
- [ ] **T5.2** Wire `placard demo --open` to the generator (CLI lot).
  *Verify:* `pnpm placard demo` produces a repository and opens the manor.
