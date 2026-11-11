# Design — Lifetime & Danger Scoring (`@placard/analysis`)

> Kiro spec · workflow: **requirements first** (see `requirements.md`)
> Implements PLA-F-05 … PLA-F-09, PLA-F-29, PLA-P-01, PLA-P-03, PLA-P-06,
> PLA-P-07, PLA-P-08.

## 1. Architecture

```
 AnchoredDetection[]  (from detectors, via the scan engine)
          |
    +-----v------+      fingerprint = HMAC-SHA-256(value, salt)
    |  identity  |      ── the value dies here ──
    +-----+------+
          |  FingerprintRecord { fp, family, rule, preview, occurrences[] }
    +-----v------+
    |  grouping  |
    +-----+------+
          |  Group { fp, family, rule, locations[], commits[] }
    +-----v------+
    |  lifetime  |      arcs: added → removed, re-introduced → removed
    +-----+------+
          |  Group + introduced + removed[] + inHead
    +-----v------+
    |   scoring  |      computeDangerScore(core) + scoreAdjust
    +-----+------+
          |  Finding (id assigned)
    +-----v------+
    |  exclusions|      .placard/ignore.yml → state: ignored
    +-----+------+
          |
    +-----v------+
    |   report   |      reportSchema validation + stringifyReport
    +-----+------+
          |
     PlacardReport  ──> manor-model / cli / ritual
```

## 2. Modules and responsibilities

| Module | Responsibility |
|---|---|
| `identity.ts` | `fingerprintOf(detection, salt)` via `@placard/core`; builds the redacted preview. |
| `grouping.ts` | Groups detections by fingerprint, resolves family conflicts, dedups identical locations. |
| `lifetime.ts` | Per-group arc reconstruction: earliest introduction, all removals, `inHead` decision. |
| `scoring.ts` | Applies `computeDangerScore` plus rule `scoreAdjust`; builds `reasons`. |
| `ids.ts` | Stable `sk_NNNN` assignment (danger desc, date asc, fingerprint asc). |
| `ignore.ts` | `loadIgnoreFile`, `appendIgnoreEntry`, YAML (de)serialisation, validation. |
| `report.ts` | Assembles `PlacardReport`, validates with `parseReport`, serialises with `stringifyReport`. |
| `state.ts` | Applies ritual state (`.placard/state/*.json`) onto findings: `rotated`, `purged`, `sealed`. |
| `engine.ts` | `analyze(input, options)` orchestration + `onProgress` emission. |
| `index.ts` | `AnalysisApi` implementation. |

## 3. Interface contract (copied from `packages/core/src/contracts/analysis.ts`)

```ts
export interface AnchoredDetection {
  detection: RawDetection;
  commit: CommitEvent;
  path: string;
  lineNumber: number;
  context: string[];
}

export type AnalysisProgress =
  | { kind: 'scanning'; commits: number; lines: number; findings: number }
  | { kind: 'grouping'; groups: number }
  | { kind: 'scoring'; done: number; total: number }
  | { kind: 'report'; findings: number };

export interface AnalyzeOptions {
  repo: RepoSnapshot;
  salt: string;
  ignoreFile?: string;
  customRulesPath?: string;
  toolVersion: string;
  onProgress?: (progress: AnalysisProgress) => void;
}

export interface AnalysisInput {
  detections: AnchoredDetection[];
  skipped: SkippedFiles;
  repoMeta: RepoMeta;
  headPresence: ReadonlyMap<string, boolean>;
}

export interface AnalysisResult {
  report: PlacardReport;
  rawDetections: number;
  groups: number;
  durationMs: number;
}

export interface AnalysisEngine {
  analyze(input: AnalysisInput, options: AnalyzeOptions): Promise<AnalysisResult>;
}

export interface AnalysisApi {
  analyze: AnalysisEngine['analyze'];
  loadIgnoreFile(path: string | undefined): Promise<IgnoreMap>;
  appendIgnoreEntry(path: string, entry: IgnoreFileEntry): Promise<void>;
}

export type IgnoreMap = ReadonlyMap<string, IgnoreFileEntry>;

export interface IgnoreFileEntry {
  fingerprint: string;
  rule?: string;
  reason: string;
  author: string;
  date: string;
}
```

## 4. Report schema (produced here, consumed everywhere)

```jsonc
{
  "schema": "1.0.0",
  "tool": { "name": "placard", "version": "0.1.0" },
  "repo": {
    "name": "my-repo",
    "head": "<full sha>",
    "totalCommits": 4213,
    "publicRemote": true,
    "analyzedAt": "2026-10-31T09:12:44.512Z"
  },
  "findings": [
    {
      "id": "sk_0001",
      "family": "cloud-key",
      "rule": "aws-access-key",
      "fingerprint": "hmac256:3f9c…",       // 32 hex chars
      "preview": "<prefix>…(20)",           // redacted, never the value
      "danger": 100,
      "reasons": [
        "base cloud-key: +85",
        "still present in HEAD: +15",
        "public remote repository: +10"
      ],
      "inHead": true,
      "introduced": { "commit": "…", "shortCommit": "…", "date": "2024-02-11T…" },
      "removed": [],
      "locations": [
        { "commit": "…", "path": "deploy/values.yaml", "line": 42,
          "snippet": "key: [REDACTED:cloud-key]" }
      ],
      "state": "open"
    }
  ],
  "skipped": { "binary": 12, "tooLarge": 3 }
}
```

The schema is the single source of truth: `reportSchema` in
`packages/core/src/schema.ts` validates it on write and on read, and the web app
uses `safeParseReport` to reject a dropped file that is not a Placard report.

## 5. Key decisions and rationale

1. **Fingerprint is the identity, not the value.** Everything downstream (manor
   keys, footprint trails, ritual state files, exclusion entries) is keyed by
   `hmac256:…`. This is what makes PLA-P-01 structural rather than a discipline:
   after `identity.ts`, the value is not reachable by any later stage.
2. **Per-repository salt, stored in `.placard/salt` (mode 0600, git-ignored).**
   A global salt would let two reports be correlated (same key in two repos →
   same fingerprint); a per-repo salt prevents that while keeping stability
   across runs of the same repository.
3. **Family conflict resolution by confidence, then base score.** The same
   string can legitimately match a narrow rule and a broad one. Taking the
   narrow (higher-confidence) rule is what a human reviewer would do, and it
   keeps the score conservative in the right direction.
4. **Arcs, not a single span.** The re-introduction counter-example recorded in
   `KIRO_JOURNAL.md` §6 shows that "introduced / removed" as two scalars loses
   information. The implementation keeps `Arc[]` internally and projects it onto
   the contract's `introduced` + `removed[]`, so the public shape stays simple
   while the data stays correct.
5. **`inHead` comes from the caller, not from guesswork.** `headPresence` is a
   map built by the CLI with one `git grep -F -f <fingerprint-values>`-style pass
   over `HEAD`, so the analysis never re-walks history and never has to infer
   presence from the last commit in the walk.
6. **Stable ids.** Ids must survive between two runs: they appear in state files,
   in exclusion entries, in the ritual, and in user notes. Sorting by danger then
   date then fingerprint makes them stable as long as the repository is stable —
   and a re-scan after remediation deliberately renumbers nothing else.
7. **50-location cap.** A value pasted 4 000 times would produce a report larger
   than the manor can render and a JSON that no browser can load. The cap is
   visible (a reason line) rather than silent.
8. **Exclusions keep the finding.** Deleting a dismissed finding would make the
   manor lie about history and would let a `hold`-style dismissal hide a real
   leak. `state: 'ignored'` keeps it visible in `hall.dismissed`, with its
   rationale, and excludes it from `hall.open`.
9. **YAML for exclusions, JSON for state.** Exclusions are hand-edited by humans
   and reviewed in PRs (YAML, comments allowed); ritual state is machine-written
   (JSON, strict).
10. **Zod validation on write.** A programming error that puts a raw value into a
    finding would be caught by the schema's `preview`/`fingerprint` constraints
    before it reaches disk.

## 6. Edge cases

| Case | Behaviour |
|---|---|
| Same value, two families, same confidence | Higher family base score wins. |
| Value introduced before the analysed window (`maxCommits` truncation) | `introduced` is the earliest *analysed* commit; the reason list gains `history truncated at N commits`. |
| Value present in `HEAD` but never seen as added (e.g. added before truncation) | `inHead: true`, `introduced` = earliest analysed occurrence. |
| Empty repository | `findings: []`, valid report, `groups: 0`. |
| Ignore file missing | Empty map, no error (PLA-F-29.5). |
| Ignore file unparsable | Empty map + one progress diagnostic; analysis continues. |
| Duplicate ignore entries | Last one wins, a stale-entry note is emitted. |
| Fingerprint collision (theoretical) | Impossible in practice; if two different values share a fingerprint, they are merged and the reason list notes it. |
| Salt file missing | Generated with `randomBytes(32)`, written 0600, then reused. |
| Salt file unreadable | Typed error: analysis refuses to run with a weak salt. |
| Rule `scoreAdjust` pushing above 100 | Clamped, reason still recorded. |

## 7. Performance strategy

- Grouping is a `Map<fingerprint, Group>`: one pass, O(n) in detections.
- Lifetime reconstruction sorts each group's occurrences (typically < 10) rather
  than the whole detection list.
- Scoring is O(groups); the clamp is a `Math.min`/`Math.max` pair.
- Progress events are emitted per phase (scanning, grouping, scoring, report) and
  every 500 groups, not per finding, so a 10 000-finding report does not flood
  the terminal.
- Serialisation uses `stringifyReport` (stable sort) with `JSON.stringify`
  directly — no pretty-printing library, no deep clone.

## 8. Error handling

| Situation | Result |
|---|---|
| Invalid `AnchoredDetection` (offsets inconsistent) | Skipped, counted in `rawDetections` but not grouped; diagnostic progress event. |
| Salt missing/unreadable | Typed error `salt-unavailable`, no report written. |
| Report fails `reportSchema` | Typed error `report-invalid`; the offending field path is reported, never a value. |
| `appendIgnoreEntry` with an empty reason | Typed error, file untouched (PLA-F-29.2). |
| Disk full while writing the report | Typed error; the previous report is preserved (write to a temporary file, then rename). |

No error message ever interpolates a detection value; messages use the rule id
and the fingerprint only.

## 9. Open questions

- Should `danger` incorporate the number of locations (a key in 40 files is
  worse than in one)? Currently no: locations are shown, not scored, to keep
  PLA-P-07 provable with a short list of modifiers.
- Should stale exclusion entries be pruned automatically? Currently reported,
  never removed — a machine should not delete a human's rationale.
