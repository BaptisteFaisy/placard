# Design — Haunted Repo Generator (`@placard/demo-repo`)

> Kiro spec · workflow: **Quick Spec** — one design pass, no separate research
> phase. Implements PLA-F-13, PLA-N-09.

## 1. Architecture

```
        GenerateOptions { seed, targetDir, commits, years, secrets, headDate }
                                |
                     +----------v-----------+
                     |  plan (pure)         |  PRNG(seed) → timeline
                     |  timeline.ts         |  [{ date, kind, files[] }]
                     +----------+-----------+
                                |
                     +----------v-----------+
                     |  plant (pure)        |  choose family, path, lifetime,
                     |  planting.ts         |  locations → PlantedSecret[]
                     +----------+-----------+
                                |
                     +----------v-----------+
                     |  fake values         |  @placard/core fake-value factory
                     |  values.ts           |  (seed + index, runtime only)
                     +----------+-----------+
                                |
                     +----------v-----------+
                     |  writer (impure)     |  fs.mkdtemp / targetDir,
                     |  repo.ts             |  git init -b main, commits
                     +----------+-----------+
                                |
                     GenerateResult { repoDir, seed, commits, planted, head }
```

The split is deliberate: `plan` and `plant` are pure functions of the seed and
are unit-tested without touching the disk; only `repo.ts` is impure, and it is
the only module that shells out to `git`.

## 2. Modules and responsibilities

| Module | Responsibility |
|---|---|
| `prng.ts` | mulberry32 seeded from `sha256(seed)`; `rand()`, `pick()`, `int()`, `shuffle()`. |
| `timeline.ts` | Build `commits` events between `headDate - years` and `headDate`, monotonic, with filler commits interleaved. |
| `planting.ts` | Assign families, paths, introduction dates, lifetimes and location counts; guarantee PLA-F-13.6's mix. |
| `values.ts` | `fakeValue(family, seed, index)` — delegates to the `@placard/core` fake-value factory so checksums are valid by construction. |
| `templates.ts` | File content templates: realistic-looking source files, config files, test fixtures, with a `{{VALUE}}` placeholder. |
| `repo.ts` | `fs.mkdtemp` / `targetDir`, `git init -b main`, commit loop with `GIT_*_DATE` env vars, optional remote. |
| `oracle.ts` | Fills `introducedCommit` / `removedCommit` from the real SHAs after each commit, keeps `inHead`. |
| `index.ts` | `DemoRepoGenerator` implementation. |

## 3. Interface contract (copied from `packages/core/src/contracts/demo.ts`)

```ts
export interface PlantedSecret {
  id: string;
  family: FindingFamily;
  expectedRule: string;
  value: string;
  path: string;
  line: number;
  introducedCommit?: string;
  removedCommit?: string;
  inHead: boolean;
  locations: number;
  testPath: boolean;
  date: string;
}

export interface GenerateOptions {
  seed?: string;
  targetDir: string;
  commits?: number;
  years?: number;
  secrets?: number;
  headDate?: Date;
  publicRemote?: boolean;
}

export interface GenerateResult {
  repoDir: string;
  seed: string;
  commits: number;
  planted: PlantedSecret[];
  head: string;
}

export interface DemoRepoGenerator {
  generate(options: GenerateOptions): Promise<GenerateResult>;
  fakeValue(family: FindingFamily, seed: string, index?: number): string;
}
```

## 4. Key decisions and rationale

1. **One PRNG, seeded from SHA-256.** `Math.random()` would make the demo
   non-reproducible and the property tests flaky. mulberry32 is 6 lines, has no
   dependency, and is fast enough for 120 commits.
2. **Values come from `@placard/core`'s fake-value factory.** That factory
   *builds* valid Luhn/mod-97/NIR values with the same helpers the detectors use
   to *check* them. One implementation, two directions (PLA-P-04).
3. **Plan and plant are pure.** This is what makes determinism testable without
   a filesystem, and it is why `fakeValue` can be a plain function.
4. **Commit dates through environment variables.** The brief forbids depending on
   the global Git config; `GIT_AUTHOR_DATE` / `GIT_COMMITTER_DATE` plus
   `GIT_AUTHOR_NAME` / `GIT_AUTHOR_EMAIL` make the generator hermetic.
5. **Real SHAs, filled after the fact.** The oracle is only useful if it names
   commits that exist. `oracle.ts` reads `git rev-parse HEAD` after each commit
   and patches the corresponding record; the property tests then verify the
   oracle against `git show`.
6. **Guaranteed mix, not random mix.** PLA-F-13.6 fixes the shape of the demo
   (secrets in `HEAD`, removed secrets, test-path secrets, one long lifetime).
   Randomness picks *which* family and *where*, never *whether* the demo shows
   each manor feature.
7. **Filler commits.** Walls (stretches without findings) are a visual feature of
   the manor; without filler commits the corridor would be all doors.
8. **`publicRemote` writes a URL only.** No `git fetch`, no network, so the demo
   runs offline (PLA-N-01).
9. **`targetDir` is caller-controlled.** Tests pass `fs.mkdtemp`; the CLI passes
   `.placard/demo-repo`; nothing is ever written inside the tool's source tree.

## 5. Timeline shape

```
headDate - years                                      headDate
     |                                                    |
     v                                                    v
 c0  c1  c2 … c_n     commits evenly spaced, monotonic dates
  |   |   |             ~1 commit every (years*365/commits) days
  |   |   +-- filler
  |   +------ secret A introduced (long lifetime, still in HEAD)
  +---------- filler
                 …
                 +-- secret B introduced then removed 10 commits later
                 +-- secret C introduced in tests/fixtures/ (testPath)
```

## 6. Edge cases

| Case | Behaviour |
|---|---|
| `commits` smaller than `secrets` | One commit can carry several plants; the oracle records all. |
| `secrets < 9` | Raised to 9 (PLA-F-13.3). |
| `years: 0` | All commits on the same day, distinct timestamps (+1 s). |
| `targetDir` already exists and is non-empty | Typed error; never `rm -rf` a user directory. |
| `targetDir` inside the tool's repository | Typed error (PLA-N-09.3). |
| `headDate` in the future | Accepted; the manor simply labels a future year. |
| Git identity absent from the environment | Generator supplies its own; never reads global config. |
| Commit fails (disk full) | Typed error, `repoDir` left in place for inspection. |

## 7. Performance

120 commits with a handful of files each: under a second on a laptop, which
keeps the `demo` CLI command and the CI `test` job inside the 5-minute budget
(`docs/CI-QUEUE.md`). The generator is used in tests with 10–30 commits to stay
fast, and with 120 in the demo.

## 8. Error handling

Every failure is a typed error (`generate-target-not-empty`,
`generate-target-inside-tool-repo`, `generate-git-failed`). The generator never
leaves a half-written repository silently: on failure it reports the `repoDir`
so the caller can inspect it, and never deletes anything by itself.
