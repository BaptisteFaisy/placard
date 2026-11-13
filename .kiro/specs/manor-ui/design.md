# Design — Haunted Manor UI (`@placard/manor-model`, `@placard/ui`, `@placard/web`)

> Kiro spec · workflow: **design first**
> The costume mapping (`.kiro/steering/costume-mapping.md`) is the *input* of
> this design: every visual element must encode a real datum, so the mapping is
> fixed before any requirement is written. `requirements.md` derives from the
> tables below, not the other way round.
> Implements PLA-F-14 … PLA-F-21, PLA-P-11.

## 1. The costume contract (input)

| Manor element | Datum | Source field | Cardinality |
|---|---|---|---|
| A floor | A year of history | `commit.date` year | one per distinct year |
| Attic (top floor) | The oldest year | `min(year)` | exactly one |
| Ground floor (bottom) | The current year | `now.getFullYear()` or `max(year)` | exactly one |
| The corridor, left → right | Time, chronological | `commit.date` | ordered |
| A door | A commit holding ≥ 1 finding | `Door.commit` | one per such commit |
| A wall labelled "N commits" | A run of commits with zero findings, compressed | `WallStretch.commits` | one per run |
| Spiderwebs on a door | Age of the commit | `Door.ageDays` | density ∝ age |
| Glow under a door | Max severity behind it | `Door.severity` | 4 levels |
| Skeleton kind | Detected family | `FAMILY_TO_SKELETON` | 4 kinds |
| Skeleton size | Danger score 0–100 | `Finding.danger` | continuous |
| Bony footprints | Lifetime of one secret across doors and floors | `FootprintTrail` | one per selected finding |
| Skeleton standing in the hall | Secret still present in `HEAD` | `Finding.inHead` | count |
| Open window in the corridor | Repository has a public remote | `repo.publicRemote` | boolean |
| Red wax seal | Finding treated (rotated + purge acknowledged) | `Finding.state === 'sealed'` | per door count |
| Tied ribbon | False positive dismissed with a rationale | `state === 'ignored'` | per door count |
| The lantern | Focus: follows the cursor or keyboard, lights the active finding | UI state only | one |
| The registry on the side table | Accessible table view, same data | `RegistryRow[]` | same set |

Rule: **no decorative element without a datum.** The `costume-reviewer` custom
agent (`.kiro/agents/costume-reviewer.md`) enforces this on review; a bat, a
blood stain or a ghost without a field behind it is rejected.

## 2. Architecture

```
                    PlacardReport (JSON)
                            |
                 +----------v-----------+
                 |  @placard/manor-model |   pure, no React, no DOM
                 |  buildViewModel()     |   report + filter → ManorViewModel
                 |  applyFilters()       |   ONE filter implementation
                 |  footprints()         |   one trail per selected finding
                 |  registryRows()       |   same set, sorted
                 |  severityOf()         |   re-export of core thresholds
                 +----+-------------+----+
                      |             |
          +-----------v--+     +----v-----------+
          |  @placard/ui |     | @placard/web   |
          |  React comps |     | Vite app       |
          +--------------+     +----------------+
            ManorCanvas            hosted demo
            Corridor / Floor       drop a report.json
            Door, WallStretch      filter bar
            Skeleton               manor ⇄ registry toggle
            Footprints             hall summary
            Hall                   ritual panel
            Registry (table)
            FilterBar
            Lantern
```

The model package is the single source of truth for both views. `@placard/ui`
never filters; it renders what the model returns. That is what makes PLA-P-11
provable instead of aspirational.

## 3. Modules and responsibilities

| Module | Package | Responsibility |
|---|---|---|
| `floors.ts` | manor-model | Group commits into years, mark attic/ground, order items chronologically. |
| `items.ts` | manor-model | Fold a year's commits into `Door` / `WallStretch` runs (C.4 compression). |
| `filters.ts` | manor-model | `applyFilters` — severity, family, state, `inHead`, year range, query. |
| `footprints.ts` | manor-model | Trail from introduction door to removal doors, `lifetimeDays`, `ariaLabel`. |
| `hall.ts` | manor-model | Counts by severity/family/state, `standing`, `publicRemote`. |
| `registry.ts` | manor-model | `registryRows` — same set as `model.findings`, sorted, with `ariaLabel`. |
| `severity.ts` | manor-model | Re-export `severityOf` from `@placard/core` (no second threshold table). |
| `view-model.ts` | manor-model | `buildViewModel(report, filter, now)` — pure, deterministic. |
| `ManorCanvas.tsx` | ui | SVG root, viewBox, floor layout, `<title>`/`<desc>` for the whole scene. |
| `Floor.tsx` | ui | One floor band, year label, corridor ordering. |
| `Door.tsx` | ui | Door shape, glow, webs, seal, ribbon, focusable, `aria-label`. |
| `WallStretch.tsx` | ui | Compressed wall with "N commits" label. |
| `Skeleton.tsx` | ui | Kind from family, scale from danger, standing posture when `inHead`. |
| `Footprints.tsx` | ui | Dashed bony trail across doors and floors. |
| `Hall.tsx` | ui | Entrance hall summary, standing skeletons. |
| `Registry.tsx` | ui | Accessible table, sortable headers, roving tabindex. |
| `FilterBar.tsx` | ui | Severity/family/state/year/query controls, all labelled. |
| `Lantern.tsx` | ui | Focus indicator that follows keyboard focus. |
| `useKeyboard.ts` | ui | Arrow/Home/End/Enter/Escape navigation across the corridor. |
| `a11y.ts` | ui | `prefers-reduced-motion`, contrast helpers, label builders. |
| `App.tsx` | web | Router between manor, registry, hall, ritual; report loading. |
| `drop.ts` | web | `safeParseReport` on a dropped file, error message without content. |

## 4. Interface contract (copied from `packages/core/src/contracts/manor.ts`)

```ts
export interface FindingFilter {
  severities: SeverityLevel[];
  families: Finding['family'][];
  states: Finding['state'][];
  inHead?: boolean;
  fromYear?: number;
  toYear?: number;
  query?: string;
}

export interface WallStretch {
  kind: 'wall';
  commits: number;
  year: number;
  fromCommit: string;
  toCommit: string;
}

export interface Door {
  kind: 'door';
  commit: string;
  shortCommit: string;
  date: string;
  year: number;
  severity: SeverityLevel;
  ageDays: number;
  findings: Finding[];
  sealed: number;
  dismissed: number;
  ariaLabel: string;
}

export type CorridorItem = Door | WallStretch;

export interface Floor {
  year: number;
  attic: boolean;
  ground: boolean;
  items: CorridorItem[];
  findings: number;
  severity: SeverityLevel | 'none';
}

export interface FootprintTrail {
  fingerprint: string;
  doors: { commit: string; year: number; role: 'introduced' | 'present' | 'removed' }[];
  lifetimeDays: number;
  ariaLabel: string;
}

export interface HallSummary {
  total: number;
  standing: number;
  bySeverity: Record<SeverityLevel, number>;
  byFamily: Record<Finding['family'], number>;
  sealed: number;
  dismissed: number;
  open: number;
  publicRemote: boolean;
}

export interface ManorViewModel {
  floors: Floor[];
  hall: HallSummary;
  filter: FindingFilter;
  findings: Finding[];
  repo: PlacardReport['repo'];
  doorCount: number;
  wallCount: number;
}

export interface ManorModelApi {
  buildViewModel(report: PlacardReport, filter: FindingFilter, now?: Date): ManorViewModel;
  applyFilters(findings: readonly Finding[], filter: FindingFilter): Finding[];
  footprints(report: PlacardReport, finding: Finding): FootprintTrail;
  severityOf(danger: number): SeverityLevel;
  emptyFilter(): FindingFilter;
  registryRows(model: ManorViewModel, sort: RegistrySort): RegistryRow[];
}

export type RegistrySortField = 'danger' | 'date' | 'family' | 'path' | 'state';

export interface RegistrySort {
  field: RegistrySortField;
  direction: 'asc' | 'desc';
}

export interface RegistryRow {
  finding: Finding;
  severity: SeverityLevel;
  path: string;
  ariaLabel: string;
}
```

## 5. Layout (ASCII wireframe)

```
+--------------------------------------------------------------+
|  PLACARD · my-repo · 4 213 commits · public remote  [open]    |  <- header
+--------------------------------------------------------------+
|  filters: severity ▾  family ▾  state ▾  year [2019-2026]  🔍 |
+--------------------------------------------------------------+
|  attic      2020  | D  W(12)  D     D  W(3)                  |  oldest
|  floor 1    2023  | W(40)     D     W(7)   D                 |
|  ground     2026  | D         W(2)  D     D                  |  today
|                    ^lantern        ^open window (public remote)
+--------------------------------------------------------------+
|  HALL: 14 skeletons · 6 standing · 3 sealed · 2 ribbons      |
+--------------------------------------------------------------+
   [ Manor ] [ Registry ] [ Ritual ]        <- view tabs (both views = same set)
```

A door renders as:

```
    ,---.        webs: 0-3 strands (age)
    | o |        glow:  colour under the door (severity) + glyph + label
    |___|        seal:  red wax circle (sealed)  ribbon: purple bow (ignored)
   ( ..)  <- bony footprints passing through the door
```

## 6. Key decisions and rationale

1. **One model, two views.** `buildViewModel` returns `findings` already
   filtered; the manor renders `floors`, the registry renders
   `registryRows(model, sort)`. Both read `model.findings`. PLA-P-11 becomes a
   structural property rather than a promise.
2. **`@placard/manor-model` has no React dependency.** It is pure TypeScript, so
   the equivalence property is a unit test, not a DOM test — and the CLI can use
   it to print a text-mode manor.
3. **Floors are years, not arbitrary bands.** A user remembers "the 2021 leak".
   The attic/ground naming gives the vertical axis a meaning (old = up, now =
   down) that survives translation and screen readers.
4. **Walls are compressed runs.** 4 213 commits across 6 years would otherwise be
   4 213 SVG nodes. A run of commits without findings becomes one wall with an
   explicit count, which is also *information* ("nothing happened here").
5. **Severity thresholds come from `@placard/core`.** Duplicating the 85/65/40
   thresholds in the UI would let the manor and the report disagree.
6. **Age → webs with a cap.** Density is `min(3, floor(ageDays / 365))` strands,
   so a 10-year-old commit is not a solid mass of spiderweb and the SVG stays
   cheap.
7. **Colour is never alone.** Every severity has a glyph (`!!!`, `!!`, `!`, `.`)
   and a text label; every seal/ribbon has a text alternative in the
   `aria-label`. This is PLA-N-05 and WCAG AA 1.4.1.
8. **Keyboard-first navigation.** `Tab` enters the corridor, arrows move between
   doors, `Home`/`End` jump to the ends of a floor, `PageUp`/`PageDown` change
   floor, `Enter` opens the finding panel, `Escape` returns to the corridor.
   The lantern follows focus, so a keyboard user always sees where they are.
9. **`prefers-reduced-motion` disables transitions, not information.** The glow
   is static, the lantern is a border, not a pulsing halo. No sound anywhere.
10. **The web app drops a report, it never scans.** The hosted demo runs on
    synthetic data; a user who wants their own repository runs the CLI. This
    keeps the browser free of any Git access and of any secret.

## 7. Edge cases

| Case | Behaviour |
|---|---|
| 0 findings | Manor renders an empty corridor with a "no skeletons" message; hall shows zeros; registry shows an empty state. |
| 1 commit, 1 finding | One floor, one door, no walls. |
| 500 doors (journal §7 scenario) | Walls still compress; doors render but footprints are only drawn for the selected finding; SVG stays under ~2 000 nodes. |
| Findings with the same date | Ordered by `shortCommit` for stability. |
| Year gap (no commits in 2022) | No floor for 2022; the vertical axis is compressed and the label says so. |
| Future-dated commit (demo `headDate`) | Floor above the current year, labelled `ground` only if it is the current year. |
| Filter matching nothing | Manor shows "no door matches", registry shows the same empty state, hall counts reflect the filter. |
| A door whose findings are all ignored | Door renders with a ribbon; `severity` is still computed from the findings. |
| Footprint for a finding with one location | A single mark, `lifetimeDays: 0`, label "introduced and still present". |
| Report dropped that is not a Placard report | `safeParseReport` fails, the UI shows a typed error, never a stack trace with content. |
| Reduced motion | No transitions; the lantern is a static outline. |
| Zoom 200 % / 400 % | Layout reflows to a single column; no horizontal scrolling required for the registry. |

## 8. Performance strategy

- The model is computed once per filter change (`useMemo`), not per render.
- Doors render only the visible floors plus one floor of margin (windowed
  rendering); 500 doors across 6 floors means ~85 doors per floor, well within
  budget.
- Footprints are computed for the *selected* finding only — drawing all trails
  would be O(doors × findings).
- SVG uses no filters or blurs for the glow (a `<rect>` with a gradient fill),
  because `feGaussianBlur` on 500 nodes drops frames on integrated GPUs.
- The registry virtualises above 200 rows.

## 9. Accessibility (AA)

| Criterion | Implementation |
|---|---|
| 1.1.1 Non-text content | `<title>` and `<desc>` on the SVG; `aria-label` on every door, skeleton and wall. |
| 1.3.1 Info and relationships | The registry is a real `<table>` with `<th scope>`; the manor is a `role="group"` list of floors. |
| 1.4.1 Use of colour | Glyph + text label for every severity, seal and ribbon. |
| 1.4.3 Contrast | Palette from `art-direction.md`; body text on `#14101F` meets 4.5:1, large text 3:1; verified by `a11y.test.tsx`. |
| 2.1.1 Keyboard | Everything reachable and operable by keyboard (see §6.8). |
| 2.4.3 Focus order | Corridor order = chronological order, which matches the reading order. |
| 2.4.7 Focus visible | The lantern is the focus ring. |
| 2.3.3 Animation from interactions | All motion < 400 ms and disabled under `prefers-reduced-motion`. |
| 4.1.2 Name, role, value | Doors expose `aria-pressed` when selected; filters are native inputs with labels. |

No sound is produced anywhere in the application.

## 10. Open questions

- Should the corridor scroll horizontally or wrap per floor? Current answer:
  horizontal scroll with `scroll-snap` per door, plus `Home`/`End`.
- Do we need a zoom control above 500 doors? Deferred; walls compression keeps
  the node count bounded for now.
