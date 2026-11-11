# Tasks — Detectors (`@placard/detectors`)

> Kiro spec · workflow: **requirements first**
> Legend: `[x]` done · `[ ]` to do. Every task names its file and its check.

## Phase 0 — Scaffolding

- [x] **T0.1** Package skeleton (`package.json`, `tsconfig.json`,
  `src/index.ts` placeholder), no new dependency.
  *Verify:* `pnpm --filter @placard/detectors typecheck`.
- [ ] **T0.2** `src/testkit.ts`: `lineOf(...)` helper building a `DetectorInput`
  from a value produced at runtime by the `@placard/core` fake-value factory.
  *Verify:* no test file contains a secret-shaped literal (`self-scan` hook
  stays green).

## Phase 1 — Engine core

- [ ] **T1.1** `src/prefilter.ts`: keyword index (lower-cased) returning the
  candidate rules for a line.
  *Verify:* `src/prefilter.test.ts` — a line without keywords gives
  `rulesTried === 0` (PLA-F-02.2).
- [ ] **T1.2** `src/engine.ts`: `createDetectorEngine` with `rules()`,
  `scanLine()`, `scanPath()`, `disabledFamilies`, deterministic rule order.
  *Verify:* `src/engine.test.ts` — nine families covered, order stable across two
  engine instances (PLA-F-02.1, PLA-F-02.5, PLA-F-02.6).
- [ ] **T1.3** `src/resolve.ts`: overlap resolution by priority, then
  confidence, then rule id.
  *Verify:* `src/resolve.test.ts` — a private-key block overlapping a
  high-entropy body yields exactly one detection, the key one (PLA-F-02.3).
- [ ] **T1.4** Offset invariant: every detection satisfies
  `line.slice(start, end) === value`, asserted in a shared helper used by all
  rule tests (PLA-F-02.4).

## Phase 2 — Built-in families

- [ ] **T2.1** `families/cloud-key.ts` — three cloud providers, prefix built by
  concatenation at load, length and entropy checks.
  *Verify:* `cloud-key.test.ts` with runtime-fabricated values.
- [ ] **T2.2** `families/platform-token.ts` — code-host, CI, chat, registry,
  payment tokens.
  *Verify:* `platform-token.test.ts`.
- [ ] **T2.3** `families/private-key.ts` — PEM, OpenSSH, PGP blocks; block must
  be closed.
  *Verify:* `private-key.test.ts` including a truncated block (no detection).
- [ ] **T2.4** `families/signed-token.ts` — three-segment token, base64url header
  must decode to JSON containing `alg`.
  *Verify:* `signed-token.test.ts` — a two-segment look-alike is not reported.
- [ ] **T2.5** `families/plaintext-password.ts` — assignment and connection-string
  patterns with entropy and dummy-value rejection.
  *Verify:* `password.test.ts` — `changeme`, `example`, `your-key-here` are not
  reported (PLA-F-03.4).
- [ ] **T2.6** `families/bank-data.ts` — IBAN (mod 97) and card (Luhn, length
  12–19).
  *Verify:* `bank-data.test.ts` — valid/invalid pairs from
  `invalidChecksumVariant` (PLA-F-03.1, PLA-F-03.2, PLA-P-04.1).
- [ ] **T2.7** `families/identity.ts` — French NIR with Corsican normalisation,
  email addresses.
  *Verify:* `identity.test.ts` — wrong key never reported, `2A`/`2B` accepted
  (PLA-F-03.3).
- [ ] **T2.8** `families/suspicious-string.ts` — high-entropy blobs and provider
  secret suffixes.
  *Verify:* `suspicious.test.ts` — monotonicity in `entropyThreshold`
  (PLA-P-04.4).
- [ ] **T2.9** `families/risky-file.ts` — dotenv variants, key containers,
  PKCS#12, kubeconfig, Terraform state/plan, dumps, `.npmrc`/`.pypirc`/`.netrc`,
  service-account JSON; path-only.
  *Verify:* `risky-path.test.ts` — `config/.env.production` reports exactly one
  detection, `src/index.ts` reports none (PLA-F-04.1 … PLA-F-04.4).

## Phase 3 — Validation helpers

- [ ] **T3.1** `validate/checksums.ts` re-exporting `@placard/core` helpers —
  no local copy of Luhn / mod 97 / NIR / entropy (zero-duplication rule).
  *Verify:* `grep -c "function luhn" packages/detectors/src` returns 0.
- [ ] **T3.2** `validate/dummy.ts` delegating to `isDummyValue` from core.
  *Verify:* `dummy.test.ts` over the documented placeholder list.
- [ ] **T3.3** Normalisation of surrounding quotes, whitespace, separators and
  control characters, with range adjustment.
  *Verify:* `normalise.test.ts` — tab- and quote-wrapped values are detected and
  the reported range excludes the wrapping (PLA-F-03.5).
- [ ] **T3.4** Guard: a throwing `validate` never propagates.
  *Verify:* `guard.test.ts` — injected thrower yields an empty result
  (PLA-F-03.6).

## Phase 4 — Custom rules

- [ ] **T4.1** `src/custom.ts`: schema validation (kebab-case id, known family,
  non-empty keywords, confidence in `[0, 1]`), duplicate-id rejection, invalid
  rules skipped with a diagnostic count.
  *Verify:* `custom-rules.test.ts` (PLA-F-11.1, PLA-F-11.5).
- [ ] **T4.2** `src/validate/bounded.ts`: static rejection of nested quantifiers
  and `{n,}` above 4 096.
  *Verify:* `bounded.test.ts` — `(a+)+$` rejected; `scanLine` on a 10 000-char
  hostile line returns in < 50 ms (PLA-F-11.2).
- [ ] **T4.3** Priority handling: a custom rule can raise priority, never lower a
  built-in's priority.
  *Verify:* `custom-priority.test.ts` (PLA-F-11.4).
- [ ] **T4.4** Loader for repository-provided rules (data only: id, family,
  keywords, pattern source, flags, priority, provider) — no code from disk.
  *Verify:* review of `custom.ts` shows no `eval` / `new Function` /
  dynamic `import` (PLA-F-11.3).

## Phase 5 — Properties

- [ ] **T5.1** `src/properties.test.ts` — PLA-P-02: for 50 seeds, every planted
  value is detected by its `expectedRule`, every family is covered, filler
  content yields zero detections.
- [ ] **T5.2** `src/properties.test.ts` — PLA-P-04: valid/invalid checksum pairs,
  no-throw over arbitrary Unicode, offset invariant, entropy monotonicity.
  *Verify:* `pnpm vitest run packages/detectors` green, 1 000 runs per property.
- [ ] **T5.3** Determinism: two engines built with the same options return the
  same `rules()` order and the same detections for the same input.

## Phase 6 — Hand-off

- [ ] **T6.1** Export the built-in rule ids as a frozen constant so
  `@placard/ritual` can map `rule → provider` for rotation cards without a
  second table.
  *Verify:* `packages/ritual/src/rotation.ts` imports it; no duplicated mapping.
- [ ] **T6.2** JSDoc on `scanLine` stating the non-disclosure rule (the value
  returned is in memory only and must be fingerprinted by the caller).
  *Verify:* `pnpm lint` green.
