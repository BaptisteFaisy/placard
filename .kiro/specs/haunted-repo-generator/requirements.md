# Requirements — Haunted Repo Generator (`@placard/demo-repo`)

> Kiro spec · workflow: **Quick Spec** (condensed requirements, one design pass,
> tasks derived from the acceptance criteria)
> Requirements: PLA-F-13, PLA-N-09
> Package: `packages/demo-repo/` · Contract: `packages/core/src/contracts/demo.ts`

## 1. Context

Placard needs three things that all come from the same source: a **demo** that
runs with zero install, an **oracle** for the property tests (PLA-P-02,
PLA-P-03, PLA-P-06), and a **fixture** for the manor screenshots. Building three
artefacts would mean three drifts. The generator produces one: a synthetic Git
repository, seeded, containing fake secrets of all nine families, planted at
known commits for known lifetimes — and it hands back the list of what it
planted, which is the oracle.

The generator is also where the repository's hardest content rule is enforced:
it is the only place allowed to *create* secret-shaped strings, and it creates
them in memory, at runtime, from a seed — never in the source tree (PLA-N-09).

## 2. Goals

1. Deterministic: same seed + same `headDate` → same repository content and same
   commit SHAs.
2. Complete: at least one planted value per family, by default.
3. Varied: short-lived and long-lived secrets, present and removed, in source
   and in test directories, to exercise every branch of the manor.
4. Self-describing: `planted[]` is a truthful oracle, verified against the real
   repository by the generator's own tests.
5. Safe: no literal at the real format of a secret anywhere in the tool repo.

## 3. Non-goals

- Realistic software projects. The generated repository is a haunted house, not
  a sample app.
- Reproducing Git internals (author/committer dates are set through environment
  variables, nothing else is faked).
- Network remotes: `publicRemote` adds a *configured* URL, never a real one.
- Being a general-purpose repository fixture library.

## 4. Requirements (EARS)

### PLA-F-13 — Seeded synthetic repository

- **PLA-F-13.1** WHEN `generate(options)` is called THE SYSTEM SHALL create a Git
  repository at `targetDir` (`git init -b main`, all author/committer identity
  supplied through `GIT_AUTHOR_*` / `GIT_COMMITTER_*` environment variables) and
  SHALL return `{ repoDir, seed, commits, planted, head }`.
- **PLA-F-13.2** THE SYSTEM SHALL default to `seed: 'placard-demo'`,
  `commits: 120`, `years: 4`, `secrets: 12`, `headDate: now`.
- **PLA-F-13.3** WHEN `secrets` is below 9 THE SYSTEM SHALL still plant at least
  one value per family (nine), and SHALL document the effective count in
  `planted.length`.
- **PLA-F-13.4** FOR a given `(seed, headDate)` THE SYSTEM SHALL produce the same
  sequence of commits, the same file contents and the same commit SHAs, on the
  same machine and Git version.
- **PLA-F-13.5** THE SYSTEM SHALL plant each secret with a `PlantedSecret`
  record: `id`, `family`, `expectedRule`, `value`, `path`, `line`,
  `introducedCommit`, `removedCommit?`, `inHead`, `locations`, `testPath`,
  `date`.
- **PLA-F-13.6** THE SYSTEM SHALL spread planted secrets over the timeline so
  that, for the default options, at least three secrets are still in `HEAD`, at
  least three were removed, at least two live in a test/example path, and at
  least one has a lifetime longer than one year.
- **PLA-F-13.7** THE SYSTEM SHALL interleave filler commits that contain no
  planted value, so that wall stretches (commits without findings) exist in the
  manor.
- **PLA-F-13.8** WHERE `publicRemote: true` THE SYSTEM SHALL configure a remote
  URL of a public shape without performing any network access.
- **PLA-F-13.9** WHEN `fakeValue(family, seed, index)` is called THE SYSTEM SHALL
  return a value of that family that the detector engine recognises with the
  family's expected rule, deterministically for a given `(family, seed, index)`.
- **PLA-F-13.10** THE SYSTEM SHALL commit dates monotonically from
  `headDate - years` to `headDate`, and each commit's `GIT_AUTHOR_DATE` /
  `GIT_COMMITTER_DATE` SHALL equal the date recorded in the oracle.

*Acceptance criteria*

- [ ] Two `generate` calls with the same seed and `headDate` produce the same
      `head` SHA.
- [ ] `planted.length >= 9` and all nine families are represented.
- [ ] Every `planted[i].introducedCommit` exists in the repository and contains
      `planted[i].value` at `planted[i].path` (verified with `git show`).
- [ ] Every `planted[i].inHead === true` is confirmed by `git grep -F` on `HEAD`.
- [ ] `fakeValue(family, seed, 0)` called twice returns the same string.

### PLA-N-09 — No secret at the real format in the repository

- **PLA-N-09.1** THE SYSTEM SHALL fabricate every planted value at runtime from
  the seed; no value SHALL be written into any file of the tool's own repository.
- **PLA-N-09.2** THE SYSTEM SHALL NOT write a planted value into a log, a test
  snapshot, a fixture file or a Kiro spec; the oracle keeps values in memory and
  returns them to the caller only.
- **PLA-N-09.3** WHERE the generator writes a value into the synthetic
  repository, that repository SHALL live under a temporary directory
  (`fs.mkdtemp` or the caller's `targetDir`), never inside the tool's working
  tree.
- **PLA-N-09.4** THE SYSTEM SHALL NOT add a dependency: the PRNG is a local
  implementation seeded from SHA-256 of the seed.
- **PLA-N-09.5** WHEN the tool's own repository is scanned by Placard (the
  `self-scan` Kiro hook) THE SYSTEM SHALL produce zero findings; any finding is a
  release blocker.

*Acceptance criteria*

- [ ] `git grep -F` for any planted value inside the tool repository returns
      nothing after a full demo run.
- [ ] The `self-scan` hook is green on the branch that merges this package.
- [ ] No test file contains a secret-shaped literal (reviewed at merge time).

## 5. Traceability

| Requirement | Verified by |
|---|---|
| PLA-F-13 | `packages/demo-repo/src/generator.test.ts` |
| PLA-F-13.4 | `packages/demo-repo/src/determinism.test.ts` |
| PLA-F-13.5 … 13.7 | `packages/demo-repo/src/oracle.test.ts` |
| PLA-F-13.9 | `packages/demo-repo/src/fake-value.test.ts` |
| PLA-N-09 | `packages/demo-repo/src/no-secret.test.ts` + `self-scan` hook |
