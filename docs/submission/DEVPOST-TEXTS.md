# Devpost submission texts — Placard (Skeletons in the Closet)

Everything below is ready to paste into the submission form. All of it is in
English, as the rules require.

---

## Project name

**Placard — Skeletons in the Closet**

## Tagline (one line)

Deleting a secret from your code doesn't delete it from your history. Placard
finds what your repository is hiding, shows it as a haunted manor you can
actually triage, and makes you rotate the key before it lets you rewrite history.

## Category

Costume Contest

## Bonus entries

- Best Demo (the manor is the demo)
- Blog post — see `BLOG-POST.md`
- Social post — see `SOCIAL-POST.md`

## Description (the "what it does" field)

A secret committed three years ago and deleted the next day is still readable by
anyone who clones your repository. Existing scanners answer that with a list:
`gitleaks`, `trufflehog` and `detect-secrets` print 214 lines, and then the
triage, the ordering and the proof are all yours to invent. Most people scroll
twenty lines, give up, and publish.

**Placard** is a local-first scanner whose *interface is the costume*: a gothic
manor where every element encodes a fact about your Git history.

- **One floor per year** of history — the attic is your oldest year.
- **One door per commit** that hides something; runs of clean commits collapse
  into a labelled wall panel ("312 commits").
- **Spiderwebs** on a door tell you how old the commit is; the **glow underneath**
  tells you the worst severity behind it.
- **The skeleton's costume is the finding's family** — key-bearer, paper-bearer
  (personal data), locked chest (risky file), loose bones (unidentified string).
  **Its size is the danger score.**
- **Bony footprints** trace one secret's lifetime across doors and floors: the
  password that lived fourteen months.
- A skeleton **standing in the entrance hall** is a secret still in your current
  code. An **open window** means the remote is public. A **wax seal** means
  remediated; a **ribbon** means dismissed with a written reason.

Nothing in the manor is decorative. The full mapping ships as a Kiro steering
file (`.kiro/steering/costume-mapping.md`) and is re-checkable from the in-app
legend.

Then the part that actually saves you: **the ritual**. Rotation first, purge
second — and the purge step is *locked* until you confirm the key is revoked,
because rewriting history does not un-leak a key that has already been cloned.
Placard generates the `git filter-repo` script and its replacements file (written
outside the repository, mode `0600`, the only place a value is ever written), and
**never runs it against your repository**.

And because a scanner that leaks secrets while reporting them is worse than no
scanner: reports, logs, stdout and error messages contain **only** masked
previews (`AKIA…(20)`) and HMAC-SHA-256 fingerprints. The repository scans
itself in CI and fails if a single finding is open.

## Features list (short form, for the "built with" / features field)

- Full-history scan across all refs, reading **added and removed** lines — which
  is what yields introduction and removal commits directly
- 9 detection families: cloud keys, platform tokens, private keys, signed tokens
  (JWT), plaintext passwords, IBAN (mod 97), card numbers (Luhn), French NIR
  (mod 97 key), emails/phones, risky files, high-entropy strings
- Explainable danger score 0–100: base per family, `+15` still in HEAD, `+10`
  public remote, `−30` test/example path, `−20` known dummy value — every applied
  term is displayed
- Deterministic synthetic haunted-repository generator (`placard demo`) used both
  as the demo and as the oracle for property-based tests
- Accessible **Registry** view: a sortable, filterable table carrying exactly the
  same findings as the manor (a tested property, not a promise)
- Ritual with an enforced order, provider rotation sheets (AWS, GitHub, Stripe,
  OpenAI, Slack + generic), prevention proposals, verification and a dated
  certificate with a badge
- 100 % local: no telemetry, no network call during a scan or in the UI; a
  dropped report is parsed in the browser and never uploaded
- TypeScript strict monorepo, 11 packages, 543 tests (Vitest + fast-check),
  ESLint-enforced ceilings of 500 lines per file and 50 lines per function

## Links

- Repository: https://github.com/BaptisteFaisy/placard
- Live demo: https://baptistefaisy.github.io/placard/
- Judge instructions: `docs/submission/JUDGE-INSTRUCTIONS.md`
- Kiro usage narrative: `KIRO_JOURNAL.md`
