# Design — The Remediation Ritual (`@placard/ritual`)

> Kiro spec · workflow: **requirements first** (see `requirements.md`)
> Implements PLA-F-22 … PLA-F-29, PLA-P-09.

## 1. Architecture

```
                     Finding + RitualState
                              |
                     +--------v---------+
                     |   state machine  |  rotate → purge → prevent → verify
                     |   steps.ts       |  locks derived from state, never stored
                     +--------+---------+
                              |
      +-------------+---------+----------+-------------+
      |             |                    |             |
 +----v-----+  +----v------+      +------v-----+  +----v------+
 | rotation |  |   purge   |      | prevention |  |  verify   |
 | cards.ts |  | purge.ts  |      | prevent.ts |  | verify.ts |
 +----------+  +----+------+      +------------+  +----+------+
                    |                                  |
            script (.placard/scripts)           seal + certificate
            replacements (/tmp, 0600)           certificate.ts
                    |
              state.ts  (.placard/state/<fp>.json, JSON, atomic write)
```

Locks are **derived**, never persisted: `steps(finding, state)` computes them from
the recorded facts. A corrupted state file can therefore not unlock a step, and
PLA-P-09 becomes provable by construction.

## 2. Modules and responsibilities

| Module | Responsibility |
|---|---|
| `steps.ts` | Build the four `RitualStep`s and derive `locked` / `lockReason` / `done` / `doneAt`. |
| `rotation.ts` | The provider card table + generic fallback + personal-data notice. |
| `state.ts` | `loadState` / `saveState` — one JSON file per fingerprint under `.placard/state/`, atomic write (temp + rename), schema-validated. |
| `purge.ts` | `generatePurge` — script, replacements file, commands, warnings, security checks. |
| `script-template.ts` | The shell script body: confirmation flag, `HEAD` guard, mirror clone, `filter-repo`, verification, instructions. |
| `prevention.ts` | `.gitignore` lines, pre-commit hook content, hook path, reminders. |
| `verify.ts` | Re-scan comparison by fingerprint, `stillFound`, seal decision. |
| `certificate.ts` | `PLACARD.md` + badge SVG from counts and previews only. |
| `dismiss.ts` | Dismissal path delegating to `appendIgnoreEntry` from `@placard/analysis`. |
| `index.ts` | `RitualApi` implementation. |

## 3. Interface contract (copied from `packages/core/src/contracts/ritual.ts`)

```ts
export type RitualStepId = 'rotate' | 'purge' | 'prevent' | 'verify';

export interface RitualStep {
  id: RitualStepId;
  title: string;
  description: string;
  locked: boolean;
  lockReason?: string;
  done: boolean;
  doneAt?: string;
}

export interface RotationCard {
  provider: string;
  name: string;
  whereToRevoke: string;
  docUrl: string;
  checklist: string[];
  notApplicable: boolean;
  notice?: string;
}

export interface RitualState {
  fingerprint: string;
  findingId: string;
  rotate?: { doneAt: string; by: string } | { notApplicable: true; reason: string; date: string };
  purge?: { scriptPath: string; generatedAt: string };
  prevent?: { appliedAt: string; items: string[] };
  verify?: { verifiedAt: string; reportPath: string; stillFound: boolean };
  sealedAt?: string;
}

export interface PurgeArtifacts {
  scriptPath: string;
  replacementsPath: string;
  secure: boolean;
  commands: string[];
  warnings: string[];
}

export interface RitualOptions {
  repoDir: string;
  placardDir: string;
  tmpDir: string;
  toolVersion: string;
}

export interface RitualApi {
  steps(finding: Finding, state: RitualState | undefined): RitualStep[];
  rotationCard(rule: string, family: Finding['family']): RotationCard;
  markRotated(options: RitualOptions, finding: Finding, input: RotateInput): Promise<RitualState>;
  generatePurge(options: RitualOptions, findings: Finding[]): Promise<PurgeArtifacts>;
  prevention(options: RitualOptions): Promise<PreventionProposal>;
  verify(options: RitualOptions, finding: Finding, latestReportPath: string): Promise<RitualState>;
  certificate(options: RitualOptions, input: CertificateInput): Promise<CertificateResult>;
  loadState(placardDir: string, fingerprint: string): Promise<RitualState | undefined>;
  saveState(placardDir: string, state: RitualState): Promise<void>;
}

export type RotateInput =
  | { done: true; by: string }
  | { done: false; notApplicable: true; reason: string };

export interface PreventionProposal {
  gitignoreLines: string[];
  preCommitHook: string;
  hookPath: string;
  reminders: string[];
}

export interface CertificateInput {
  reportPath: string;
  treated: number;
  dismissed: number;
  open: number;
}

export interface CertificateResult {
  markdownPath: string;
  badgeSvgPath: string;
  markdown: string;
  badgeSvg: string;
}
```

## 4. The state machine

```
        (no state)
            |
            | markRotated({done:true, by})   or   markRotated({notApplicable, reason})
            v
      rotate ✓ ──────────────────────────────┐
            |                                │
            | generatePurge()                │
            v                                │
      purge ✓ (script generated)             │
            |                                │
            | prevention() + user applies    │
            v                                │
      prevent ✓                              │
            |                                │
            | verify(newReport)              │
            ├── fingerprint absent  ──> sealed ✓  (terminal)
            └── fingerprint present ──> stillFound, stays unsealed
```

Invariants:

- `purge` requires `rotate` (done or not applicable).
- `prevent` requires `purge`.
- `verify` requires `prevent`.
- `sealedAt` is terminal: nothing unsets it.
- Locks are recomputed from state on every `steps()` call, so the UI and the API
  can never disagree.

## 5. Generated purge script (shape)

```bash
#!/usr/bin/env bash
# Generated by placard <version> — REVIEW BEFORE RUNNING.
# This script rewrites history. It is NOT run by placard.
set -euo pipefail
EXPECTED_HEAD="<sha at generation time>"
[ "${1:-}" = "--yes-rewrite-history" ] || { echo "Refusing: pass --yes-rewrite-history"; exit 2; }
[ "$(git rev-parse HEAD)" = "$EXPECTED_HEAD" ] || { echo "HEAD moved; re-run placard ritual"; exit 3; }
# 1. Work on a mirror clone, never on the original.
# 2. filter-repo --replace-text <replacements file, outside the repo>
# 3. Inspect the result, then force-push every ref.
# 4. Ask every collaborator to re-clone.
```

The script references the replacements file by absolute path; it never contains a
value. The confirmation flag and the `HEAD` guard are what make PLA-F-24.4
verifiable.

## 6. Key decisions and rationale

1. **Locks derived, not stored.** Persisting `locked: true` would let a partial
   write, a manual edit, or a bug leave a step open. Deriving from facts means
   the only way to unlock purge is to record a rotation.
2. **The tool refuses to rewrite history.** This is the ethical core of the
   product: an automated `filter-repo` on a user's repository, run by a scanner
   that just found a secret, is a data-loss incident waiting to happen. We
   generate a reviewed script instead.
3. **Replacements file outside the repository, mode 0600.** `filter-repo
   --replace-text` needs the plaintext to search for; putting it in the working
   tree would recreate the exact problem we are fixing. `secure` is verified with
   `stat`, not assumed.
4. **`HEAD` guard in the script.** Rewriting the wrong history is worse than not
   rewriting: the guard forces a re-run of the ritual if the repository moved.
5. **Personal data is not rotatable.** An IBAN or a NIR cannot be revoked. Rather
   than pretending, the card says `notApplicable` with a cautious notice and the
   step still requires an explicit reason — which is what makes the trail
   auditable.
6. **Seal only after verification.** A wax seal that follows a click rather than
   a re-scan would be theatre. `verify` compares fingerprints against a fresh
   report.
7. **Dismissal reuses `appendIgnoreEntry`.** Two implementations of "exclude with
   a rationale" would drift; the ritual calls the analysis API.
8. **Certificate from counts and previews.** It is the artefact users paste into
   a security review, so it must be safe by construction — no snippets, no
   paths of occurrences beyond what the preview already says.
9. **One JSON file per fingerprint.** Concurrent rituals on different findings do
   not fight over a single file; a corrupt file affects one finding.

## 7. Edge cases

| Case | Behaviour |
|---|---|
| Finding already sealed | `steps()` returns four `done: true` steps; `markRotated` on a sealed finding is refused. |
| Rotation recorded, then purge never generated | `purge.done` false, `prevent` and `verify` locked. |
| Verification report contains the value in another path | `stillFound: true`, message points at the remaining location, no seal. |
| Verification report missing | `report-missing` typed error, state untouched. |
| `tmpDir` inside `repoDir` | `secure: false` and a warning; the CLI refuses to proceed unless `--allow-insecure-tmp`. |
| Replacements file already exists | Overwritten atomically, mode re-applied to 0600. |
| Script already exists | Regenerated, previous version kept as `.bak` for review. |
| Empty findings list passed to `generatePurge` | Typed error `no-findings`. |
| State file unreadable/corrupt | Treated as no state (all steps but rotate locked) plus a diagnostic; never a crash. |
| Two findings, same fingerprint (impossible by construction) | Deduplicated by fingerprint in the script. |
| `prevention` on a repository without `.gitignore` | Created, with a header comment explaining what was added. |

## 8. Performance strategy

The ritual is interactive, not batch: every operation is a handful of file reads
and one report parse. `verify` loads the new report once and builds a
`Set<fingerprint>` — O(findings) with no re-scan. The certificate is a string
template; the badge is a fixed SVG with two text nodes.

## 9. Error handling

Typed errors, one per refusal, with stable codes consumed by the CLI
(`rotation-required`, `report-missing`, `report-invalid`, `reason-required`,
`no-findings`, `insecure-tmp`, `state-corrupt`). Messages never contain a value;
they name the fingerprint, the rule and the step. Every write is atomic
(temp file + rename) so a crash leaves the previous state intact.

## 10. Open questions

- Should `prevent` be skippable with a reason, like `rotate`? Not yet: prevention
  is the only step that stops the next leak, and the sequence exists to make it
  the default.
- Do we offer a `--dry-run` diff of the `.gitignore` before applying? Deferred to
  the CLI lot.
