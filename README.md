# Placard — Skeletons in the Closet 🏚️🗝️

> **Kiroween 2026 Hackathon submission — Category: Costume Contest**
> Scan Git history for forgotten secrets and personal data, triage them in a haunted manor, and remediate in the right order.

**"Deleting a secret from your code doesn't delete it from your history."**

Placard is an open-source, local-first security tool disguised as a gothic manor. Every room, corridor, door, and spiderweb maps to a concrete fact in your Git history.

---

## Highlights

- **Full history scan** — walks every reachable commit across all refs, diffing additions and deletions to pinpoint introduction, lifetime, and removal commits.
- **9 detection families** — cloud keys, platform tokens, private keys, signed JWTs, plaintext passwords with entropy thresholds, IBANs (mod-97), credit cards (Luhn), French SSN (NIR mod-97), risky files.
- **The Haunted Manor (Costume Contest)**:
  - Each **floor** is a year of history (attic = oldest, ground floor = today).
  - Each **door** is a commit containing findings.
  - Wall stretches count commits with zero findings.
  - **Spiderwebs** denote commit age; glow under the door indicates max severity.
  - **Skeletons** wear costumes representing their family; their size scales with the danger score (0-100).
  - **Bony footprints** trace the lifetime of a secret across doors and floors.
  - Skeletons standing in the entrance hall are secrets **still present in HEAD**.
  - A wax seal means remediated; a ribbon means false positive with rationale.
- **Accessible Registry view** — accessible table with equal information, keyboard navigation, and AA contrast.
- **The Remediation Ritual** — forces the right order:
  1. *Rotate / Revoke* (with provider cheat sheets: AWS, GitHub, Stripe, OpenAI, Slack, generic).
  2. *Purge* (`git-filter-repo` script generated in a secured temporary file — locked until step 1 is acknowledged).
  3. *Prevent* (`.gitignore` updates + pre-commit hook).
  4. *Verify* (re-scan and wax seal).
- **Zero secrets leaked** — JSON reports, logs, stdout, and error messages only contain HMAC-SHA-256 fingerprints and redacted previews (`AKIA...(20)`).
- **Synthetic haunted repo generator** — `placard demo` seeds reproducible test repositories with synthetic secrets (no real secrets ever committed).

---

## Quick start

```bash
# Try the interactive demo (synthetic repository)
npx @placard/cli demo --open

# Scan an existing Git repository
cd /path/to/my-repo
npx @placard/cli scan .

# Open the haunted manor UI on localhost
npx @placard/cli serve .placard/report.json

# Pre-commit hook (fails if unignored secrets are staged)
npx @placard/cli scan --staged
```

---

## Monorepo structure

```
placard/
├── .github/              # CI (<= 5 min), budget check, Kiro check, Mergify, Hermes
├── .kiro/                # Kiro steering, specs, hooks, custom agents (tracked in Git)
├── packages/
│   ├── core/             # Types, schemas, HMAC, danger scoring, report format
│   ├── git-history/      # Streaming Git log walker, blame, commit metadata
│   ├── detectors/        # Regexes, Luhn, mod-97, entropy, context filters
│   ├── analysis/         # Grouping, lifetimes, false-positive exclusions
│   ├── demo-repo/        # Synthetic haunted repo generator (test oracle)
│   ├── ritual/           # Rotation sheets, purge script, verification
│   ├── cli/              # npx placard (scan, serve, demo, staged)
│   ├── ui/               # Manor SVG, Registry, Ritual React components
│   └── web/              # Standalone web app (hosted demo, drops report JSON)
├── KIRO_JOURNAL.md       # Chronological log of Kiro usage, hooks, and specs
└── LICENSE               # MIT License
```

---

## Dependencies & Licenses

All runtime dependencies use permissive licenses (MIT, Apache-2.0, BSD-3-Clause). No GPLv3 / AGPL dependencies are included.

| Package | Purpose | License |
|---|---|---|
| `react` / `react-dom` | UI components | MIT |
| `vite` | Web bundler | MIT |
| `vitest` / `fast-check` | Tests & property-based tests | MIT / MIT |
| `typescript` | Static typing | Apache-2.0 |

---

## Kiroween 2026 submission checklist

- [x] Public GitHub repo created after Oct 30, 2026.
- [x] MIT License detected in repository root.
- [x] `/.kiro` tracked in Git, never ignored by `.gitignore`.
- [x] Hosted demo URL runnable with zero install.
- [x] `KIRO_JOURNAL.md` documenting steering, hooks, custom agents, property tests.
- [x] CI pipeline running in <= 5 minutes per job with Mergify Merge Queue.
