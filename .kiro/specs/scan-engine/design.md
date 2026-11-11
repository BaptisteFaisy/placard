# Design — Scan Engine (`@placard/git-history`)

> Kiro spec · workflow: **requirements first** (see `requirements.md`)
> Implements PLA-F-01, PLA-F-10, PLA-F-12, PLA-N-01, PLA-N-03, PLA-N-04,
> PLA-P-05, PLA-P-10, PLA-P-12.

## 1. Architecture

```
                       ReadHistoryOptions
                               |
                      +--------v---------+
                      |   HistoryReader  |   read(options)
                      +--------+---------+
                               |
              +----------------+-----------------+
              |                                  |
     stagedOnly: true                    stagedOnly: false
              |                                  |
      +-------v--------+               +---------v---------+
      |  staged-diff   |               |     snapshot      | repo event
      +-------+--------+               +---------+---------+
              |                                  |
              |                        +---------v---------+
              |                        |    size-probe     | (numstat/batch-check)
              |                        +---------+---------+
              |                                  |
              |                        +---------v---------+
              |                        |      walker       | rev-list -> per commit
              |                        +---------+---------+
              |                                  |
              |                        +---------v---------+
              |                        |   diff-parser     | -p stream -> DiffLineEvent
              |                        +---------+---------+
              |                                  |
              +----------------+-----------------+
                               |
                     +---------v----------+
                     |   event-sink       |  ordering, backpressure,
                     | (progress, abort)  |  accounting, AbortSignal
                     +---------+----------+
                               |
                        onEvent(HistoryEvent)  ->  ReadHistoryResult
```

Everything is pull-based inside, push-based outside: the sink is the only place
that calls `onEvent`, which keeps ordering, backpressure and accounting in one
testable module.

## 2. Modules and responsibilities

| Module | Responsibility | Public surface |
|---|---|---|
| `snapshot.ts` | Read `HEAD`, refs, tags, remotes, commit count, first/last dates; decide `publicRemote` from URL shape only. | `readSnapshot(repoDir): Promise<RepoSnapshot>` |
| `size-probe.ts` | For a commit, decide which blobs are analysable without loading them (`diff --numstat`, `cat-file --batch-check`). | `probe(commit, options): Promise<ProbeResult>` |
| `walker.ts` | Drive `git rev-list --topo-order --date-order`, respect `maxCommits`, emit `commit` events, hand each commit to the parser. | `walk(ctx): Promise<WalkCounts>` |
| `diff-parser.ts` | Parse `git diff-tree -p --no-color --no-ext-diff -U0` output into `DiffLineEvent`s; ignore hunk headers; keep both sides. | `parseDiffStream(stream, commit, sink): Promise<number>` |
| `binary.ts` | Classify a blob: binary if a NUL byte appears in the first 8 000 bytes or if `.gitattributes` marks it `binary`/`-diff`. | `isBinary(buf): boolean` |
| `staged-diff.ts` | `git diff --cached -U0` variant sharing `diff-parser.ts`. | `readStaged(options, sink)` |
| `paths.ts` | Normalise paths, apply `ignorePaths` globs, guarantee UTF-8 output and byte-order sorting. | `matchesIgnore(path, globs)` |
| `event-sink.ts` | Single emission point: progress cadence, abort checks, counters, backpressure. | `createSink(onEvent, signal)` |
| `index.ts` | Assemble the `HistoryReader` implementation; export types from `@placard/core`. | `reader: HistoryReader` |

Hard size limits apply: every file < 500 lines, every function < 50 lines, so
`diff-parser.ts` and `walker.ts` are split as soon as they approach the bound.

## 3. Interface contract (copied from `packages/core/src/contracts/git.ts`)

```ts
export interface DiffLineEvent {
  commit: string;
  path: string;
  line: number;
  text: string;
  side: 'added' | 'removed';
}

export interface CommitEvent {
  commit: string;
  shortCommit: string;
  date: string;
  year: number;
  author: string;
  subject: string;
  index: number;
}

export interface SkippedFileEvent {
  commit: string;
  path: string;
  reason: 'binary' | 'too_large';
  bytes?: number;
}

export type HistoryEvent =
  | { kind: 'repo'; repo: RepoSnapshot }
  | { kind: 'commit'; commit: CommitEvent }
  | { kind: 'line'; line: DiffLineEvent }
  | { kind: 'skipped'; skipped: SkippedFileEvent }
  | { kind: 'progress'; scanned: number; total: number }
  | { kind: 'end'; commits: number; lines: number };

export interface RepoSnapshot {
  name: string;
  head: string;
  shortHead: string;
  totalCommits: number;
  branches: string[];
  tags: string[];
  publicRemote: boolean;
  remotes: string[];
  firstCommitDate?: string;
  lastCommitDate?: string;
}

export interface ReadHistoryOptions {
  repoDir: string;
  refs?: string[];
  maxCommits?: number;
  maxFileBytes?: number;
  ignorePaths?: string[];
  stagedOnly?: boolean;
  onEvent: (event: HistoryEvent) => void;
  signal?: AbortSignal;
}

export interface ReadHistoryResult {
  repo: RepoSnapshot;
  commits: number;
  lines: number;
  skipped: { binary: number; tooLarge: number };
  aborted: boolean;
}

export interface HistoryReader {
  read(options: ReadHistoryOptions): Promise<ReadHistoryResult>;
}
```

The implementation may add internal types but SHALL NOT change these
signatures: the contract file is the interface, to the letter.

## 4. Key decisions and rationale

1. **Shell out to `git`, no libgit2.** Zero new dependency, exact semantics of
   the user's Git, and free support for packs, alternates, shallow clones and
   worktrees. Cost: we must parse plumbing output defensively, which the parser
   does with NUL-delimited records rather than human-readable output.
2. **`-U0` unified diff, not `git log -p` with default context.** Context lines
   would re-emit lines already seen and inflate both runtime and false grouping.
   `-U0` gives exactly the added and removed lines.
3. **Both sides of the diff.** PLA-F-01 requires removal commits: that is how
   `@placard/analysis` learns a secret's death date, and how the manor draws a
   footprint that ends. Reading only additions would make every secret immortal.
4. **Size probe before diff.** `git log -p` on a history containing a
   5 MiB blob (the exact failure recorded in `KIRO_JOURNAL.md` §8) saturates
   Node's heap. `--numstat` + `cat-file --batch-check` decide binary/oversized
   *before* the patch stream is requested for that path, and the decision is
   reported as a `skipped` event rather than swallowed.
5. **Truncate lines at 65 536 characters.** Detector regexes are bounded; an
   unbounded line would let a hostile repository drive the cost. Truncation is
   lossy but the truncation point is far beyond any realistic secret line, and
   it keeps PLA-P-10 provable.
6. **`--topo-order --date-order`.** Guarantees parents before children within a
   branch and a stable order for parallel branches, which is what makes PLA-P-05
   achievable without sorting the whole history in memory.
7. **One sink.** Progress cadence, abort and counters live in one place; a test
   can assert PLA-P-12 against a stub `onEvent`.
8. **`publicRemote` is a URL heuristic.** `git@host:owner/repo` and
   `https://host/owner/repo` count as public unless the host is a private
   pattern (`localhost`, `127.0.0.1`, `*.local`, `*.internal`, `*.lan`,
   `10.*`, `192.168.*`, `172.16-31.*`). No network call (PLA-N-01).

## 5. Streaming pipeline in detail

```
rev-list --topo-order --date-order --all
   │  (one SHA per line, 40/64 bytes)
   ├─> commit event  ────────────────────────────────┐
   │                                                  │
   ├─> numstat (name-status + counts, no content)     │
   │      ├─ binary?      -> skipped(binary) ─────────┤
   │      ├─ bytes > max? -> skipped(too_large) ──────┤
   │      └─ text         -> diff-tree -p -U0 ──┐     │
   │                                            │     │
   │                        hunk parser ────────┘     │
   │                              │                   │
   │                              └─> line events ────┤
   │                                                  │
   └─> progress every 200 commits / 250 ms ───────────┘
                                                      │
                                                    end
```

The parser is a line-oriented state machine:

```
state: idle | header | hunk
'commit <sha>'        -> idle (defensive: another commit began)
'diff --git a/x b/x'  -> header, capture path from '+++ b/x' or '--- a/x'
'@@ -a,b +c,d @@'     -> hunk, nextLine = c
'+<text>'             -> emit added at nextLine, nextLine++
'-<text>'             -> emit removed at lastRemovedLine+1 (see below)
' <text>'             -> context (only with -U0, so rare) : ignore
'\ No newline at EOF' -> ignore
```

Removed lines have no line number in the new version of the file. We report the
number the removed line occupied in the *previous* version, carried in the hunk
header (`-a,b`). This is documented because `@placard/analysis` displays it as
`line` and the manor uses it only as a key, never as a sort key.

## 6. Edge cases

| Case | Behaviour |
|---|---|
| Empty repository (no commit) | `repo` event with `head: ''`, `totalCommits: 0`, then `end` with zeros. No throw. |
| Bare repository | Supported: `--git-dir` is used; no working tree assumed. |
| Shallow clone | Walks what is present; `totalCommits` reflects the shallow history; no warning beyond `RepoSnapshot`. |
| Unborn HEAD with staged files | `stagedOnly` still works (`diff --cached` against the empty tree). |
| Merge commit | With `-U0` and default `--diff-merges=first-parent`-free behaviour we request `--diff-merges=separate` so merge diffs are not silently empty; combined diffs are parsed as added lines only. |
| Renames | `--no-renames` for determinism: a rename becomes delete + add, which is what a detector needs (the same value appears on both sides). |
| Submodule gitlink / symlink | Skipped silently, not counted (PLA-N-03.4). |
| Path with newline | Read via `-z` NUL-delimited output; the raw path is preserved. |
| `.gitattributes` binary | Honoured by `git diff --numstat` reporting `-` counts; treated as binary. |
| Non-UTF-8 content | Decoded as UTF-8 with `fatal: false`; replacement characters are kept, the value is not silently dropped. |
| CRLF | `core.autocrlf` is not overridden; text keeps its `\r` and detectors strip it before validation. |
| `maxFileBytes: 0` | Every file is `too_large`; the walk still completes. |
| Abort before first commit | `aborted: true`, zero events after `repo`. |

## 7. Performance strategy

- **One `git` process per phase**, never one per commit: `rev-list` streams all
  SHAs, then a single long-lived `cat-file --batch-check` child answers size
  queries. `diff-tree` is spawned per commit but with `-U0`, and its output is
  consumed as a stream, never collected.
- **Early rejection** by `numstat`: binary and oversized blobs never reach the
  parser, so the 5-minute CI budget (see `docs/CI-QUEUE.md`) is spent on text.
- **No regex over the whole file**: the parser is a `for` loop over lines with
  `startsWith` checks; the only regexes are anchored header matchers.
- **Backpressure**: the sink counts pending emissions and yields to the event
  loop every 4 096 lines, so a slow `onEvent` (a React state update, say) cannot
  grow the heap without bound.
- **Cancellation**: `signal` is checked in the sink and between commits; the
  child process receives `SIGTERM` and is awaited, so no zombie `git` remains.

## 8. Error handling

| Situation | Result |
|---|---|
| `git` not found | `Error` with `code: 'git-missing'`, no events. |
| Not a repository | `Error` with `code: 'not-a-git-repo'`, no events. |
| `git` exits non-zero mid-walk | `end` event emitted with counts so far, then the typed error is thrown; `aborted: false`. |
| `onEvent` throws | The error propagates, the child is killed, no further events. |
| Abort | No error: `aborted: true`. |
| Unparsable hunk header | The hunk is skipped, counted as zero lines, and the walk continues (never a crash — PLA-P-10). |

Error messages never contain a line of content (PLA-N-02, enforced downstream by
the `redaction-guard` hook).

## 9. Open questions

- Should `totalCommits` count merge commits? Current answer: yes (it is the
  `rev-list --count` value), because progress must match the walk.
- Do we need `--diff-merges=separate` on repositories older than Git 2.31? The
  minimum supported version is recorded in the package `package.json`
  (`engines`), and the fallback is a plain `diff-tree -p` per parent.
