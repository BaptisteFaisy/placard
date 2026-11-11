# Requirements — Scan Engine (`@placard/git-history`)

> Kiro spec · workflow: **requirements first**
> Requirements: PLA-F-01, PLA-F-10, PLA-F-12, PLA-N-01, PLA-N-03, PLA-N-04,
> Properties: PLA-P-05, PLA-P-10, PLA-P-12
> Package: `packages/git-history/` · Contract: `packages/core/src/contracts/git.ts`

## 1. Context

Placard answers one question: *what did we leak, when did it enter the
repository, and is it still there?* Answering it requires walking the whole
reachable history of a repository — every ref, every commit, every added **and
removed** line — without loading the repository into memory and without ever
copying a candidate value anywhere but in-process.

The scan engine is the only package allowed to talk to `git`. Everything
downstream (detectors, analysis, manor, ritual) consumes the event stream it
emits. Its contract is therefore the narrowest and the most load-bearing part of
the monorepo: a wrong event here corrupts lifetimes, danger scores, and the
haunted manor.

## 2. Goals

1. Emit a deterministic, ordered stream of `HistoryEvent`s for any local
   repository, bare or not, shallow or complete.
2. Read both sides of every diff so that removal commits are observable.
3. Survive hostile content (NUL bytes, megabyte lines, control sequences,
   invalid UTF-8, broken encodings) without throwing and without unbounded
   memory growth.
4. Account for what was *not* analysed: binary and oversized files are counted
   and reported, never silently dropped.
5. Report progress that a terminal UI can render without lying about the total.
6. Stay local-first: no network, no writes to the analysed repository.

## 3. Non-goals

- Detecting secrets. The engine is content-agnostic; it never inspects a value.
- Reimplementing Git. We shell out to the `git` binary and parse its plumbing
  output; no libgit2, no new dependency.
- Network remotes inspection. Whether a remote is public is inferred from the
  configured URLs only (`RepoSnapshot.publicRemote`); no HTTP request is made.
- Rewriting history. Purge scripts belong to `@placard/ritual`; this package is
  strictly read-only.

## 4. Glossary

| Term | Meaning |
|---|---|
| Event | One item of `HistoryEvent`: `repo`, `commit`, `line`, `skipped`, `progress`, `end`. |
| Side | `added` or `removed`: which half of the diff the line came from. |
| Skipped file | A blob not diffed because it is binary or larger than `maxFileBytes`. |
| Streaming | Constant memory with respect to history size: one commit's diff is materialised at a time. |
| Hostile content | Bytes a repository may legally contain but that break naive parsers. |

## 5. Requirements (EARS)

### PLA-F-01 — Walk the full reachable history and account for what was skipped

- **PLA-F-01.1** WHEN a scan starts THE SYSTEM SHALL emit exactly one `repo`
  event carrying a `RepoSnapshot` (name, head, shortHead, totalCommits,
  branches, tags, remotes, publicRemote, first/last commit dates).
- **PLA-F-01.2** WHEN no `refs` option is given THE SYSTEM SHALL walk every
  reachable commit of every local ref (`--all`), and WHEN `refs` is given THE
  SYSTEM SHALL walk only the listed refs.
- **PLA-F-01.3** WHEN a commit is visited THE SYSTEM SHALL emit one `commit`
  event *before* any `line` event belonging to that commit, with `index`
  increasing by one from `0`.
- **PLA-F-01.4** WHEN a commit modifies a text file THE SYSTEM SHALL emit a
  `line` event for every added line (`side: 'added'`) and every removed line
  (`side: 'removed'`), each carrying the commit SHA, the file path, the 1-based
  line number in the new version, and the raw text without the `+`/`-` prefix.
- **PLA-F-01.5** IF a blob is binary or larger than `maxFileBytes` (default
  1 048 576 bytes) THEN THE SYSTEM SHALL emit one `skipped` event for it, with
  `reason` set to `binary` or `too_large` and `bytes` when known, and SHALL NOT
  emit any `line` event for that blob.
- **PLA-F-01.6** WHEN the walk finishes THE SYSTEM SHALL emit one `end` event
  and resolve with a `ReadHistoryResult` whose `commits`, `lines` and
  `skipped: { binary, tooLarge }` equal the counts of the events actually
  emitted.

*Acceptance criteria*

- [ ] A repository with a secret added in commit A and deleted in commit B
      produces `added` lines at A and `removed` lines at B for the same path.
- [ ] `commits` from the result equals the number of `commit` events.
- [ ] A 2 MiB text blob produces exactly one `skipped` event with
      `reason: 'too_large'` and `bytes >= 2 097 152`, and zero `line` events.
- [ ] A file containing a NUL byte in its first 8 000 bytes produces exactly one
      `skipped` event with `reason: 'binary'`.
- [ ] An empty repository (no commit) resolves with `commits: 0`, `lines: 0`,
      and no throw.

### PLA-F-10 — Staged-only mode

- **PLA-F-10.1** WHERE `stagedOnly: true` is set THE SYSTEM SHALL read the
  index diff only (`git diff --cached`), emitting `line` events for staged
  additions and removals, and SHALL NOT walk history.
- **PLA-F-10.2** WHERE `stagedOnly: true` is set THE SYSTEM SHALL still emit the
  `repo` event and a final `end` event, so that the CLI and the pre-commit hook
  share one event contract.
- **PLA-F-10.3** IF the index is empty THEN THE SYSTEM SHALL resolve with
  `commits: 0`, `lines: 0` and `skipped: { binary: 0, tooLarge: 0 }` without
  throwing.
- **PLA-F-10.4** WHEN a staged scan finds at least one line the pre-commit
  consumer SHALL be able to fail the commit; the engine SHALL expose the staged
  lines with `side` preserved so the caller can distinguish addition from
  deletion.

*Acceptance criteria*

- [ ] `git add` of a file with a candidate value then a staged scan yields an
      `added` line for that path; unstaged edits of the same file are absent.
- [ ] A staged scan of a clean index emits zero `line` events and exits
      successfully.

### PLA-F-12 — Progress reporting

- **PLA-F-12.1** WHILE walking history THE SYSTEM SHALL emit `progress` events
  at a bounded cadence (at most one per 250 ms and at least one every 200
  commits), each carrying `scanned` and `total`.
- **PLA-F-12.2** THE SYSTEM SHALL set `total` from the commit count obtained
  before the walk (or from `maxCommits` when it is lower), so that a progress bar
  cannot exceed 100 %.
- **PLA-F-12.3** WHERE `maxCommits > 0` THE SYSTEM SHALL stop after that many
  commits and still emit the `end` event, reporting the truncated count.
- **PLA-F-12.4** WHERE an `AbortSignal` aborts mid-walk THE SYSTEM SHALL stop
  promptly (within one commit), emit the `end` event, and resolve with
  `aborted: true`.

*Acceptance criteria*

- [ ] `scanned` is non-decreasing across all `progress` events.
- [ ] For every `progress` event, `scanned <= total`.
- [ ] Aborting after the first `commit` event resolves with `aborted: true` and
      leaves no orphan `git` child process.

### PLA-N-01 — Local-first and read-only

- **PLA-N-01.1** THE SYSTEM SHALL perform no network access: it SHALL only
  execute the local `git` binary.
- **PLA-N-01.2** THE SYSTEM SHALL NOT modify the analysed repository: no ref
  update, no index write, no working-tree write, no `.git` lock left behind.
- **PLA-N-01.3** IF the target directory is not a Git repository THEN THE
  SYSTEM SHALL fail with a typed error mapped to `CliErrorCode`
  `not-a-git-repo`; IF `git` is not on `PATH` THEN THE SYSTEM SHALL fail with
  `git-missing`.
- **PLA-N-01.4** THE SYSTEM SHALL NOT write the diff stream to disk, and SHALL
  NOT log line contents.

*Acceptance criteria*

- [ ] Running a full scan leaves `git status --porcelain` empty and
      `git for-each-ref` unchanged.
- [ ] The engine makes no DNS/socket call (verified by an offline test run).

### PLA-N-03 — Hostile content is expected, not exceptional

- **PLA-N-03.1** THE SYSTEM SHALL accept blobs containing NUL bytes, control
  characters, invalid UTF-8 sequences, CRLF line endings, and lines up to
  `maxFileBytes` in length, without throwing.
- **PLA-N-03.2** WHEN a line exceeds 65 536 characters THE SYSTEM SHALL truncate
  the emitted `text` to 65 536 characters and SHALL keep scanning.
- **PLA-N-03.3** WHEN a path contains spaces, quotes, tabs, newlines, or
  non-ASCII characters THE SYSTEM SHALL report it exactly (NUL-terminated
  plumbing output, not locale-dependent human output).
- **PLA-N-03.4** IF a submodule gitlink or a symlink is encountered THEN THE
  SYSTEM SHALL skip it silently (not counted as binary, not counted as
  too large) and continue.

*Acceptance criteria*

- [ ] A generated hostile repository (NUL bytes, 1 MiB single line, `\r\n`,
      binary blob, UTF-8 path with emoji) scans to completion with exit code 0.
- [ ] No `line` event has `text.length > 65 536`.

### PLA-N-04 — Bounded memory

- **PLA-N-04.1** THE SYSTEM SHALL NOT materialise the whole history: at most one
  commit's diff SHALL be held in memory at a time.
- **PLA-N-04.2** WHEN probing a blob's size or binary nature THE SYSTEM SHALL
  use plumbing that does not load the blob content (`cat-file --batch-check`,
  `diff --numstat`), so oversized blobs cost O(1) memory.
- **PLA-N-04.3** THE SYSTEM SHALL apply backpressure: it SHALL NOT buffer more
  than 4 096 pending `line` events when `onEvent` is synchronous.
- **PLA-N-04.4** A scan of a 100 000-commit repository SHALL keep the process
  under 512 MiB resident memory.

*Acceptance criteria*

- [ ] Peak RSS stays under 512 MiB on the synthetic 100 k-commit repository.
- [ ] A 50 MiB blob in history produces one `skipped` event and no memory spike
      above the baseline of an empty scan by more than 32 MiB.

### PLA-P-05 — Determinism (property)

- **PLA-P-05.1** FOR ALL repositories, two consecutive scans with identical
  options SHALL emit byte-identical event sequences (same order, same fields),
  except for the wall-clock `analyzedAt` recorded downstream.
- **PLA-P-05.2** FOR ALL repositories, the walk order SHALL be fully specified:
  commits in `git rev-list --topo-order --date-order` order, refs sorted by
  name, paths sorted by byte order within a commit.
- **PLA-P-05.3** FOR ALL repositories, the result counts SHALL be independent of
  the machine, locale (`LC_ALL`), Git version above the minimum, and of whether
  `core.quotepath` is on.

*Acceptance criteria*

- [ ] `fast-check` property over generated repositories: `scan(repo) === scan(repo)`.
- [ ] Running twice with `LC_ALL=C` and `LC_ALL=fr_FR.UTF-8` yields identical
      event hashes.

### PLA-P-10 — No crash on hostile input (property)

- **PLA-P-10.1** FOR ALL byte sequences `b` placed in a tracked file, the scan
  SHALL terminate and SHALL NOT throw; it SHALL either emit `line` events for
  `b` or one `skipped` event for it.
- **PLA-P-10.2** FOR ALL paths `p` accepted by the filesystem, the scan SHALL
  report `p` and SHALL NOT throw.
- **PLA-P-10.3** FOR ALL `maxFileBytes` values in `[0, 10 MiB]`, the engine
  SHALL behave monotonically: increasing the bound SHALL never reduce the number
  of analysed files.

*Acceptance criteria*

- [ ] `fast-check` with `fc.uint8Array()` payloads: 500 runs, zero throws.
- [ ] `fast-check` with `fc.string()` paths (printable + control): 500 runs,
      zero throws.

### PLA-P-12 — Progress and accounting consistency (property)

- **PLA-P-12.1** FOR ALL repositories, the sequence of `progress.scanned` values
  SHALL be non-decreasing and bounded by `total`.
- **PLA-P-12.2** FOR ALL repositories, the `end` event counts SHALL equal the
  number of `commit` events and of `line` events emitted.
- **PLA-P-12.3** FOR ALL repositories, `skipped.binary + skipped.tooLarge` SHALL
  equal the number of `skipped` events emitted.
- **PLA-P-12.4** FOR ALL repositories, the number of `line` events for a commit
  SHALL be zero if and only if that commit emitted only `skipped` events or no
  file change at all.

*Acceptance criteria*

- [ ] `fast-check` over generated repositories: accounting invariants hold for
      300 runs.
- [ ] A repository with only binary changes yields `lines: 0` and a non-zero
      `skipped.binary`.

## 6. Traceability

| Requirement | Verified by | Spec section |
|---|---|---|
| PLA-F-01 | `packages/git-history/src/walk.test.ts` | 5 |
| PLA-F-10 | `packages/git-history/src/staged.test.ts` | 5 |
| PLA-F-12 | `packages/git-history/src/progress.test.ts` | 5 |
| PLA-N-01 | `packages/git-history/src/readonly.test.ts` | 5 |
| PLA-N-03 | `packages/git-history/src/hostile.test.ts` | 5 |
| PLA-N-04 | `packages/git-history/src/memory.test.ts` | 5 |
| PLA-P-05 | `packages/git-history/src/properties.test.ts` | 5 |
| PLA-P-10 | `packages/git-history/src/properties.test.ts` | 5 |
| PLA-P-12 | `packages/git-history/src/properties.test.ts` | 5 |
