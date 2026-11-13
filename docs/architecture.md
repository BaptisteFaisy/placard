# Placard — Architecture

> Companion document to the Kiro specs in `.kiro/specs/`. It describes how the
> packages fit together, what flows between them, and which invariants hold at
> every boundary.

## 1. What Placard does

Placard reads a Git repository's **entire reachable history**, finds secrets and
personal data, reconstructs how long each one lived, scores its danger, renders
the result as a haunted manor (and an equivalent accessible registry), and then
walks the user through remediation in a forced order: **rotate → purge →
prevent → verify**.

The premise is the product's tagline: *deleting a secret from your code does not
delete it from your history.*

## 2. Monorepo at a glance

pnpm workspace, TypeScript strict (`noUncheckedIndexedAccess`), Node 22,
Vitest + fast-check. One rule underpins the layout: **everything shared lives in
`@placard/core`**, so no logic exists twice.

```
placard/
├── packages/
│   ├── core/           contracts, types, Zod report schema, HMAC fingerprint,
│   │                   redaction, danger score, severity thresholds, i18n
│   ├── git-history/    streaming history reader  (contracts/git.ts)
│   ├── detectors/      nine families + validations (contracts/detector.ts)
│   ├── analysis/       grouping, lifetimes, score, exclusions (contracts/analysis.ts)
│   ├── demo-repo/      seeded synthetic repository + oracle (contracts/demo.ts)
│   ├── manor-model/    presentation model shared by both views (contracts/manor.ts)
│   ├── ritual/         rotation, purge, prevention, verification (contracts/ritual.ts)
│   ├── cli/            scan · serve · ritual · demo · selftest (contracts/cli.ts)
│   ├── ui/             React components: manor, registry, hall, ritual
│   └── web/            Vite app: hosted demo + drop a local report
├── .kiro/              steering, specs, hooks, custom agent, skill
├── .github/            CI (≤ 5 min/job), Mergify, Hermes gate
├── docs/               this document, CI-QUEUE.md, agent brief
└── KIRO_JOURNAL.md     how Kiro was used, question by question
```

### Package table

| Package | Depends on | Consumed by | Contract |
|---|---|---|---|
| `@placard/core` | — | everything | `contracts/*.ts`, `types.ts`, `schema.ts` |
| `@placard/git-history` | core | cli, analysis (via cli) | `contracts/git.ts` |
| `@placard/detectors` | core | cli, analysis (via cli) | `contracts/detector.ts` |
| `@placard/analysis` | core, git-history, detectors (types) | cli, ritual | `contracts/analysis.ts` |
| `@placard/demo-repo` | core | cli, tests of detectors/analysis | `contracts/demo.ts` |
| `@placard/manor-model` | core | ui, web, cli | `contracts/manor.ts` |
| `@placard/ritual` | core, analysis | cli, ui | `contracts/ritual.ts` |
| `@placard/cli` | all of the above | user | `contracts/cli.ts` |
| `@placard/ui` | core, manor-model | web | — |
| `@placard/web` | core, ui, manor-model | user (browser) | — |

`@placard/core` is frozen for feature work: it is the vocabulary. A change there
is an architecture change and requires updating the spec that owns the affected
contract.

## 3. Data flow

```
                 +-------------------+
   repository -->| @placard/git-history |  HistoryEvent stream
                 |  rev-list, diff -U0  |  repo · commit · line · skipped · progress · end
                 +---------+-----------+
                           |
                  DiffLineEvent { commit, path, line, text, side }
                           |
                 +---------v-----------+
                 | @placard/detectors   |  keyword prefilter → pattern → validation
                 |  nine families       |  RawDetection { rule, family, value, start, end }
                 +---------+-----------+
                           |
                 +---------v-----------+
                 | @placard/analysis    |  HMAC fingerprint → grouping → lifetime → score
                 |  ── the value dies  |  → exclusions → PlacardReport (JSON, value-free)
                 +---------+-----------+
                           |
        +------------------+-------------------+
        |                                      |
+-------v--------+                   +---------v----------+
| @placard/manor-model |             | @placard/ritual    |
|  ManorViewModel      |             |  steps, cards,     |
|  → manor (SVG)       |             |  purge script,     |
|  → registry (table)  |             |  verification,     |
+--------------------+---+           |  certificate       |
                     |               +---------+----------+
                 +---v----+                    |
                 | @placard/ui / web |<---------+  state overlay
                 +-----------------+
```

### Stage by stage

| Stage | Input | Output | Failure mode if skipped |
|---|---|---|---|
| Read | repository | event stream | a secret deleted long ago is never seen |
| Detect | lines | raw detections | the leak is invisible |
| Analyse | detections | report | 4 000 occurrences instead of 12 secrets; no lifetime |
| Render | report + filter | manor, registry | the user cannot triage |
| Ritual | report + state | actions, certificate | the key stays valid while the history looks clean |

## 4. Non-disclosure invariants

These are architectural, not stylistic. Each has an owner and a test.

| # | Invariant | Owner | Test |
|---|---|---|---|
| I1 | A raw value never leaves `@placard/analysis` | `analysis/identity.ts` | `analysis/src/redaction.test.ts` (PLA-P-01) |
| I2 | The report contains only id, family, rule, fingerprint, preview, danger, reasons, commits, locations (path + line + sanitised snippet), state | `core/schema.ts` | `report.test.ts` |
| I3 | Logs, stdout and error messages never interpolate a value | every package | `self-scan` + `redaction-guard` Kiro hooks |
| I4 | The tool repository contains no secret-shaped literal, even fake | `demo-repo` | `no-secret.test.ts`, `kiro` CI job |
| I5 | The replacements file lives outside the repository, mode 0600 | `ritual/purge.ts` | `purge.test.ts` (PLA-F-25.2) |
| I6 | The purge is never executed by the tool | `ritual/` | `no-exec.test.ts` (PLA-F-24) |
| I7 | Exclusions are keyed by fingerprint, never by value | `analysis/ignore.ts` | `ignore-write.test.ts` |

The fingerprint is `hmac256:<32 hex>` of the trimmed value with a **per-repository
salt** (`.placard/salt`, 0600, git-ignored). The salt prevents cross-repository
correlation; it does not make a weak value unguessable, which is why the preview
is also truncated (`AKIA…(20)` style) rather than partial-cleartext.

## 5. Report JSON schema

Validated by `reportSchema` (`packages/core/src/schema.ts`) on write and on read;
the web app rejects a dropped file with `safeParseReport`.

```jsonc
{
  "schema": "1.0.0",
  "tool": { "name": "placard", "version": "0.1.0" },
  "repo": {
    "name": "my-repo",
    "head": "<40 or 64 hex chars>",
    "totalCommits": 4213,
    "publicRemote": true,
    "analyzedAt": "2026-10-31T09:12:44.512Z"
  },
  "findings": [
    {
      "id": "sk_0001",                       // /^sk_\d{4,}$/
      "family": "cloud-key",                 // 9 values
      "rule": "aws-access-key",
      "fingerprint": "hmac256:3f9c…",        // /^hmac256:[0-9a-f]{16,64}$/
      "preview": "<prefix>…(20)",            // redacted
      "danger": 100,                          // integer 0..100
      "reasons": ["base cloud-key: +85", "still present in HEAD: +15",
                  "public remote repository: +10"],
      "inHead": true,
      "introduced": { "commit": "…", "shortCommit": "…", "date": "2024-02-11T…",
                      "author": "…", "message": "…" },
      "removed": [],
      "locations": [
        { "commit": "…", "path": "deploy/values.yaml", "line": 42,
          "snippet": "key: [REDACTED:cloud-key]" }
      ],
      "state": "open",                        // open|rotated|purged|sealed|ignored
      "ignoreReason": "…",                    // only when state = ignored
      "rotatedAt": "…"                        // optional
    }
  ],
  "skipped": { "binary": 12, "tooLarge": 3 }
}
```

Fields that are deliberately absent: the value, the full line, the diff hunk, the
author email (only the name is kept in the report's commit references, and the
commit metadata itself stays in Git).

## 6. Danger score

```
danger = clamp(
    family_base
  + (inHead        ? +15 : 0)
  + (publicRemote  ? +10 : 0)
  + (isTestPath    ? -30 : 0)
  + (isDummyValue  ? -20 : 0)
  + rule.scoreAdjust,
  0, 100)
```

| Family | Base | Severity at 85/65/40 |
|---|---|---|
| `private-key` | 90 | critical by default |
| `cloud-key` | 85 | critical by default |
| `platform-token` | 75 | high |
| `bank-data` | 70 | high |
| `plaintext-password` | 60 | medium |
| `risky-file` | 50 | medium |
| `signed-token` | 40 | medium |
| `identity` | 30 | low |
| `suspicious-string` | 25 | low |

Every modifier appends one sentence to `reasons`, so the score is explainable in
the UI and in the certificate. Monotonicity and clamping are property-tested
(PLA-P-07).

## 7. Requirement index

| Spec | Functional | Non-functional | Properties |
|---|---|---|---|
| `scan-engine` | PLA-F-01, PLA-F-10, PLA-F-12 | PLA-N-01, PLA-N-03, PLA-N-04 | PLA-P-05, PLA-P-10, PLA-P-12 |
| `detectors` | PLA-F-02, PLA-F-03, PLA-F-04, PLA-F-11 | — | PLA-P-02, PLA-P-04 |
| `lifetime-scoring` | PLA-F-05 … PLA-F-09, PLA-F-29 | — | PLA-P-01, PLA-P-03, PLA-P-06, PLA-P-07, PLA-P-08 |
| `haunted-repo-generator` | PLA-F-13 | PLA-N-09 | — |
| `manor-ui` | PLA-F-14 … PLA-F-21 | PLA-N-05 (colour never alone) | PLA-P-11 |
| `ritual` | PLA-F-22 … PLA-F-29 | PLA-N-02 (non-disclosure) | PLA-P-09 |

Non-functional requirements are stated once and referenced by the specs that
enforce them: PLA-N-01 (local-first, read-only), PLA-N-02 (non-disclosure),
PLA-N-03 (hostile content), PLA-N-04 (bounded memory), PLA-N-05 (accessibility:
information never carried by colour alone), PLA-N-09 (no secret in the
repository).

## 8. Extension points

- **Custom detector rules** (PLA-F-11): data-only rules, validated, bounded.
- **Exclusions** (`.placard/ignore.yml`): fingerprint + rationale, human-edited.
- **Provider rotation cards** (PLA-F-22): a table, easy to extend.
- **Report consumers**: anything that reads a `PlacardReport`; the manor is one
  consumer, the certificate another, a future SIEM export a third.

## 9. What is deliberately not here

No server, no telemetry, no network access, no account, no database. Placard
runs on the user's machine, reads their repository, writes a JSON file and a
static UI. The only durable state is `.placard/` (salt, report, exclusions,
ritual state, scripts).
