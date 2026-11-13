# Placard — Skeletons in the Closet 🏚️🔑

> **Kiroween 2026 Hackathon submission — Category: Costume Contest**
> Scan Git history for forgotten secrets and personal data, triage them in a haunted manor, and remediate in the right order.

**"Deleting a secret from your code doesn't delete it from your history."**

Placard is an open-source, **local-first** security tool disguised as a gothic manor. Every room, corridor, door, and spiderweb maps to a concrete fact in your Git history — and the remediation ritual refuses to purge a secret before you have rotated it.

**Live demo:** <https://baptistefaisy.github.io/placard/>

---

## Why it exists

Karim wants to publish a three-year-old private repository. He runs a scanner: 214 lines of output. Which ones are serious? Which ones are still valid? Where does he start? He scrolls twenty lines, gives up, and publishes.

Three obstacles stop people, in order:

1. **Triage** — most findings are examples, test values, or noise. Without a hierarchy, people give up.
2. **Order** — the reflex is to rewrite history. It is the wrong first step: a leaked key must be **revoked first**, because copies of the repository already exist.
3. **Proof** — once the work is done, how do you show it is clean?

Placard answers all three: a **manor** that sorts visually, a **ritual** that enforces the right order, and a **certificate** that proves the result.

---

## The costume (Costume Contest)

Every frightening element carries data — no decorative filler:

| Manor element | Data it encodes |
|---|---|
| A **floor** | One year of history (attic = oldest, ground floor = current year) |
| The **corridor** | Time, in chronological order of that year's commits |
| A **door** | A commit that hides at least one finding |
| A wall panel "312 commits" | A run of commits with no finding, compressed |
| **Spiderwebs** on a door | How old the commit is |
| The **glow** under a door | Highest severity behind it (colour + intensity + pictogram) |
| The **skeleton's costume** | The family: key-bearer (key/token), paper-bearer (personal data), locked chest (risky file), loose bones (suspicious string) |
| The **skeleton's size** | Danger score, 0 to 100 |
| **Bony footprints** | The lifetime of one secret, across doors and floors |
| A skeleton **standing in the hall** | A secret still present in the current code |
| An **open window** in the corridor | The repository has a public remote — the exposure is real |
| A **wax seal** on a door | Finding remediated (rotated *and* purge verified) |
| A **ribbon** on a door | False positive, dismissed with a written reason |
| The **lantern** | The focus: follows pointer and keyboard, lights the selected finding |
| The **register** on the table | The table view — equal information, fully accessible |

No gore, no shock imagery. Sheets and the register always sit on a solid, high-contrast background; the decor stays behind.

---

## Highlights

- **Full history scan** — walks every reachable commit across all refs, reading **added and removed** lines, which is what gives the introduction and removal commit of each secret.
- **Nine detection families** — cloud keys, platform tokens, private keys, signed JWTs, plaintext passwords (entropy-gated), IBANs (mod-97), card numbers (Luhn), French NIR (mod-97 key), personal data, risky files, high-entropy strings.
- **Explainable danger score (0-100)** — base per family, `+15` still in HEAD, `+10` public remote, `−30` test/example path, `−20` known dummy value. **Every applied term is shown** in the finding sheet: the score explains itself.
- **Zero secrets leaked** — JSON reports, logs, stdout and error messages only ever contain an HMAC-SHA-256 fingerprint and a masked preview (`AKIA…(20)`).
- **The remediation ritual** —
  1. *Rotate* (provider cheat sheets: AWS, GitHub, Stripe, OpenAI, Slack, plus a generic fallback),
  2. *Purge* (`git filter-repo` script, **locked until rotation is acknowledged**; the replacements file is the only place a secret is written — outside the repo, mode `0600`),
  3. *Prevent* (`.gitignore` entries + a `placard scan --staged` pre-commit hook),
  4. *Verify* (re-scan, then a wax seal and a dated certificate).
- **Accessible register view** — a sortable, filterable table carrying exactly the same findings as the manor, keyboard-navigable, WCAG AA (axe-core clean).
- **Synthetic haunted repository** — `placard demo` builds a reproducible repo with fake secrets of every family, planted at varied dates and lifetimes. It is the demo *and* the test oracle.
- **Never executes the purge on your repository** — it writes a script and the commands to review, and warns about force-push consequences.

---

## Quick start

```bash
# 1. Try the hosted demo (no install, no account)
open https://baptistefaisy.github.io/placard/

# 2. Or run it locally on a synthetic repository
pnpm install
pnpm exec tsx packages/cli/src/main.ts demo

# 3. Scan a real Git repository
cd /path/to/my-repo
placard scan .

# 4. Open the manor UI on localhost
placard serve .placard/report.json

# 5. Pre-commit mode (non-zero exit when an unignored secret is staged)
placard scan --staged
```

### Command reference

| Command | Effect |
|---|---|
| `placard scan [repoDir]` | Scans the whole history, writes `.placard/report.json`, streams progress |
| `placard scan --staged` | Scans only staged changes; non-zero exit if an open finding is staged |
| `placard scan --json` | JSON on stdout, for scripting |
| `placard scan --fail-on-open` | Non-zero exit while open findings remain (used by the self-scan hook) |
| `placard serve [report.json]` | Serves the manor UI on `127.0.0.1` |
| `placard demo [--seed s]` | Generates the synthetic haunted repository and scans it |
| `placard ritual <action>` | `status` / `rotate` / `purge` / `prevent` / `verify` / `certificate` |
| `placard selftest` | Scans the current repository with Placard itself |

---

## Monorepo structure

```
placard/
├── .github/              # CI (≤ 5 min per job), budget + Kiro guards, Mergify, Hermes gate
├── .kiro/                # Kiro steering, specs, hooks, custom agent, skills (tracked in Git)
├── docs/                 # Architecture, CI & merge-queue documentation, agent brief
├── packages/
│   ├── core/             # Contracts, Zod schema, HMAC fingerprints, danger score, fake-value factory
│   ├── git-history/      # Streaming Git log walker, binary/oversized file accounting
│   ├── detectors/        # 9 rule families, keyword prefilter, Luhn / mod-97 / entropy validation
│   ├── analysis/         # Grouping by fingerprint, lifetime, score, exclusions, report
│   ├── demo-repo/        # Seeded synthetic haunted repository generator (test oracle)
│   ├── ritual/           # Rotation sheets, order lock, purge script, prevention, certificate
│   ├── manor-model/      # Shared presentation model: floors, doors, wall panels, footprints
│   ├── ui/               # React components: SVG manor, register, hall, filters, legend, ritual
│   ├── web/              # Vite app: hosted demo + local report drop (no upload, no network)
│   ├── cli/              # `placard` command line
│   └── integration/      # End-to-end property tests over the synthetic repository
└── scripts/recette-c17.sh # Automated acceptance recipe (C.17)
```

---

## Development

```bash
pnpm install
pnpm typecheck   # tsc, strict, noUncheckedIndexedAccess
pnpm lint        # ESLint: < 500 lines/file, < 50 lines/function (hard errors)
pnpm test        # 543 tests: Vitest + fast-check
pnpm build       # production build
bash scripts/recette-c17.sh   # full acceptance recipe
```

**Quality gates enforced in CI** (all jobs ≤ 5 minutes, self-hosted runners):

| Check | What it proves |
|---|---|
| `typecheck` | Strict TypeScript across all 10 packages |
| `lint` | No file over 500 lines, no function over 50 lines, no `any` |
| `test` | 543 tests: unit, property-based (fast-check) and end-to-end |
| `build` | The static demo site and the CLI bundle build |
| `ci-budget` | No job declares more than 5 minutes |
| `kiro` | `/.kiro` present and tracked, MIT licence, journal present |

---

## Publishing the shared packages

The four core packages — `@placard/core`, `@placard/detectors`,
`@placard/analysis`, `@placard/ritual` — are **publishable on npm** so that
sibling applications (placard-wiki, tickets-pieges, gammes…) consume **one
implementation**, never a copy (cahier des charges §21).

```bash
pnpm build:paquets        # tsc → dist, then the ESM extension rewrite
tools/publish.sh --dry-run # checks everything, publishes nothing
tools/publish.sh          # publishes the four core packages (npm account required)
```

The published packages are ESM (`import`) with their TypeScript declarations
embedded; `@placard/core` is an ordinary npm dependency of the other three.
Strategy, rationale and remaining manual steps (npm account, scope, token):
[`docs/PUBLICATION-NPM.md`](docs/PUBLICATION-NPM.md).

---

## Dependencies & licences

All runtime dependencies use permissive licences (MIT, Apache-2.0, BSD-3-Clause). **No GPLv3 or AGPL dependency is included** — HyperFormula (GPLv3) and TruffleHog (AGPL) were deliberately avoided.

| Package | Purpose | Licence |
|---|---|---|
| `react`, `react-dom` | UI components | MIT |
| `vite` | Web bundler | MIT |
| `vitest`, `fast-check` | Tests and property-based testing | MIT |
| `typescript` | Static typing | Apache-2.0 |
| `zod` | Report schema validation | MIT |
| `yaml` | `.placard/ignore.yml` parsing | ISC |

---

## Privacy & safety

- **Everything stays on your machine.** No telemetry, no network call during a scan or in the local UI (PLA-N-01).
- **Placard never uses a secret it finds.** It never validates a key against a provider's API (PLA-N-03: analysis is local only).
- **Placard never rewrites your repository.** It generates a script for you to read and run on a mirror clone.
- **Personal data is flagged, not judged.** The "rotate" step becomes "evaluate", and the tool only notes that a personal-data exposure may carry notification obligations — it does not give legal advice.

---

## Kiroween 2026 submission checklist

- [x] Public GitHub repository, created after 30 October 2026.
- [x] MIT licence at the root, detected in the repository "About" panel.
- [x] `/.kiro` tracked in Git and never ignored by `.gitignore` (enforced by the `kiro` CI job).
- [x] `KIRO_JOURNAL.md` documenting steering, hooks, custom agent, property tests and what did not work.
- [x] Public demo URL, no account, no install: <https://baptistefaisy.github.io/placard/>
- [x] Automated acceptance recipe: `scripts/recette-c17.sh`.
- [x] CI under 5 minutes per job, automatic merge queue (Mergify) and a Hermes conflict resolver.
