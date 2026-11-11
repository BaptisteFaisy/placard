# Video script — Placard (Skeletons in the Closet)

Kiroween 2026 submission video. **Target: under 3 minutes**, public on YouTube,
in English, no copyrighted music, no third-party brand marks on screen.

Raw footage of the app is already recorded: see `scripts/record-demo.mjs`
(Playwright, 1280×720, silent, `placard-demo.webm`, **75.2 s, 8.6 MB**) — it
captures the entrance hall, a slow pan over the five floors, a door and its
finding sheet, keyboard navigation, the registry, a filter and the costume
legend, and asserts that **zero** network request leaves the machine.

The file itself is **not** committed (8.6 MB of binary in a public repository);
regenerate it with the command below.

---

## Already produced: a silent draft cut

`scripts/build-submission-video.mjs` assembles a **2 min 34 s** silent H.264 cut
(1280×720, 30 fps, ~8.4 MB) from real material — no stock footage, no brand
marks, no music:

| # | Segment | Length | Source |
|---|---|---|---|
| 1 | Title card | 7 s | generated card |
| 2 | The wall of JSON | 17 s | **real** `placard scan --json` output, scrolling |
| 3 | `placard demo` / `placard serve` | 13 s | **real** CLI output |
| 4 | The manor walkthrough | 75 s | `scripts/record-demo.mjs` on the built app |
| 5 | Built with Kiro | 19 s | card with measured numbers |
| 6 | The steering file | 13 s | `.kiro/steering/never-print-secrets.md`, verbatim |
| 7 | Closing: 0 standing | 9 s | card with the repository and demo URLs |

```bash
npm i --prefix /tmp/placard-video playwright@1.49.0     # hors dépôt
npx --prefix /tmp/placard-video playwright install chromium
pnpm --filter @placard/web build
NODE_PATH=/tmp/placard-video/node_modules node scripts/record-demo.mjs          # segment 4
NODE_PATH=/tmp/placard-video/node_modules node scripts/build-submission-video.mjs
# → /tmp/placard-video/placard-submission-draft.mp4
```

What is still missing before upload: the English voice-over (or subtitles) and
the YouTube upload itself. Nothing else — the picture is complete and every
frame comes from the real tool.

## Rules from the contest (read before recording)

- Under 3 minutes, public on YouTube, showing the project running on the target
  device.
- No copyrighted music. No third-party brands on screen.
- English (or English subtitles).
- Judges are not required to test the app: the video and the text carry most of
  the score.

## Preparation

| Item | Value |
|---|---|
| Resolution | 1920×1080 for the terminal, 1280×720 for the app capture |
| Terminal font | ≥ 18 pt, dark background, no transparency |
| Browser | Private window, no bookmarks bar, no extension icons, no account avatar |
| Sound | None. Voice-over recorded separately, or English subtitles |
| Data on screen | Only the synthetic repository (`placard demo`) — never a real repository, never a real key |
| Clock/notifications | Disabled (do-not-disturb) |

Pre-generate everything so nothing loads on camera:

```bash
pnpm install
pnpm --filter @placard/web build
pnpm exec tsx packages/cli/src/main.ts demo --target /tmp/placard-demo   # synthetic repo
NODE_PATH=/tmp/placard-video/node_modules node scripts/record-demo.mjs   # app footage → /tmp/placard-video/placard-demo.webm
```

---

## Shot list (2 min 50 s)

### 0:00 – 0:20 — The problem (terminal)

**On screen:** a terminal, a scanner output scrolling — 214 lines of JSON.

**Voice-over:**
> "This repository is three years old. Last month, someone pasted a cloud key
> into a config file and deleted it in the next commit. It is still there — in the
> history. Anyone who clones this repository can read it.
>
> I ran a scanner. Two hundred and fourteen lines. Which ones still work? Which
> one do I fix first? I scrolled for a minute, gave up, and shipped.
>
> Deleting a secret from your code does not delete it from your history."

### 0:20 – 0:45 — Entering the manor (app footage)

**On screen:** `placard demo` then `placard serve`; the browser opens, the manor
builds itself, floors appear.

**Voice-over:**
> "This is Placard. It scans the whole history — every ref, added **and** removed
> lines — and renders it as a haunted manor.
>
> One floor per year: the attic is 2022, the ground floor is today. One door per
> commit that hides something. That grey panel is 312 commits with nothing to
> report. Spiderwebs mean the commit is old. The glow under the door is the worst
> severity behind it."

**Cut to:** the hall counters — "12 skeletons, 8 still standing".

### 0:45 – 1:20 — The lifetime of a secret (app footage)

**On screen:** climb to the attic, click the red door, the finding sheet opens;
then select a skeleton and the bony footprints light up across two floors.

**Voice-over:**
> "The attic, red glow. Behind the door: a skeleton holding a key. The sheet tells
> me the family, a masked preview — never the value — where it lived, and a danger
> score of 95 **with every term that produced it**: base 85 for a cloud key, plus
> 10 because the remote is public.
>
> Now I select it. Those footprints are the secret's lifetime: it was introduced
> here, copied there, and removed fourteen months later. One glance, and I know
> whether this died in 2023 or is still walking in `main`."

### 1:20 – 1:50 — The ritual imposes the order (app footage)

**On screen:** the ritual panel. Step 1 (rotation) with the AWS sheet; ticking it
unlocks step 2; the generated script and its warnings; then a re-scan and the wax
seal appearing on the door.

**Voice-over:**
> "Finding it is the easy part. The order is what saves you.
>
> Step one: rotate. Placard gives me the provider's page, what to check, and
> waits for me to confirm the key is revoked.
>
> Step two is **locked** until then — and that is the point. Rewriting history
> does not un-leak a key that has already been cloned.
>
> When it unlocks, Placard writes a `git filter-repo` script and a replacements
> file outside the repository, mode 0600 — the only place a value is ever written.
> It never runs it against your repository.
>
> Step three: prevention — gitignore entries and a pre-commit hook. Step four:
> re-scan. The finding is gone, the door gets its wax seal, and I get a dated
> certificate I can hand to an auditor."

### 1:50 – 2:10 — The costume never costs usability (app footage)

**On screen:** switch to the Registry tab; sort a column; toggle a filter; then
navigate the manor with the keyboard only (Tab, arrows, Enter, Escape).

**Voice-over:**
> "The décor costs nothing in usability. This is the same data as a table:
> sortable, filterable, and a tested property guarantees the manor and the
> registry always expose exactly the same findings.
>
> Everything is reachable by keyboard, contrast is AA, and no information is
> carried by colour alone. No sound, ever."

### 2:10 – 2:45 — How Kiro built it (IDE / editor footage)

**On screen:** `.kiro/steering/costume-mapping.md`, then `never-print-secrets.md`,
then the `costume-reviewer` agent file, then a property test failing and being
fixed.

**Voice-over:**
> "Kiro built this, and the steering files are why it looks like this.
>
> `costume-mapping.md` is a contract: every decorative element must encode a
> fact. A read-only reviewer agent checks each screen against it — it rejected an
> animated bat, because a bat encodes nothing.
>
> `never-print-secrets.md` says no real-format secret is ever written into the
> repository, so every test value is generated at runtime from a seed. The CI
> proves it: the repository scans **itself** with its own engine and fails the
> build if a single finding is open. It currently reports zero.
>
> And property-based testing caught what unit tests missed: an npm version string
> that looked like an email address — three hundred and sixty-eight false
> positives in one lockfile."

### 2:45 – 2:50 — Close (app footage)

**On screen:** the hall, the counter reading **0 standing**.

**Voice-over:**
> "Zero standing. The closet is empty — and now I can prove it.
>
> Placard. MIT licensed, runs entirely on your machine."

---

## Alternate 60-second cut (for the social post)

Keep only: 0:00–0:10 (problem), 0:20–0:45 (manor builds), 0:45–1:05 (footprints),
1:20–1:35 (locked purge), 2:45–2:50 (0 standing).

## Publication checklist

- [ ] Video under 3:00, public on YouTube, unlisted is **not** allowed
- [ ] English audio or English subtitles
- [ ] No music, no third-party brand visible (including browser UI and editor
      account avatars)
- [ ] Only the synthetic repository appears on screen
- [ ] Link added to the Devpost submission
- [ ] Terminal segments show real commands, not staged screenshots
