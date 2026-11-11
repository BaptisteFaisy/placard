# Requirements — Lifetime & Danger Scoring (`@placard/analysis`)

> Kiro spec · workflow: **requirements first**
> Requirements: PLA-F-05, PLA-F-06, PLA-F-07, PLA-F-08, PLA-F-09, PLA-F-29
> Properties: PLA-P-01, PLA-P-03, PLA-P-06, PLA-P-07, PLA-P-08
> Package: `packages/analysis/` · Contract: `packages/core/src/contracts/analysis.ts`

## 1. Context

The detectors produce thousands of raw detections for a real repository: the
same key copy-pasted into four files, re-added after a revert, removed in a
cleanup commit. Users cannot act on a list of occurrences; they can act on a
list of *secrets*, each with a birth date, a lifetime, a death date, and an
explainable danger score.

This package turns occurrences into findings. It is also the **boundary of
non-disclosure**: it is the last place where a raw value exists, and the first
place that produces something durable (the JSON report). Every requirement here
is therefore either about identity/lifetime/scoring correctness, or about the
absolute rule that no value survives the boundary.

## 2. Goals

1. One finding per distinct secret value, whatever the number of occurrences.
2. A truthful lifetime: earliest introduction, all removals, presence in `HEAD`.
3. A danger score between 0 and 100 that a human can read as a list of reasons.
4. A report that is schema-valid, deterministic, and provably value-free.
5. A way to dismiss a false positive *with a rationale*, permanently and
   verifiably.

## 3. Non-goals

- Detecting (that is `@placard/detectors`) or reading Git (that is
  `@placard/git-history`).
- Rendering. The manor model consumes the report; it never re-scores.
- Remediation. Rotation and purge are `@placard/ritual`.
- Cryptographic secrecy of the fingerprint: HMAC with a per-repository salt
  prevents cross-repository correlation, it does not make a weak value
  unguessable. This limitation is documented in `docs/architecture.md`.

## 4. Glossary

| Term | Meaning |
|---|---|
| Fingerprint | `hmac256:<32 hex>` of the trimmed value with the repository salt. Identity of a secret. |
| Group | All detections sharing one fingerprint — one `Finding`. |
| Lifetime | From the earliest introduction commit to the last removal commit, plus `inHead`. |
| Danger | Integer 0–100, sum of a family base and four signed modifiers. |
| Reason | Human-readable English sentence explaining one modifier of the score. |
| Exclusion | An entry in `.placard/ignore.yml` keyed by fingerprint, with a mandatory rationale. |

## 5. Requirements (EARS)

### PLA-F-05 — Grouping by fingerprint

- **PLA-F-05.1** THE SYSTEM SHALL compute one fingerprint per detection with
  `computeFingerprint(value, salt)` from `@placard/core`, using the per-repository
  salt, and SHALL group all detections sharing a fingerprint into a single
  `Finding`.
- **PLA-F-05.2** THE SYSTEM SHALL assign each finding a stable identifier
  `sk_NNNN` (zero-padded, at least four digits), ordered by danger descending,
  then by earliest introduction date, then by fingerprint, so that two analyses
  of an unchanged repository produce identical ids.
- **PLA-F-05.3** WHEN two detections of the same value belong to different
  families (for example a key detected as `cloud-key` and as
  `suspicious-string`) THE SYSTEM SHALL keep the family of the detection with
  the highest `confidence`, then the highest family base score.
- **PLA-F-05.4** WHEN two detections overlap in the same commit, path and line
  THE SYSTEM SHALL keep a single location, never a duplicate.

*Acceptance criteria*

- [ ] The same value planted in 3 files and 2 commits yields exactly one finding
      with 5 locations.
- [ ] Running the analysis twice on the same input yields the same ids in the
      same order.
- [ ] A value whose detections disagree on family resolves to the
      higher-confidence family.

### PLA-F-06 — Lifetime reconstruction

- **PLA-F-06.1** THE SYSTEM SHALL set `introduced` to the earliest commit, in
  commit date order, in which the value appears on the `added` side, with its
  full SHA, short SHA and ISO date.
- **PLA-F-06.2** THE SYSTEM SHALL list in `removed` every commit in which the
  value appears on the `removed` side *after* an introduction, in chronological
  order.
- **PLA-F-06.3** WHEN a value is introduced, removed, and re-introduced later
  THE SYSTEM SHALL keep a single finding whose lifetime spans the whole span,
  and SHALL record every removal commit (each life arc is tracked
  independently — the counter-example found in `KIRO_JOURNAL.md` §6).
- **PLA-F-06.4** THE SYSTEM SHALL set `inHead: true` if and only if the value is
  present in the analysed `HEAD` tree, as reported by the `headPresence` map.
- **PLA-F-06.5** WHEN a value is present in `HEAD` THE SYSTEM SHALL NOT list a
  `removed` commit later than the last `added` commit.
- **PLA-F-06.6** THE SYSTEM SHALL expose `locations` with commit, path and line
  for every occurrence, capped at 50 locations per finding (the count of
  occurrences beyond the cap is reported in the reasons as
  `+N more locations`).

*Acceptance criteria*

- [ ] A secret added in `c1`, removed in `c2`, re-added in `c3`, still present:
      `introduced = c1`, `removed = [c2]`, `inHead = true`.
- [ ] A secret introduced in two independent branches has one introduction
      (the earliest) and the removals of both arcs.
- [ ] `inHead` matches a direct `git grep` check on `HEAD` in the fixture.

### PLA-F-07 — Explainable danger score

- **PLA-F-07.1** THE SYSTEM SHALL compute `danger` with
  `computeDangerScore` from `@placard/core`, which sums the family base score
  (`private-key` 90, `cloud-key` 85, `platform-token` 75, `bank-data` 70,
  `plaintext-password` 60, `risky-file` 50, `signed-token` 40, `identity` 30,
  `suspicious-string` 25) and four modifiers: `+15` still present in `HEAD`,
  `+10` public remote, `−30` test/example path, `−20` known dummy value.
- **PLA-F-07.2** THE SYSTEM SHALL clamp the result to `[0, 100]` and store it as
  an integer.
- **PLA-F-07.3** THE SYSTEM SHALL fill `reasons` with one English sentence per
  applied modifier, in a fixed order (base, `HEAD`, remote, test path, dummy),
  each stating the signed value applied.
- **PLA-F-07.4** WHEN the rule carries a `scoreAdjust` THE SYSTEM SHALL apply it
  after the modifiers and SHALL add a corresponding reason.
- **PLA-F-07.5** THE SYSTEM SHALL NOT lower a finding's score below the family
  base minus 50, whatever the path: a test-directory key is still a key.

*Acceptance criteria*

- [ ] A private key in `HEAD` of a public repository scores
      `90 + 15 + 10 = 100` (clamped) with three reasons.
- [ ] A cloud key in `tests/fixtures/` of a private repository scores
      `85 − 30 = 55` with two reasons.
- [ ] `danger` is an integer in `[0, 100]` for every finding of the demo repo.

### PLA-F-08 — Value-free report

- **PLA-F-08.1** THE SYSTEM SHALL produce a `PlacardReport` valid against
  `reportSchema` (`@placard/core`), with `schema`, `tool`, `repo`, `findings`,
  `skipped`.
- **PLA-F-08.2** THE SYSTEM SHALL write, for each finding, only: id, family,
  rule, fingerprint, `preview` produced by `redactPreview`, danger, reasons,
  inHead, introduced, removed, locations, state, ignoreReason, rotatedAt.
- **PLA-F-08.3** WHEN a location carries a snippet THE SYSTEM SHALL pass it
  through `sanitizeSnippet(line, value, family)` so that the value is replaced
  by `[REDACTED:<family>]` before serialisation.
- **PLA-F-08.4** THE SYSTEM SHALL NOT write the value to disk, to stdout, to a
  log, or into a thrown error message.
- **PLA-F-08.5** THE SYSTEM SHALL serialise with `stringifyReport` (stable sort
  by id) so that two analyses of an unchanged repository produce byte-identical
  files apart from `repo.analyzedAt`.

*Acceptance criteria*

- [ ] `parseReport(JSON.parse(file))` succeeds on the produced file.
- [ ] A property test asserts that no produced string contains any planted
      value (PLA-P-01).
- [ ] Diffing two consecutive reports yields only the `analyzedAt` line.

### PLA-F-09 — False-positive exclusions

- **PLA-F-09.1** WHEN `.placard/ignore.yml` exists THE SYSTEM SHALL load it and
  key each entry by fingerprint.
- **PLA-F-09.2** WHEN a finding's fingerprint matches an exclusion THE SYSTEM
  SHALL set `state: 'ignored'`, copy the entry's `reason` into `ignoreReason`,
  and keep the finding in the report (it is not deleted).
- **PLA-F-09.3** WHEN an exclusion entry is malformed (missing `reason`,
  missing `author`, fingerprint not matching the expected format) THE SYSTEM
  SHALL ignore that entry, keep the others, and report the count of rejected
  entries in the progress stream.
- **PLA-F-09.4** WHEN an exclusion references a fingerprint absent from the
  analysis THE SYSTEM SHALL not fail; the entry is reported as stale so the user
  can prune it.
- **PLA-F-09.5** THE SYSTEM SHALL NOT treat an exclusion as a way to hide a
  finding from the count: ignored findings appear in `hall.dismissed` and are
  excluded from `hall.open`.

*Acceptance criteria*

- [ ] An ignored finding has `state === 'ignored'` and a non-empty
      `ignoreReason`.
- [ ] Removing the entry restores `state: 'open'` on the next run.
- [ ] A malformed entry does not abort the analysis.

### PLA-F-29 — Recording an exclusion

- **PLA-F-29.1** WHEN `appendIgnoreEntry(path, entry)` is called THE SYSTEM SHALL
  append a YAML entry with `fingerprint`, optional `rule`, mandatory `reason`,
  `author` and ISO `date`, creating the file and its directory if needed.
- **PLA-F-29.2** IF `reason` is empty or shorter than 3 characters THEN THE
  SYSTEM SHALL reject the write with a typed error and leave the file untouched.
- **PLA-F-29.3** WHEN the same fingerprint is appended twice THE SYSTEM SHALL
  replace the previous entry rather than duplicate it.
- **PLA-F-29.4** THE SYSTEM SHALL NOT write the value, the preview, or the path
  of the occurrence into the exclusion file: the fingerprint and the rationale
  are the only keys.
- **PLA-F-29.5** WHEN `loadIgnoreFile` is called on a missing path THE SYSTEM
  SHALL return an empty map, not an error.

*Acceptance criteria*

- [ ] Appending then loading returns an entry with the same fingerprint and
      reason.
- [ ] Appending an empty reason throws and leaves a byte-identical file.
- [ ] The exclusion file never contains a detected value (property test).

### PLA-P-01 — Non-disclosure (property)

- **PLA-P-01.1** FOR ALL repositories and all planted values `v`, the serialised
  report, the progress stream, the diagnostics and any error message SHALL NOT
  contain `v`.
- **PLA-P-01.2** FOR ALL findings, `preview` SHALL be shorter than the value and
  SHALL NOT contain the whole value.
- **PLA-P-01.3** FOR ALL snippets, every occurrence of the value SHALL be
  replaced by `[REDACTED:<family>]`.

*Acceptance criteria*

- [ ] `fast-check` over 200 generated reports: `report.includes(value) === false`.
- [ ] The `redaction-guard` hook (`packages/analysis/src/redaction.test.ts`)
      passes on every save.

### PLA-P-03 — Grouping invariance (property)

- **PLA-P-03.1** FOR ALL permutations of the detection list, the set of
  fingerprints and the number of findings SHALL be identical.
- **PLA-P-03.2** FOR ALL multisets of locations of the same value, the resulting
  finding SHALL have `min(locations.length, 50)` locations and the same
  `introduced` commit.
- **PLA-P-03.3** FOR ALL inputs, `rawDetections >= groups` and
  `sum(locations) == rawDetections` (before the 50-location cap).

*Acceptance criteria*

- [ ] `fast-check` with shuffled arrays: identical `findings.map(f => f.id)`.

### PLA-P-06 — Location preservation (property)

- **PLA-P-06.1** FOR ALL secrets planted by the demo generator, the finding
  matching that value SHALL have `locations.length === planted.locations`
  (when that count is ≤ 50).
- **PLA-P-06.2** FOR ALL planted secrets, `inHead === planted.inHead` and
  `introduced.commit === planted.introducedCommit`.
- **PLA-P-06.3** FOR ALL planted secrets, `removed` SHALL contain every
  `planted.removedCommit`.

*Acceptance criteria*

- [ ] `fast-check` over 30 seeds of the generator: no mismatch.

### PLA-P-07 — Score monotonicity (property)

- **PLA-P-07.1** FOR ALL findings, `0 <= danger <= 100`.
- **PLA-P-07.2** FOR ALL inputs, setting `inHead` from false to true SHALL not
  decrease `danger`.
- **PLA-P-07.3** FOR ALL inputs, setting `publicRemote` from false to true SHALL
  not decrease `danger`.
- **PLA-P-07.4** FOR ALL inputs, setting `isTestPath` or `isDummyValue` from
  false to true SHALL not increase `danger`.
- **PLA-P-07.5** FOR ALL inputs, `reasons.length` SHALL equal the number of
  modifiers actually applied.

*Acceptance criteria*

- [ ] `fast-check` 10 000 draws per property (the `clamp` counter-example of
      `KIRO_JOURNAL.md` §6 is covered by PLA-P-07.1).

### PLA-P-08 — Exclusion completeness (property)

- **PLA-P-08.1** FOR ALL ignore maps `M` and findings `F`, every finding whose
  fingerprint is in `M` SHALL have `state === 'ignored'` and a non-empty
  `ignoreReason`.
- **PLA-P-08.2** FOR ALL findings, `state !== 'ignored'` implies the fingerprint
  is not in `M`.
- **PLA-P-08.3** FOR ALL `M`, adding an entry SHALL not change the `danger` or
  the `locations` of any other finding.

*Acceptance criteria*

- [ ] `fast-check` over random maps and finding sets: invariants hold.

## 6. Traceability

| Requirement | Verified by |
|---|---|
| PLA-F-05 | `packages/analysis/src/grouping.test.ts` |
| PLA-F-06 | `packages/analysis/src/lifetime.test.ts` |
| PLA-F-07 | `packages/analysis/src/scoring.test.ts` |
| PLA-F-08 | `packages/analysis/src/report.test.ts` |
| PLA-F-09 | `packages/analysis/src/ignore.test.ts` |
| PLA-F-29 | `packages/analysis/src/ignore-write.test.ts` |
| PLA-P-01 | `packages/analysis/src/redaction.test.ts` |
| PLA-P-03, PLA-P-06 | `packages/analysis/src/properties.test.ts` |
| PLA-P-07, PLA-P-08 | `packages/analysis/src/properties.test.ts` |
