# Placard — CI, merge queue and protection

> How this repository guarantees three things at once: **zero regression**,
> **automated merge**, and **a 5-minute ceiling per job**.
> Files: `.github/workflows/*.yml`, `.github/ci-budget/check_timeouts.py`,
> `.github/kiro/check_kiro.py`, `.github/hermes/gate.py`, `.mergify.yml`,
> `.github/actions/setup/action.yml`.

## 1. The pipeline in one picture

```
   push / pull_request
          |
          +--> typecheck ──┐
          +--> lint ───────┤
          +--> test ───────┤   ci.yml          (4 jobs, parallel, 5 min each)
          +--> build ──────┘
          +--> ci-budget ──┐
          +--> kiro ───────┤   dedicated workflows (guard jobs)
          +--> stale-base-guard ──┘
          +--> hermes-lite/gate ──> label hermes/conflit + agent ZeroClaw hermes (InferHub)
                                          (on real git conflict only)
          |
          v
   Mergify pull_request_rules: all gate checks green, not draft, not
   conflicting, no `hold` label, base = main
          |
          v
   Merge queue `default`: re-runs the full check set on the batch,
   squashes onto the latest main, merges
```

Nothing merges on a red check, and nothing merges by hand: `main` is protected
and Mergify is the only writer.

## 2. Jobs

| Workflow | Job (`name:`) | Trigger | Timeout | What it proves |
|---|---|---|---|---|
| `ci.yml` | `typecheck` | PR, push to `main`, manual | 5 min | TypeScript strict compiles across the monorepo |
| `ci.yml` | `lint` | same | 5 min | ESLint: `max-lines` 500, `max-lines-per-function` 50, no `any` |
| `ci.yml` | `test` | same | 5 min | Vitest + fast-check, coverage artefact kept 3 days |
| `ci.yml` | `build` | same | 5 min | Every package builds (Vite for `web`) |
| `ci-budget.yml` | `ci-budget` | same | 5 min | Every job of every workflow declares `timeout-minutes <= 5` |
| `kiro-guard.yml` | `kiro` | same | 5 min | `/.kiro` tracked and not git-ignored, MIT `LICENSE`, non-empty `KIRO_JOURNAL.md` |
| `stale-base-guard.yml` | `stale-base-guard` | PR opened/synchronize/reopened, manual | 5 min | Measures `behind_by` and warns; never blocks (`exit 0`) |
| `hermes-lite.yml` | `gate` | PR events, `check_run`, manual | 5 min | Labels and escalates a real merge conflict |
| `hermes-lite-alert.yml` | `alert` | manual | 5 min | Lists PRs labelled `hermes/conflit` |

All jobs run on the **self-hosted runners `placard-worker`** (labels
`[self-hosted, placard-worker]`), hosted on the R630 machine, migrated from
decommissioned repositories. Consequence: the toolchain (Node LTS + pinned
pnpm) is already on the runner, so CI never downloads a Node distribution.

### The 5-minute budget

Three mechanisms enforce it, in order of authority:

1. **`timeout-minutes: 5` on every job.** Not a guideline: a job that declares
   more is rejected.
2. **`check_timeouts.py`** parses every workflow file and fails `ci-budget` if a
   job has no `timeout-minutes` or declares more than 5. Adding a workflow
   without the field breaks the build, which is the intended friction.
3. **`concurrency` with `cancel-in-progress: true`** per workflow and per PR:
   a new push cancels the previous run instead of queueing behind it.

Supporting decisions that keep jobs *inside* the budget rather than merely
killing them at 5 minutes:

- `actions/checkout@v4` with **`fetch-depth: 1`** — no history download.
- A composite action **`.github/actions/setup`** that asserts `node`, `pnpm`,
  `git` and `python3` exist and then runs `pnpm install --frozen-lockfile`.
  One implementation shared by all jobs (zero duplication, as everywhere else).
- **No native build, no E2E, no browser test in PR jobs.** They belong to a
  separate pipeline, not to the merge path.
- `max_checks_retries: 1` in the queue: one retry for a flaky runner, never an
  open-ended loop.

If a job legitimately needs longer, the answer is to split it or move it out of
the PR path — **never** to raise the timeout.

## 3. Mergify — the merge queue

`.mergify.yml` defines one queue, `default`:

| Setting | Value | Why |
|---|---|---|
| `queue_conditions` | `ci-budget`, `kiro`, `typecheck`, `lint`, `test`, `build`, `stale-base-guard` all successful; `-conflict`, `-draft`, `base = main` | The queue only accepts a PR that has already proven itself |
| `batch_size` | `min: 1`, `max: 3` | Merges 1–3 PRs together after testing the *batch*, amortising CI cost |
| `batch_max_wait_time` | `30 seconds` | Bounds the wait for a batch partner; keeps feedback fast |
| `max_checks_retries` | `1` | One retry on a flaky check, then out |
| `merge_method` | `squash` | One commit per PR on `main`; history stays readable |
| `update_method` | `merge` | The queue updates the PR branch by merging `main` into it (never rebase, never force-push a contributor's branch) |
| `commit_message_format` | title `pr-title`, body `pr-body` | The squash commit keeps the PR title and body — the PR body *is* the commit message |
| `merge_queue.max_parallel_checks` | `4` | Four queue entries tested concurrently; matches the runner capacity |

`priority_rules`: `label = urgent` → `high`, `label = priority-low` → `low`, so a
security fix overtakes a documentation PR without anyone editing the queue.

`pull_request_rules` queues a PR automatically as soon as `ci-budget`, `kiro` and
`stale-base-guard` are green and the PR is not closed, not a draft, not
conflicting, has no `hold` label and targets `main`. The four build checks are
re-verified *inside* the queue against the latest `main`, which is the real
guarantee: a PR is tested against what `main` will be, not against what it was
when the PR was opened.

`merge_protections_settings.auto_merge_conditions: true` keeps the queue's own
conditions in sync with the protection rules instead of duplicating them in two
places that drift.

## 4. Protection of `main`

- Direct pushes are **disabled**; `enforce_admins` is on, so nobody — including
  the maintainer — can bypass the queue.
- **Required status checks**: `ci-budget`, `kiro`, `typecheck`, `lint`, `test`,
  `build`, `stale-base-guard` — the same seven names the queue lists.
- Linear history required, squash merges only, force-push and deletion of `main`
  forbidden.
- **`strict: false`.** The "require branches to be up to date before merging"
  toggle is deliberately *off*, and this is not a relaxation:
  - With `strict: true`, every merge invalidates every other open PR, which then
    must be updated and re-tested — a livelock as soon as more than one PR is in
    flight.
  - With `strict: true`, Mergify's batch merge (2–3 PRs tested together) is
    impossible: each PR in the batch would have to be up to date with a `main`
    that does not exist yet.
  - Freshness is guaranteed **by the queue instead**: the queue merges the batch
    onto the current `main` and re-runs all checks there. A stale branch cannot
    reach `main`; it can only wait.
- `stale-base-guard` is informational by design (`exit 0`, `::warning::`): it
  measures `behind_by` so a human sees the drift, while `update_method: merge`
  in the queue does the actual refresh.

## 5. The Hermes gate and the InferHub conflict agent

`.github/hermes/gate.py` runs in the `gate` job of `hermes-lite.yml` (PR events,
completed check runs, a 10-minute safety sweep, and manual dispatch).

1. It lists open PRs. **The list endpoint does not carry `mergeable`**, so the
   gate re-reads the single PR (`GET /repos/{o}/{r}/pulls/{n}`, up to 3 attempts
   3 s apart — GitHub computes mergeability on demand). Without that re-read a
   real conflict is invisible: measured on 2026-11-11, a `CONFLICTING` PR was
   reported as merely "1 commit behind".
2. When a PR is `CONFLICTING` (a **real** git conflict, not a stale branch):
   - the `hermes-lite/verdict` check goes red,
   - the label **`hermes/conflit`** is added,
   - `.github/hermes/conflict_agent.py --spawn` is launched **detached**.
3. When a labelled PR becomes `MERGEABLE` again, the label is removed — the gate
   is self-healing.
4. Without `GH_TOKEN` / `GITHUB_REPOSITORY` it degrades to a passive no-op and
   exits 0: a gate must never fail the build because it cannot reach the API.

### The agent that actually resolves the conflict

`conflict_agent.py` does not resolve anything itself. It writes a complete brief
(PR, base, head SHAs, touched files, recent commits, method, guard rails) and
posts it over A2A JSON-RPC (`SendMessage`) to the **ZeroClaw daemon running on
the runner machine** — `http://127.0.0.1:42617/a2a/hermes`, agent `hermes`,
provider **`custom.inferhub`** (InferHub, `https://api.inferhub.dev/v1`).

The agent then clones the PR branch under `/tmp/hermes-pr-<n>`, merges
`origin/<base>`, keeps **both** intentions (never picks a side blindly), re-runs
the guard rails (`pnpm typecheck`, `pnpm lint`, `ci-budget`, `kiro`), pushes
**only the PR branch**, and the script publishes its report as a PR comment.

Guards around the seizure:

| Guard | Value | Why |
|---|---|---|
| Anti-loop stamp | per (PR, head SHA) | one seizure per commit |
| Cooldown | 20 min | two chats on the same PR = loop |
| Max spawns per run | 3 | a burst of conflicting PRs must not flood the agent |
| Fork PRs | skipped | no write access |
| `hermes/intervention-humaine` or `hold` | skipped | human hand-back |
| `HERMES_AGENT_RESOLVE=0` | disables everything | kill switch |
| Failure | never fails the job | an unavailable agent must not redden the queue |

The detached process is started with `systemd-run --user --scope`: a runner
installed as a systemd service kills its whole job cgroup when the job ends, and
`start_new_session=True` does **not** escape it. Measured on 2026-11-11 — the
stamp and the first log line were written, then the process was gone, so the
agent was never reached.

### Measured drill (2026-11-11)

| Step | Evidence |
|---|---|
| Two branches add the same file with incompatible content | PR #20 (A) and PR #21 (B) |
| Mergify merges A | #20 merged 14:29:26Z by `app/mergify` |
| B becomes a real conflict | `mergeable: CONFLICTING`, `mergeStateStatus: DIRTY` |
| Gate detects it and seizes the agent | label `hermes/conflit`, `pr-21.log`: `chat hermes -> http://127.0.0.1:42617 (3024 caractères)` |
| Agent resolves and pushes | merge commit `cdff71f`, both intentions kept |
| Agent's report published on the PR | comment `hermes/agent-conflit`, 1463 characters |
| Mergify merges B | `b69a8e4` at 14:56:42Z — "less than a minute in the queue" |

Mergify stays the **only** merge pilot: `HERMES_LITE_DRY_RUN=1` is set on the
repository, so the gate labels, escalates and reports, but never merges.

## 6. Getting a PR out of the queue

Two brakes, one for each situation:

1. **Before queueing — the `hold` label.**
   `pull_request_rules` excludes `label = hold`, so a PR wearing it is never
   queued. This is the standard way to park a PR: a human is reviewing, a
   dependency is not ready, or the change must wait for a release window. Remove
   the label and the PR queues itself on the next event, with no other action.
2. **Already queued — dequeue explicitly.**
   Comment `@mergifyio dequeue` on the PR (or convert it to draft / close it).
   Adding `hold` at that point stops *re-entry* but does not remove a PR that is
   already in the queue.

Known improvement (not applied here, `.mergify.yml` is out of scope for this
document): adding `-label = hold` to `queue_conditions` would make `hold`
self-dequeuing. Until then, use the two-step procedure above.

`hermes/conflit` behaves the same way: it is a signal, not a brake — a
conflicting PR cannot be queued anyway (`-conflict`).

## 7. Failure playbook

| Symptom | Meaning | Action |
|---|---|---|
| `ci-budget` red | A job has no `timeout-minutes` or declares > 5 | Fix the workflow; never raise the timeout |
| `kiro` red | `.kiro` untracked/ignored, `LICENSE` not MIT, journal too short | Fix the offending file; the check prints the line number |
| `stale-base-guard` yellow warning | PR behind `main` by N commits | Nothing to do: the queue merges `main` into the PR |
| `hermes/conflit` label | Real git conflict with `main` | The InferHub agent is already seized; add `hermes/intervention-humaine` to take over |
| PR green but never merges | `hold` label, draft, or a queue condition unmet | Remove `hold`, mark ready, check the seven required checks |
| Job killed at 5:00 | The budget did its job | Split the job or move it out of the PR path |
| Flaky check | One retry is allowed (`max_checks_retries: 1`) | If it fails twice, it is a real failure |

## 8. Why this shape

- **One check, one workflow.** `typecheck`, `lint`, `test` and `build` are four
  independent jobs, so a lint error does not hide a test failure, and each has its
  own 5-minute clock.
- **Guard jobs are separate and cheap.** `ci-budget` and `kiro` are Python
  scripts with no install step: seconds, not minutes, and they cannot be broken
  by a TypeScript change.
- **The queue is the only merge path.** No bot, no human, no `gh pr merge` in a
  script. Everything that reaches `main` has passed the same seven checks
  against the same `main`.
- **Squash + PR body as commit body.** The PR body carries `## Scope` and
  `## Vérifications` (see `docs/AGENT-BRIEF.md`), so the resulting commit on
  `main` documents itself.
