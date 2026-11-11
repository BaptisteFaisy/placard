# Requirements — Haunted Manor UI (`@placard/manor-model`, `@placard/ui`, `@placard/web`)

> Kiro spec · workflow: **design first** — `design.md` was written first, from
> the costume mapping; the requirements below are derived from it.
> Requirements: PLA-F-14 … PLA-F-21 · Property: PLA-P-11
> Packages: `packages/manor-model/`, `packages/ui/`, `packages/web/`

## 1. Context

Placard's costume is not decoration: the manor *is* the report. A user must be
able to read a repository's history of leaks the way one reads a house — floor by
floor, door by door — and then switch to a table that says exactly the same
thing for a screen reader, a keyboard, or a copy-paste into a ticket.

That dual obligation is the whole design tension: the gothic view must carry
information, and the accessible view must not be a second-class summary.

## 2. Goals

1. Every visual element encodes a field of `ManorViewModel` (no free decor).
2. Both views expose the **same set** of findings for any filter.
3. Keyboard-only operation, AA contrast, no colour-only meaning, no sound.
4. Bounded rendering cost at 500 doors.
5. A hosted demo that needs no install and never touches a real repository.

## 3. Non-goals

- Scanning. The web app only loads a report (produced by the CLI).
- Editing remediation state. The ritual view calls `@placard/ritual` through the
  CLI, the manor only displays the resulting `state`.
- Server-side rendering or a backend. The app is static.
- Animations for their own sake.

## 4. Requirements (EARS)

### PLA-F-14 — Floors are years

- **PLA-F-14.1** THE SYSTEM SHALL render one floor per distinct year present in
  the commits of the report, ordered from the oldest (index 0, the attic) to the
  most recent (the ground floor).
- **PLA-F-14.2** WHEN the oldest year is reached THE SYSTEM SHALL set
  `attic: true` on that floor and on no other; WHEN the current year is present
  THE SYSTEM SHALL set `ground: true` on it.
- **PLA-F-14.3** THE SYSTEM SHALL order the items of a floor chronologically,
  left to right, by commit date then by short commit id.
- **PLA-F-14.4** WHEN a year has no commit THE SYSTEM SHALL NOT render a floor
  for it, and SHALL indicate the gap in the year axis label.

*Acceptance criteria*

- [ ] A report spanning 2020–2026 yields 7 floors, `floors[0].attic === true`.
- [ ] Floor years are strictly increasing.
- [ ] Items within a floor are sorted by `date` ascending.

### PLA-F-15 — Doors and walls

- **PLA-F-15.1** WHEN a commit holds at least one finding (after filtering) THE
  SYSTEM SHALL render a `Door` for it, carrying commit, short commit, date,
  year, max severity, age in days, findings, sealed and dismissed counts.
- **PLA-F-15.2** WHEN consecutive commits of a floor hold no finding THE SYSTEM
  SHALL compress them into a single `WallStretch` with the exact count, the first
  and last commit, so that no information is lost.
- **PLA-F-15.3** THE SYSTEM SHALL guarantee that for every floor,
  `sum(walls.commits) + doors.length` equals the number of commits of that year.
- **PLA-F-15.4** WHEN a door is rendered THE SYSTEM SHALL expose a text
  `ariaLabel` naming the date, the number of findings, the max severity and the
  seal/ribbon state.
- **PLA-F-15.5** THE SYSTEM SHALL NOT render a door for a commit whose findings
  are all excluded by the current filter; those commits join a wall instead.

*Acceptance criteria*

- [ ] For a 120-commit demo, the sum in PLA-F-15.3 holds on every floor.
- [ ] A wall's `ariaLabel`/text says "12 commits" and names the year.
- [ ] Filtering to `critical` only turns the doors without a critical finding
      into walls, and the wall count increases accordingly.

### PLA-F-16 — Skeletons encode family and danger

- **PLA-F-16.1** THE SYSTEM SHALL map each finding family to a skeleton kind via
  `FAMILY_TO_SKELETON` from `@placard/core`: key-bearer (cloud key, platform
  token, private key, signed token, plaintext password), paper-bearer (bank data,
  identity), chest (risky file), loose-bones (suspicious string).
- **PLA-F-16.2** THE SYSTEM SHALL scale the skeleton between 0.5 and 1.5 of the
  base size as a linear function of `danger / 100`.
- **PLA-F-16.3** WHEN a finding has `inHead: true` THE SYSTEM SHALL render it
  standing in the entrance hall, in addition to its door on the corridor.
- **PLA-F-16.4** THE SYSTEM SHALL NOT use skeleton size for anything but the
  danger score, and SHALL NOT use colour as the only family cue: each kind has a
  distinct silhouette and a text label.

*Acceptance criteria*

- [ ] Every finding in the report renders exactly one skeleton kind, and the
      four kinds appear in the demo.
- [ ] `danger: 0` and `danger: 100` produce the documented minimum and maximum
      sizes; `danger: 50` sits halfway.
- [ ] The hall contains exactly `hall.standing` skeletons, equal to the number of
      findings with `inHead`.

### PLA-F-17 — Bony footprints

- **PLA-F-17.1** WHEN a finding is selected THE SYSTEM SHALL draw a
  `FootprintTrail` linking its introduction door, the doors where it is present,
  and its removal doors, across floors, in chronological order.
- **PLA-F-17.2** THE SYSTEM SHALL set `lifetimeDays` to the difference in days
  between the introduction date and the last removal date (or `now` when the
  finding is still in `HEAD`).
- **PLA-F-17.3** THE SYSTEM SHALL provide an `ariaLabel` of the form
  "lived 14 months across 11 doors on 2 floors".
- **PLA-F-17.4** THE SYSTEM SHALL draw footprints for the selected finding only,
  and SHALL NOT draw them for findings excluded by the filter.

*Acceptance criteria*

- [ ] Selecting a long-lived finding draws a trail crossing at least two floors
      in the demo.
- [ ] `lifetimeDays` matches the date arithmetic on the fixture.
- [ ] With no selection, no footprint is drawn.

### PLA-F-18 — Every ornament carries a datum

- **PLA-F-18.1** WHEN a door is rendered THE SYSTEM SHALL draw 0 to 3 spiderweb
  strands with `strands = min(3, floor(ageDays / 365))`.
- **PLA-F-18.2** THE SYSTEM SHALL colour the glow under a door from the door's
  max severity, using the `SEVERITY_COLORS` palette, and SHALL pair it with the
  `SEVERITY_GLYPHS` glyph and a text label.
- **PLA-F-18.3** WHEN `repo.publicRemote` is true THE SYSTEM SHALL render an open
  window in the corridor; WHEN false, a closed one.
- **PLA-F-18.4** WHEN a door holds sealed findings THE SYSTEM SHALL render a wax
  seal with the count; WHEN it holds ignored findings, a ribbon with the count.
- **PLA-F-18.5** THE SYSTEM SHALL NOT render any element that is not listed in
  `.kiro/steering/costume-mapping.md`; the `costume-reviewer` agent enforces
  this on review.

*Acceptance criteria*

- [ ] A 3-year-old commit shows 3 strands; a 100-day-old commit shows 0.
- [ ] The open/closed window matches `publicRemote` in both demo modes.
- [ ] Review sign-off from the `costume-reviewer` agent is recorded in the PR.

### PLA-F-19 — Filters

- **PLA-F-19.1** THE SYSTEM SHALL provide filters for severity, family, state,
  `inHead`, year range (inclusive) and a free-text query.
- **PLA-F-19.2** WHEN the query is non-empty THE SYSTEM SHALL match it
  case-insensitively against `preview`, every location `path`, and `rule`, and
  SHALL NOT match it against any value.
- **PLA-F-19.3** WHEN several criteria are set THE SYSTEM SHALL apply them with
  AND semantics, and within a criterion (several severities) with OR semantics.
- **PLA-F-19.4** WHEN `emptyFilter()` is used THE SYSTEM SHALL return the filter
  with no criterion, which selects every finding.
- **PLA-F-19.5** THE SYSTEM SHALL apply filters through exactly one
  implementation, `applyFilters`, used by both views.

*Acceptance criteria*

- [ ] `applyFilters(findings, emptyFilter())` returns all findings.
- [ ] A query on a redacted preview never returns a finding whose value matched
      (the value is not searchable by design).
- [ ] Severity `['critical','high']` returns the union of both.

### PLA-F-20 — The entrance hall

- **PLA-F-20.1** THE SYSTEM SHALL render a hall summary with `total`, `standing`
  (findings still in `HEAD`), `bySeverity`, `byFamily`, `sealed`, `dismissed`,
  `open`, and `publicRemote`.
- **PLA-F-20.2** THE SYSTEM SHALL compute the summary from the filtered set, and
  SHALL keep `total` equal to `model.findings.length`.
- **PLA-F-20.3** THE SYSTEM SHALL render `standing` skeletons in the hall, and
  SHALL label the group for assistive technology.

*Acceptance criteria*

- [ ] `sum(bySeverity) === total` for any filter.
- [ ] `open + rotated + purged + sealed + dismissed === total` (states partition).
- [ ] The hall label reads e.g. "6 secrets still present in HEAD".

### PLA-F-21 — Accessible registry and labels

- **PLA-F-21.1** THE SYSTEM SHALL provide a registry view: a real `<table>` with
  columns id, severity, family, rule, path, first seen, lifetime, danger, state,
  each header with `scope="col"` and a sort control.
- **PLA-F-21.2** THE SYSTEM SHALL make every door, skeleton, wall, footprint and
  filter operable and announceable by keyboard alone, with a visible focus
  indicator (the lantern).
- **PLA-F-21.3** THE SYSTEM SHALL meet WCAG 2.1 AA contrast (4.5:1 body text,
  3:1 large text and UI boundaries) on the `art-direction.md` palette.
- **PLA-F-21.4** THE SYSTEM SHALL respect `prefers-reduced-motion: reduce` by
  disabling every transition, and SHALL produce no sound.
- **PLA-F-21.5** THE SYSTEM SHALL NOT convey severity, state, family or
  selection by colour alone: each has a glyph, a shape and a text label.
- **PLA-F-21.6** WHEN the registry is sorted THE SYSTEM SHALL sort on the
  requested field and direction, with a stable tie-break on `id`.

*Acceptance criteria*

- [ ] `a11y.test.tsx` passes: axe-core-free manual assertions on labels, roles,
      focus order and contrast constants.
- [ ] Tab/arrow/Home/End/Enter/Escape navigate the whole corridor.
- [ ] With `prefers-reduced-motion`, no transition exceeds 0 ms.

### PLA-P-11 — Manor/registry equivalence (property)

- **PLA-P-11.1** FOR ALL reports and ALL filters `f`, the set of finding ids
  reachable in the manor equals `registryRows(buildViewModel(report, f), sort)`
  mapped to ids, for every `sort`.
- **PLA-P-11.2** FOR ALL reports and ALL filters, `model.hall.total` equals
  `model.findings.length`.
- **PLA-P-11.3** FOR ALL reports, applying a filter twice is idempotent:
  `applyFilters(applyFilters(F, f), f) = applyFilters(F, f)`.
- **PLA-P-11.4** FOR ALL reports, `buildViewModel` is pure and deterministic: the
  same `(report, filter, now)` yields deeply equal models.

*Acceptance criteria*

- [ ] `fast-check` over random filters and the demo report: 300 runs, zero
      mismatch.
- [ ] Idempotence and determinism properties hold with `now` fixed.

## 5. Traceability

| Requirement | Verified by |
|---|---|
| PLA-F-14 | `packages/manor-model/src/floors.test.ts` |
| PLA-F-15 | `packages/manor-model/src/items.test.ts` |
| PLA-F-16 | `packages/manor-model/src/view-model.test.ts` + `packages/ui/src/Skeleton.test.tsx` |
| PLA-F-17 | `packages/manor-model/src/footprints.test.ts` |
| PLA-F-18 | `packages/ui/src/Door.test.tsx` + `costume-reviewer` review |
| PLA-F-19 | `packages/manor-model/src/filters.test.ts` |
| PLA-F-20 | `packages/manor-model/src/hall.test.ts` |
| PLA-F-21 | `packages/ui/src/a11y.test.tsx` (Kiro hook `a11y-check`) |
| PLA-P-11 | `packages/manor-model/src/properties.test.ts` |
