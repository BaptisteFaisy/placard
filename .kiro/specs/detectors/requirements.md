# Requirements — Detectors (`@placard/detectors`)

> Kiro spec · workflow: **requirements first**
> Requirements: PLA-F-02, PLA-F-03, PLA-F-04, PLA-F-11
> Properties: PLA-P-02, PLA-P-04
> Package: `packages/detectors/` · Contract: `packages/core/src/contracts/detector.ts`

## 1. Context

The scan engine hands over lines. The detector engine decides, line by line,
whether a line carries a secret or personal data, which family it belongs to,
which rule fired, and how confident the rule is. It is the only package that
ever holds a raw value in memory; every consumer downstream receives an
HMAC fingerprint and a redacted preview instead (PLA-N-02, PLA-P-01).

Two failure modes matter equally and pull in opposite directions:

- **False negatives** are a security hole: a key that is not detected is never
  rotated. The synthetic repo generator gives us an oracle to measure this
  (PLA-P-02).
- **False positives** destroy trust: a detector that reports every `password`
  string in a tutorial produces a manor nobody reads. Checksums and entropy
  thresholds exist for that (PLA-P-04).

## 2. Goals

1. Cover nine families of secrets and personal data with named, testable rules.
2. Validate before reporting: a value that fails its checksum is not a finding.
3. Keep the cost linear in the number of lines, on repositories of any size.
4. Accept user-defined rules without opening a hole (no `eval`, bounded regex).
5. Report files that are dangerous by their *name* alone, without reading them.

## 3. Non-goals

- Verifying that a credential is *live* (that would require network access —
  PLA-N-01 forbids it).
- Being an exhaustive secret scanner. The nine families are the product's scope;
  custom rules cover the rest.
- Grouping, scoring, or deduplicating across lines. That is `@placard/analysis`.
- Redacting. The engine returns raw values to the analyser, which is the only
  component allowed to fingerprint and redact them.

## 4. Glossary

| Term | Meaning |
|---|---|
| Rule | A `DetectorRule`: id, family, keywords, pattern, optional `validate`, base score adjustment, provider. |
| Keyword prefilter | A rule is only tried when one of its keywords occurs in the line. |
| Validation | A secondary check on the captured value: Luhn, mod 97, NIR key, entropy, dummy patterns. |
| Raw detection | `RawDetection`: rule, family, value, start, end, confidence — in memory only. |
| Risky file | A path whose mere name implies secrets (`.env`, private key, state dump). |
| Bounded regex | A pattern whose worst case is linear: no nested quantifier over the same character class. |

## 5. Requirements (EARS)

### PLA-F-02 — Nine detection families, keyword-gated

- **PLA-F-02.1** THE SYSTEM SHALL ship at least one rule for each of the nine
  families: `cloud-key`, `platform-token`, `private-key`, `signed-token`,
  `plaintext-password`, `bank-data`, `identity`, `risky-file`,
  `suspicious-string`.
- **PLA-F-02.2** WHEN a line is scanned THE SYSTEM SHALL try a rule only if one
  of that rule's keywords appears in the line (case-insensitive substring
  match), so the number of executed patterns per line is bounded by the number
  of rules whose keywords occur.
- **PLA-F-02.3** WHEN several rules match overlapping ranges of the same line
  THE SYSTEM SHALL keep the detection with the highest `priority` (then the
  highest `confidence`) and SHALL NOT report the overlapped duplicates.
- **PLA-F-02.4** WHEN a rule matches THE SYSTEM SHALL return a `RawDetection`
  with a stable `rule` id in kebab-case, the family, `start`/`end` offsets that
  satisfy `line.slice(start, end) === value`, and a `confidence` in `[0, 1]`.
- **PLA-F-02.5** WHEN `disabledFamilies` is provided THE SYSTEM SHALL omit every
  rule of those families from `rules()` and from `scanLine()`.
- **PLA-F-02.6** THE SYSTEM SHALL expose `rules()` in application order, and that
  order SHALL be stable across processes (deterministic id sort as tie-breaker).

*Acceptance criteria*

- [ ] `rules()` contains at least one rule per family; a test asserts the nine
      families are all covered.
- [ ] A line containing none of any rule's keywords results in `rulesTried === 0`.
- [ ] For every emitted detection, `line.slice(d.start, d.end) === d.value`.
- [ ] With `disabledFamilies: ['identity']`, `scanLine` never returns a
      detection whose family is `identity`.

### PLA-F-03 — Validation before reporting

- **PLA-F-03.1** WHEN a card-like candidate is found THE SYSTEM SHALL report it
  only if the digits pass the Luhn checksum and the compact length is in
  `[12, 19]`.
- **PLA-F-03.2** WHEN an IBAN-like candidate is found THE SYSTEM SHALL report it
  only if it satisfies ISO 7064 mod-97 (`remainder === 1`) after country-code
  conversion.
- **PLA-F-03.3** WHEN a French NIR candidate is found THE SYSTEM SHALL report it
  only if the two-digit key equals `97 - (body mod 97)`, with the Corsican
  `2A → 19` / `2B → 18` normalisation.
- **PLA-F-03.4** WHEN a password-like or high-entropy candidate is found THE
  SYSTEM SHALL report it only if its Shannon entropy is at least
  `entropyThreshold` (default 3.5 bits per character) and the value is not a
  known dummy placeholder (`changeme`, `example`, `your-key-here`, repeated
  characters, …).
- **PLA-F-03.5** WHEN a candidate has surrounding whitespace, quotes, trailing
  punctuation, or non-breaking control characters THE SYSTEM SHALL normalise it
  before validation (strip separators, strip wrapping quotes) and SHALL report
  the normalised range.
- **PLA-F-03.6** IF a validation function throws THEN THE SYSTEM SHALL treat the
  candidate as not detected and continue (never a crash).

*Acceptance criteria*

- [ ] A checksum-valid card number fabricated at runtime by the shared fake-value
      factory is reported; its invalid variant (same digits, key +1) is not.
- [ ] An IBAN whose mod-97 remainder is not 1 is never reported.
- [ ] A NIR with a wrong key is never reported; a valid one is.
- [ ] A tab- or quote-wrapped card number is reported after normalisation.

### PLA-F-04 — Risky files, by name only

- **PLA-F-04.1** WHEN `scanPath(path)` is called THE SYSTEM SHALL report a
  detection of family `risky-file` for each path pattern that matches, without
  reading the file content.
- **PLA-F-04.2** THE SYSTEM SHALL cover at least: dotenv files and their
  variants, private key containers and OpenSSH private keys, PKCS#12 bundles,
  `kubeconfig`, Terraform state and plan files, database dumps, `.npmrc` /
  `.pypirc` / `.netrc`, service-account JSON.
- **PLA-F-04.3** WHEN a risky path is matched THE SYSTEM SHALL return the path
  itself as the value, with `start: 0`, `end: path.length`, and confidence
  `0.9`.
- **PLA-F-04.4** WHERE a path matches both a risky-file pattern and a test
  directory segment THE SYSTEM SHALL still report it; the score penalty for test
  paths is applied by `@placard/analysis`, not by the detector.

*Acceptance criteria*

- [ ] `scanPath('config/.env.production')` reports exactly one `risky-file`.
- [ ] `scanPath('src/index.ts')` reports none.
- [ ] No file content is read: the function signature accepts only a path.

### PLA-F-11 — Custom rules

- **PLA-F-11.1** WHEN `customRules` is provided THE SYSTEM SHALL validate each
  rule against the schema (id kebab-case, known family, non-empty keywords,
  non-empty pattern, confidence in `[0, 1]`) and SHALL ignore invalid rules
  with a diagnostic count rather than throwing.
- **PLA-F-11.2** THE SYSTEM SHALL reject a custom rule whose pattern is
  unbounded (nested quantifiers over the same class, or a `{n,}` quantifier
  above 4 096) and SHALL report it as rejected.
- **PLA-F-11.3** THE SYSTEM SHALL NOT execute custom-rule code beyond its
  `RegExp` and its optional `validate` function; no `eval`, no `new Function`,
  no dynamic import of user files inside `scanLine`.
- **PLA-F-11.4** WHEN a custom rule and a built-in rule match the same range
  THE SYSTEM SHALL keep the higher `priority`, and a custom rule SHALL NOT be
  able to lower a built-in rule's priority.
- **PLA-F-11.5** WHERE a custom rule shares an id with a built-in rule THE
  SYSTEM SHALL reject the custom rule (ids are unique across the engine).

*Acceptance criteria*

- [ ] A valid custom rule is applied and appears in `rules()`.
- [ ] A rule with `pattern: /(a+)+$/` is rejected, and `scanLine` on a hostile
      line still returns within 50 ms.
- [ ] A rule with a duplicate id is rejected with a diagnostic.
- [ ] Zero new dependency is added to the package.

### PLA-P-02 — Completeness against the oracle (property)

- **PLA-P-02.1** FOR ALL seeds `s`, and for every value planted by
  `@placard/demo-repo` with `expectedRule = r`, `scanLine` SHALL return at least
  one detection whose `rule === r` and whose `value` equals the planted value.
- **PLA-P-02.2** FOR ALL seeds `s`, at least one value of each of the nine
  families SHALL be detected, so that no family is dead code.
- **PLA-P-02.3** FOR ALL generated lines that contain no planted value,
  `scanLine` SHALL return zero detections (no noise on the generator's filler
  content).

*Acceptance criteria*

- [ ] `fast-check` over 50 seeds: PLA-P-02.1 and PLA-P-02.2 hold for every seed.
- [ ] The generator's filler-only commits produce zero detections.

### PLA-P-04 — Soundness of validation (property)

- **PLA-P-04.1** FOR ALL checksum-bearing families (card, IBAN, NIR), for every
  value `v` produced by the fake-value factory and its
  `invalidChecksumVariant(v)`, `scanLine` SHALL report `v` and SHALL NOT report
  the variant.
- **PLA-P-04.2** FOR ALL arbitrary strings `x` (any Unicode), `scanLine` SHALL
  terminate in bounded time and SHALL NOT throw, whatever `x` contains.
- **PLA-P-04.3** FOR ALL arbitrary strings `x`, the returned detections SHALL
  satisfy the offset invariant `line.slice(start, end) === value` and SHALL be
  disjoint or resolved by priority.
- **PLA-P-04.4** FOR ALL `entropyThreshold` in `[0, 8]`, raising the threshold
  SHALL never increase the number of detections for a fixed line.

*Acceptance criteria*

- [ ] `fast-check` 1 000 runs per property, zero counter-example at merge time.
- [ ] No test file contains a literal at the real format of a secret: every
      value is built at runtime (PLA-N-09), enforced by the `self-scan` hook.

## 6. Traceability

| Requirement | Verified by |
|---|---|
| PLA-F-02 | `packages/detectors/src/rules.test.ts` |
| PLA-F-03 | `packages/detectors/src/validators.test.ts` |
| PLA-F-04 | `packages/detectors/src/risky-path.test.ts` |
| PLA-F-11 | `packages/detectors/src/custom-rules.test.ts` |
| PLA-P-02 | `packages/detectors/src/properties.test.ts` |
| PLA-P-04 | `packages/detectors/src/properties.test.ts` |
