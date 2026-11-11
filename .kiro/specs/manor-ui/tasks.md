# Tasks — Haunted Manor UI (`@placard/manor-model`, `@placard/ui`, `@placard/web`)

> Kiro spec · workflow: **design first** (`design.md` precedes these tasks)
> Legend: `[x]` done · `[ ]` to do.

## Phase 0 — Scaffolding

- [x] **T0.1** Three package skeletons (`manor-model`, `ui`, `web`), contracts
  re-exported from `@placard/core`, no new dependency.
  *Verify:* `pnpm typecheck` lists the three packages.

## Phase 1 — Model: floors and items

- [ ] **T1.1** `src/floors.ts`: group commits into years, attic/ground flags,
  chronological ordering, year-gap labelling.
  *Verify:* `floors.test.ts` (PLA-F-14.1 … PLA-F-14.4).
- [ ] **T1.2** `src/items.ts`: fold a year's commits into doors and compressed
  walls; assert the accounting invariant.
  *Verify:* `items.test.ts` — `sum(walls.commits) + doors === commits`
  (PLA-F-15.1 … PLA-F-15.3).
- [ ] **T1.3** `ariaLabel` builders for doors and walls (single implementation in
  `src/labels.ts`, reused by the registry).
  *Verify:* `labels.test.ts` — label contains date, count, severity and state
  (PLA-F-15.4).

## Phase 2 — Model: filters, hall, registry

- [ ] **T2.1** `src/filters.ts`: `applyFilters` and `emptyFilter` (the only
  filter implementation), AND across criteria, OR within a criterion, query on
  preview/path/rule only.
  *Verify:* `filters.test.ts` (PLA-F-19.1 … PLA-F-19.5).
- [ ] **T2.2** `src/hall.ts`: summary counts by severity/family/state,
  `standing`, `publicRemote`, partition invariant.
  *Verify:* `hall.test.ts` (PLA-F-20.1, PLA-F-20.2).
- [ ] **T2.3** `src/registry.ts`: `registryRows` with stable sort and tie-break on
  id.
  *Verify:* `registry.test.ts` (PLA-F-21.1, PLA-F-21.6).
- [ ] **T2.4** `src/footprints.ts`: trail, `lifetimeDays`, `ariaLabel`.
  *Verify:* `footprints.test.ts` (PLA-F-17.1 … PLA-F-17.3).
- [ ] **T2.5** `src/view-model.ts`: `buildViewModel` pure and deterministic,
  re-export `severityOf` from core.
  *Verify:* `view-model.test.ts` (PLA-P-11.4).

## Phase 3 — Property tests

- [ ] **T3.1** `src/properties.test.ts`: PLA-P-11 — manor/registry id sets equal
  for random filters and all sorts; `hall.total === findings.length`; filter
  idempotence; determinism with fixed `now`.
  *Verify:* `pnpm vitest run packages/manor-model`, 300 runs per property.

## Phase 4 — SVG components

- [ ] **T4.1** `ManorCanvas.tsx`: SVG root with `<title>`/`<desc>`, viewBox,
  floor bands, `role="group"` per floor.
  *Verify:* `ManorCanvas.test.tsx` — floors rendered in order (PLA-F-14.1).
- [ ] **T4.2** `Door.tsx`: shape, glow (gradient, no blur), webs (0–3 strands),
  seal and ribbon with counts, `aria-pressed` when selected.
  *Verify:* `Door.test.tsx` (PLA-F-15.1, PLA-F-18.1 … PLA-F-18.4).
- [ ] **T4.3** `WallStretch.tsx`: compressed wall with "N commits" label and
  year.
  *Verify:* `WallStretch.test.tsx` (PLA-F-15.2).
- [ ] **T4.4** `Skeleton.tsx`: four silhouettes from `FAMILY_TO_SKELETON`, size
  from `danger`, standing posture when `inHead`.
  *Verify:* `Skeleton.test.tsx` (PLA-F-16.1 … PLA-F-16.4).
- [ ] **T4.5** `Footprints.tsx`: dashed trail across doors and floors, selected
  finding only.
  *Verify:* `Footprints.test.tsx` (PLA-F-17.4).
- [ ] **T4.6** `Hall.tsx`: summary panel and standing skeletons.
  *Verify:* `Hall.test.tsx` (PLA-F-20.3).

## Phase 5 — Interaction and accessibility

- [ ] **T5.1** `useKeyboard.ts`: Tab entry, arrows, Home/End, PageUp/PageDown,
  Enter, Escape; focus order = corridor order.
  *Verify:* `keyboard.test.tsx` (PLA-F-21.2).
- [ ] **T5.2** `Lantern.tsx`: focus ring that follows the active door.
  *Verify:* `Lantern.test.tsx` — visible on `:focus-visible`.
- [ ] **T5.3** `FilterBar.tsx`: labelled native controls for every criterion.
  *Verify:* `FilterBar.test.tsx` (PLA-F-19.1).
- [ ] **T5.4** `Registry.tsx`: real table, sortable headers, roving tabindex,
  virtualisation above 200 rows.
  *Verify:* `Registry.test.tsx` (PLA-F-21.1).
- [ ] **T5.5** `a11y.test.tsx`: contrast constants vs the `art-direction.md`
  palette, glyph+label for every severity/state/family, reduced-motion path, no
  sound, no colour-only meaning.
  *Verify:* this is the file run by the `a11y-check` Kiro hook (PLA-F-21.3 …
  PLA-F-21.5).

## Phase 6 — Web app

- [ ] **T6.1** `App.tsx`: view tabs (Manor / Registry / Ritual), shared filter
  state, single `buildViewModel` call per filter change.
  *Verify:* `App.test.tsx` — switching views keeps the filtered set identical.
- [ ] **T6.2** `drop.ts`: drop a `report.json`, `safeParseReport`, typed error
  message with no content.
  *Verify:* `drop.test.ts` (edge case "report dropped that is not a Placard
  report").
- [ ] **T6.3** Hosted demo mode: load the bundled synthetic report, no network,
  no repository access.
  *Verify:* build output loads offline (`pnpm --filter @placard/web build` then
  serve `dist/`).

## Phase 7 — Review gates

- [ ] **T7.1** `costume-reviewer` agent review: every rendered element maps to a
  field; no free decor.
  *Verify:* review comment recorded on the PR (PLA-F-18.5).
- [ ] **T7.2** Visual check at 100, 200 and 500 doors (journal §7 scenario): no
  footprint overlap, node count bounded.
  *Verify:* screenshot artefacts attached to the PR.
