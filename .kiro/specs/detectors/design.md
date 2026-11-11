# Design — Detectors (`@placard/detectors`)

> Kiro spec · workflow: **requirements first** (see `requirements.md`)
> Implements PLA-F-02, PLA-F-03, PLA-F-04, PLA-F-11, PLA-P-02, PLA-P-04.

## 1. Architecture

```
 DetectorInput { line, path, commit, lineNumber, side }
                    |
            +-------v--------+
            |  normalisation |  strip control chars, normalise offsets
            +-------+--------+
                    |
            +-------v--------+
            | keyword filter |  which rules may run? (bitmask, per family)
            +-------+--------+
                    |
            +-------v--------+
            |  pattern match |  RegExp.exec loop, bounded patterns only
            +-------+--------+
                    |
            +-------v--------+
            |   validation   |  Luhn | mod-97 | NIR key | entropy | dummy
            +-------+--------+
                    |
            +-------v--------+
            | overlap resolve|  priority then confidence, then rule id
            +-------+--------+
                    |
               DetectorResult { detections, rulesTried }
```

`scanPath(path)` bypasses this pipeline entirely: it matches the path against the
`risky-file` rule set and returns at most one detection per matched pattern.

## 2. Modules and responsibilities

| Module | Responsibility |
|---|---|
| `engine.ts` | `createDetectorEngine(options)` — assembles rules, applies `disabledFamilies`, exposes `rules()`, `scanLine()`, `scanPath()`. |
| `prefilter.ts` | Lower-cased keyword index: `Map<keyword, ruleId[]>`; returns the candidate rules for a line in O(matches). |
| `families/cloud-key.ts` | Cloud provider access keys and API keys. |
| `families/platform-token.ts` | Code-host, CI, payment and chat platform tokens. |
| `families/private-key.ts` | PEM / OpenSSH / PGP private key blocks. |
| `families/signed-token.ts` | Three-segment signed tokens (JWT), decoded header check. |
| `families/plaintext-password.ts` | Assignment patterns (`password = …`, connection strings). |
| `families/bank-data.ts` | IBAN, card numbers. |
| `families/identity.ts` | French NIR, email addresses, phone numbers in context. |
| `families/risky-file.ts` | Path-only rules (`scanPath`). |
| `families/suspicious-string.ts` | High-entropy blobs, provider secret suffixes. |
| `validate/checksums.ts` | Thin re-export of `@placard/core` Luhn / mod-97 / NIR / entropy helpers — **no second implementation** (zero duplication rule). |
| `validate/dummy.ts` | Delegates to `isDummyValue` from `@placard/core`. |
| `validate/bounded.ts` | Static analyser for custom-rule patterns (PLA-F-11.2). |
| `custom.ts` | Loads and validates user rules (Zod schema in `@placard/core` style). |
| `rules.ts` | The built-in registry: an array of `DetectorRule`, one export per family. |
| `index.ts` | Public exports matching the contract. |

## 3. Interface contract (copied from `packages/core/src/contracts/detector.ts`)

```ts
export interface RawDetection {
  rule: string;
  family: FindingFamily;
  value: string;
  start: number;
  end: number;
  confidence: number;
}

export interface DetectorInput {
  line: string;
  path: string;
  commit: string;
  lineNumber: number;
  side: 'added' | 'removed';
}

export interface DetectorRule {
  id: string;
  family: FindingFamily;
  name: string;
  keywords: string[];
  pattern: RegExp;
  validate?: (value: string, input: DetectorInput) => boolean;
  scoreAdjust?: number;
  priority?: number;
  provider?: string;
}

export interface DetectorResult {
  detections: RawDetection[];
  rulesTried: number;
}

export interface DetectorEngine {
  rules(): readonly DetectorRule[];
  scanLine(input: DetectorInput): DetectorResult;
  scanPath(path: string): DetectorResult;
}

export interface DetectorEngineOptions {
  customRules?: DetectorRule[];
  disabledFamilies?: FindingFamily[];
  entropyThreshold?: number;
}
```

## 4. The nine families

| Family | Rules (ids) | Keywords (excerpt) | Validation | Base score |
|---|---|---|---|---|
| `cloud-key` | `aws-access-key`, `gcp-api-key`, `azure-storage-key` | `aws`, `akia`, `aiza`, `azure`, `account_key` | prefix shape + length + entropy | 85 |
| `platform-token` | `github-token`, `gitlab-token`, `slack-token`, `npm-token`, `stripe-key` | `ghp_`, `glpat`, `xoxb`, `npm_`, `sk_live` | prefix + length + entropy | 75 |
| `private-key` | `pem-private-key`, `openssh-private-key`, `pgp-private-key` | `BEGIN`, `PRIVATE KEY`, `OPENSSH` | block header + body length | 90 |
| `signed-token` | `jwt` | `eyj`, `jwt`, `bearer` | base64url header decodes to JSON with `alg` | 40 |
| `plaintext-password` | `password-assignment`, `connection-string-password` | `password`, `passwd`, `pwd`, `:pwd@` | entropy ≥ threshold, not dummy | 60 |
| `bank-data` | `iban`, `card-number` | `iban`, `fr76`, `card`, `cb` | mod-97 / Luhn | 70 |
| `identity` | `fr-nir`, `email-address` | `nir`, `secu`, `social`, `@` | NIR key / address shape | 30 |
| `risky-file` | `dotenv-file`, `private-key-file`, `kubeconfig`, `tfstate`, `db-dump`, `netrc` | (path only) | — | 50 |
| `suspicious-string` | `high-entropy-string`, `aws-secret-suffix` | `secret`, `key`, `token`, `sig` | entropy ≥ threshold + length ≥ 20 | 25 |

Patterns are described, not quoted, in this document: the repository must not
contain a literal at the real format of any secret (PLA-N-09). The rules build
their prefixes by concatenation at module load, and every test value comes from
the runtime fake-value factory.

## 5. Key decisions and rationale

1. **Keyword prefilter, not a mega-regex.** On a 100 k-commit repository the
   engine sees tens of millions of lines. A single combined regex would be tried
   on every one of them; the prefilter reduces the work to the rules whose
   keywords literally occur, which is what makes PLA-N-04's memory budget and
   the 5-minute CI budget achievable.
2. **Validate in the detector, not in the analyser.** A card number that fails
   Luhn must never reach the grouping stage: it would create a fingerprint, a
   skeleton, and a footprint for noise. Soundness belongs to the producer.
3. **Checksum code lives in `@placard/core`.** The demo generator *builds*
   valid values with the same functions the detector *checks* (PLA-P-04). Two
   implementations would drift and the property test would become meaningless.
4. **Overlap resolution by priority.** A private-key block contains a
   `suspicious-string`-looking body; the block must win. Priority is a numeric
   field rather than a hard-coded order so custom rules can participate.
5. **Path rules separated from content rules.** `scanPath` takes only a path:
   the signature makes it impossible to read a file in the detector, which keeps
   risky-file detection cheap on large histories and keeps PLA-F-04 honest.
6. **Custom rules are data, not code.** Patterns are `RegExp` from a validated
   source string; `validate` is a function supplied in-process by the caller
   (never deserialised from the repository). The repository-provided part is
   limited to id, family, keywords, pattern source, flags, priority, provider.
7. **Bounded-regex static check.** Rejecting `(a+)+$` at load time is far
   cheaper than discovering it in production. The checker walks the pattern
   source and refuses nested quantifiers over the same character class and
   unbounded `{n,}` above 4 096.
8. **No `g` flag reuse hazards.** Patterns are compiled without `g` and cloned
   per scan (`lastIndex` reset), so a shared rule object cannot leak state
   between lines — a real source of non-determinism in secret scanners.

## 6. Edge cases

| Case | Behaviour |
|---|---|
| Same value twice on one line | Two detections with disjoint ranges. |
| Value wrapped in quotes / backticks | Normalised; the reported range excludes the quotes. |
| Value split by `\` line continuation | Not detected; documented limitation. |
| Card number with spaces or dashes | Separators stripped for Luhn; range covers the raw span. |
| NIR with `2A`/`2B` | Normalised to 19/18 before the key computation. |
| JWT header that is not JSON | Not reported (validation fails). |
| PEM block truncated at end of file | Not reported; the block must be closed. |
| Line longer than 65 536 chars | Truncated by the scan engine; detection runs on the prefix. |
| Binary-ish control characters in the value | Stripped before validation; if the value becomes empty, no detection. |
| Custom rule with an invalid regex source | Rejected at load with a diagnostic, engine still usable. |
| `disabledFamilies` including `risky-file` | `scanPath` returns no detections. |

## 7. Performance strategy

- Keyword index built once per engine; `scanLine` is O(number of keywords
  present + matches), not O(number of rules).
- Patterns are anchored with a literal prefix wherever possible so V8's regex
  engine can use its fast pre-scan.
- No allocation in the hot path beyond the returned detections; `rulesTried` is
  a counter, not an array.
- The engine is stateless between lines, so it can be shared by the CLI's
  single-threaded pipeline without locking.

## 8. Error handling

`scanLine` and `scanPath` never throw (PLA-P-04.2): a throwing `validate`, an
unexpected `RegExp` error, or a non-string input are caught and turned into an
empty result with the rule counted as tried. Diagnostics (rejected custom rules)
are returned as data by the loader and printed by the CLI, never silently
dropped.

## 9. Open questions

- Should `email-address` be enabled by default? It produces volume on large
  repositories; the current answer is yes, with family-level disabling available.
- Do we add an `entropyThreshold` per family? Deferred until the property tests
  show it is needed.
