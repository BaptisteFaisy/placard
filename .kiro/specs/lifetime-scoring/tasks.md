# Tasks — Lifetime & Danger Scoring (`@placard/analysis`)

> Kiro spec · workflow: **requirements first**
> Legend: `[x]` done · `[ ]` to do.

## Phase 0 — Scaffolding

- [x] **T0.1** Package skeleton, contract types re-exported from `@placard/core`.
  *Verify:* `pnpm --filter @placard/analysis typecheck`.
- [ ] **T0.2** `src/testkit.ts`: builds `AnchoredDetection`s from the shared event
  fixtures published by `@placard/git-history` (no local copy — zero duplication).
  *Verify:* the fixture module is imported, not duplicated.

## Phase 1 — Identity and grouping

- [ ] **T1.1** `src/identity.ts`: `fingerprintOf` + `previewOf` delegating to
  `computeFingerprint` / `redactPreview`.
  *Verify:* `identity.test.ts` — two detections of the same value share one
  fingerprint; the preview never equals the value (PLA-P-01.2).
- [ ] **T1.2** `src/grouping.ts`: group by fingerprint, resolve family conflicts
  (confidence, then base score), dedup identical `(commit, path, line)`.
  *Verify:* `grouping.test.ts` — 3 files × 2 commits of one value → one group
  with 5 locations (PLA-F-05.1, PLA-F-05.4).
- [ ] **T1.3** Determinism of grouping under permutation.
  *Verify:* `grouping.test.ts` with shuffled input arrays (PLA-P-03.1).

## Phase 2 — Lifetime

- [ ] **T2.1** `src/lifetime.ts`: arc reconstruction (added → removed,
  re-introduction → removal), earliest introduction, `removed[]` in
  chronological order.
  *Verify:* `lifetime.test.ts` — the add/remove/re-add fixture yields
  `introduced = c1`, `removed = [c2]`, `inHead = true` (PLA-F-06.1 … PLA-F-06.3).
- [ ] **T2.2** `inHead` from the `headPresence` map, with the consistency rule
  "no removal after the last addition when present".
  *Verify:* `lifetime.test.ts` cross-checked with `git grep` on the fixture
  (PLA-F-06.4, PLA-F-06.5).
- [ ] **T2.3** Location cap at 50 with an explicit reason line.
  *Verify:* a 60-location fixture yields 50 locations plus
  `+10 more locations` (PLA-F-06.6).

## Phase 3 — Scoring and ids

- [ ] **T3.1** `src/scoring.ts`: `computeDangerScore` + rule `scoreAdjust`,
  integer clamp, ordered `reasons`.
  *Verify:* `scoring.test.ts` — the three acceptance cases of PLA-F-07.
- [ ] **T3.2** `src/ids.ts`: `sk_NNNN` assignment, stable ordering (danger desc,
  date asc, fingerprint asc).
  *Verify:* `ids.test.ts` — two runs on the same input produce identical ids
  (PLA-F-05.2).
- [ ] **T3.3** Reason completeness: one reason per applied modifier.
  *Verify:* property test (PLA-P-07.5).

## Phase 4 — Exclusions

- [ ] **T4.1** `src/ignore.ts`: `loadIgnoreFile` (missing file → empty map),
  entry validation, stale-entry detection.
  *Verify:* `ignore.test.ts` (PLA-F-09.1, PLA-F-09.3, PLA-F-09.4, PLA-F-29.5).
- [ ] **T4.2** `appendIgnoreEntry`: create file/dir, append YAML, replace on
  duplicate fingerprint, reject empty reason, never write the value.
  *Verify:* `ignore-write.test.ts` (PLA-F-29.1 … PLA-F-29.4).
- [ ] **T4.3** Apply exclusions to findings: `state: 'ignored'`, `ignoreReason`.
  *Verify:* `ignore.test.ts` — removing the entry restores `open`
  (PLA-F-09.2).

## Phase 5 — Report and state

- [ ] **T5.1** `src/report.ts`: assemble `PlacardReport`, validate with
  `parseReport`, serialise with `stringifyReport`, write atomically
  (temp file + rename).
  *Verify:* `report.test.ts` — round-trip parse succeeds; two runs differ only
  by `analyzedAt` (PLA-F-08.1, PLA-F-08.5).
- [ ] **T5.2** Snippet sanitation with `sanitizeSnippet` before serialisation.
  *Verify:* `redaction.test.ts` — no snippet contains the value
  (PLA-F-08.3, PLA-P-01.3). This is the file watched by the
  `redaction-guard` Kiro hook.
- [ ] **T5.3** `src/state.ts`: overlay ritual state files onto findings
  (`rotated`, `purged`, `sealed`) without changing `danger`.
  *Verify:* `state.test.ts` (PLA-P-08.3).

## Phase 6 — Engine and properties

- [ ] **T6.1** `src/engine.ts`: `analyze()` orchestration, `onProgress` emission
  per phase and every 500 groups, `durationMs`.
  *Verify:* `engine.test.ts` — progress kinds appear in order
  `scanning → grouping → scoring → report`.
- [ ] **T6.2** `src/properties.test.ts` — PLA-P-01 (no value in the report),
  PLA-P-03 (permutation invariance), PLA-P-06 (oracle locations/lifetime),
  PLA-P-07 (monotonicity, 10 000 draws), PLA-P-08 (exclusion completeness).
  *Verify:* `pnpm vitest run packages/analysis` green.
- [ ] **T6.3** Salt management: generate `.placard/salt` (0600) when absent,
  reuse it afterwards, refuse to run when unreadable.
  *Verify:* `salt.test.ts` — permissions are `0600` (`stat`), and `.gitignore`
  covers `.placard/salt`.

## Phase 7 — Hand-off

- [ ] **T7.1** Export `analysisApi` (`analyze`, `loadIgnoreFile`,
  `appendIgnoreEntry`) exactly as the contract declares it.
  *Verify:* `packages/cli` imports the object without a cast.
- [ ] **T7.2** Document the report schema in `docs/architecture.md` and keep the
  two descriptions in sync.
  *Verify:* manual diff review at merge time.
