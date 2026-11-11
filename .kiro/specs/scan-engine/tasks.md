# Tasks — Scan Engine (`@placard/git-history`)

> Kiro spec · workflow: **requirements first**
> Order matters: each task is verifiable on its own, and every task names the
> file it touches and the check that proves it done.
> Legend: `[x]` done · `[ ]` to do.

## Phase 0 — Scaffolding

- [x] **T0.1** Create the package skeleton (`packages/git-history/package.json`,
  `tsconfig.json`, `src/index.ts` re-exporting `@placard/core` types).
  *Verify:* `pnpm --filter @placard/git-history typecheck` passes on the empty
  placeholder.
- [x] **T0.2** Wire the package into the workspace (`pnpm-workspace.yaml`,
  root `tsconfig` references) — done by the bootstrap commit.
  *Verify:* `pnpm -r typecheck` lists the package.
- [ ] **T0.3** Add `packages/git-history/src/testkit.ts`: temporary repository
  factory (`fs.mkdtemp` + `git init -b main`), all Git identity supplied through
  `GIT_AUTHOR_*` / `GIT_COMMITTER_*` environment variables, never global config.
  *Verify:* testkit test runs twice in a row on a machine with no global
  `user.email` and passes.

## Phase 1 — Events, sink and accounting

- [ ] **T1.1** `src/event-sink.ts`: `createSink(onEvent, signal)` with counters
  for commits, lines, `skipped.binary`, `skipped.tooLarge`, progress cadence
  (250 ms / 200 commits), abort check, backpressure yield every 4 096 lines.
  *Verify:* `src/event-sink.test.ts` asserts `scanned <= total` and
  non-decreasing `scanned` (PLA-F-12.1, PLA-P-12.1).
- [ ] **T1.2** `src/events.ts`: internal builders (`repoEvent`, `commitEvent`,
  `lineEvent`, `skippedEvent`) so no module hand-writes a shape.
  *Verify:* typecheck; no duplicated literal objects in the package
  (`grep -c "kind: 'line'"` returns 1).
- [ ] **T1.3** `src/index.ts`: assemble `HistoryReader.read` — emits `repo`,
  delegates, emits `end`, resolves `ReadHistoryResult`.
  *Verify:* `src/reader.test.ts` — a two-commit repository yields exactly one
  `repo` and one `end` event, and `end.commits` equals the `commit` count
  (PLA-F-01.1, PLA-F-01.6, PLA-P-12.2).

## Phase 2 — Snapshot

- [ ] **T2.1** `src/snapshot.ts`: `HEAD`/`shortHead`, branches, tags, remotes,
  `totalCommits` (`rev-list --count`), first/last commit dates.
  *Verify:* `src/snapshot.test.ts` against a fixture with 3 branches and 2 tags.
- [ ] **T2.2** `publicRemote` heuristic: public unless host matches a private
  pattern list (`localhost`, `*.local`, `*.internal`, RFC 1918 ranges).
  *Verify:* table-driven test with 8 URL shapes, zero network calls.
- [ ] **T2.3** Empty-repository and unborn-`HEAD` handling (`head: ''`).
  *Verify:* `git init` only → `readSnapshot` resolves, no throw (PLA-F-01.5
  acceptance, PLA-N-01.3).

## Phase 3 — Size and binary probe

- [ ] **T3.1** `src/binary.ts`: `isBinary(buf)` — NUL byte within the first
  8 000 bytes.
  *Verify:* unit test on crafted buffers (no real secret values, per PLA-N-09).
- [ ] **T3.2** `src/size-probe.ts`: one long-lived `cat-file --batch-check`
  child, `diff-tree --numstat -r` per commit; classify each path as
  `text | binary | too_large`.
  *Verify:* `src/size-probe.test.ts` — a 2 MiB blob yields `too_large` with
  `bytes >= 2 097 152`; a NUL-containing blob yields `binary` (PLA-F-01.5).
- [ ] **T3.3** `.gitattributes` binary handling and submodule/symlink exclusion.
  *Verify:* fixture with `*.bin binary` and a gitlink → zero `skipped` events for
  the gitlink (PLA-N-03.4).

## Phase 4 — Walker and diff parser

- [ ] **T4.1** `src/walker.ts`: `rev-list --topo-order --date-order --all`
  (or the `refs` list), `maxCommits` truncation, one `commit` event per commit
  with monotonic `index`.
  *Verify:* `src/walker.test.ts` — `index` is `0..n-1`, parents precede
  children within a branch (PLA-F-01.2, PLA-F-01.3).
- [ ] **T4.2** `src/diff-parser.ts`: state machine over `diff-tree -p -U0`
  emitting `added` and `removed` lines with path, line number and raw text.
  *Verify:* `src/diff-parser.test.ts` — a file with one line added then removed
  yields `added` at the introduction commit and `removed` at the removal commit
  (PLA-F-01.4).
- [ ] **T4.3** Path extraction from `+++`/`---` headers, including paths with
  spaces and quotes; NUL-delimited plumbing for names.
  *Verify:* fixture with `"dir with space/file name.txt"` and an emoji path
  (PLA-N-03.3).
- [ ] **T4.4** Line truncation at 65 536 characters.
  *Verify:* 1 MiB single-line fixture → emitted `text.length === 65_536`
  (PLA-N-03.2).
- [ ] **T4.5** `ignorePaths` glob filtering applied before the probe.
  *Verify:* `src/paths.test.ts` — ignored path emits neither `line` nor `skipped`.

## Phase 5 — Staged mode

- [ ] **T5.1** `src/staged-diff.ts`: `git diff --cached -U0` reusing
  `diff-parser.ts`, emitting `repo` then `line` events then `end`.
  *Verify:* `src/staged.test.ts` — staged add is visible, unstaged edit is not
  (PLA-F-10.1, PLA-F-10.4).
- [ ] **T5.2** Clean-index and empty-index behaviour.
  *Verify:* zero `line` events, `ReadHistoryResult.lines === 0`
  (PLA-F-10.3).

## Phase 6 — Robustness, cancellation, determinism

- [ ] **T6.1** Abort handling: `AbortSignal` checked in the sink and between
  commits; child killed and awaited.
  *Verify:* `src/abort.test.ts` — resolves `aborted: true`, no `git` child left
  (`pgrep -f 'git diff-tree'` empty) (PLA-F-12.4).
- [ ] **T6.2** Hostile-content fixture generator: NUL bytes, `\r\n`, invalid
  UTF-8, control sequences, 1 MiB line, 50 MiB blob.
  *Verify:* `src/hostile.test.ts` completes with exit code 0 (PLA-N-03.1).
- [ ] **T6.3** Property tests (`fast-check`):
  `read(read(repo)) === read(repo)` (PLA-P-05), no-throw over `uint8Array`
  payloads (PLA-P-10), accounting invariants (PLA-P-12).
  *Verify:* `pnpm vitest run packages/git-history` green, 300+ runs per property.
- [ ] **T6.4** Memory budget test: 100 000-commit synthetic history under
  512 MiB RSS; 50 MiB blob costs < 32 MiB above baseline.
  *Verify:* `src/memory.test.ts` (PLA-N-04.4), skipped in CI when
  `PLACARD_HEAVY_TESTS` is unset.

## Phase 7 — Documentation and hand-off

- [ ] **T7.1** JSDoc on `read` documenting the walk order, the line-number
  semantics for `removed` lines, and the truncation rule.
  *Verify:* `pnpm lint` (ESLint `jsdoc` rules) green.
- [ ] **T7.2** Publish the event fixtures used by `@placard/analysis` tests so the
  two packages share one oracle (`src/fixtures/events.ts`).
  *Verify:* `packages/analysis/src/analysis.test.ts` consumes the fixture
  without a local copy (zero duplication).
- [ ] **T7.3** Record the minimum Git version in `package.json` `engines` and the
  fallback for `--diff-merges=separate`.
  *Verify:* `pnpm typecheck` and the design note in `design.md` §9 agree.
