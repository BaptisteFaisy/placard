# Blog post draft — to publish on a third-party platform during the submission window

> Bonus entry requirement: published **during** the hackathon period, on a
> third-party platform (Dev.to, Hashnode, Medium, a personal blog…), and it must
> say it was written as part of Kiroween 2026.

---

# My secret scanner is a haunted house, and that is the point

*Written for Kiroween 2026 (Costume Contest).*

## The list is the problem

Three years of commits, and one afternoon in November 2024 when someone pasted a
cloud key into `config/deploy.env`, noticed, and deleted it in the next commit.
Clean, right?

No. The key is still in the history. Anyone who clones the repository can read
it with `git log -p`. Deleting a secret from your code does not delete it from
your history — and every scanner you have ever run told you that, then handed you
a list.

I ran the well-known ones on a mid-sized repository before starting this project.
**214 lines of output.** Here is what happened next, honestly: I read about
twenty, could not tell which ones still worked, could not tell which order to fix
them in, and closed the terminal. That is the failure mode nobody designs for.
The scanner did its job. The human did not have the capacity to do theirs.

So for Kiroween 2026 I built **Placard** — "Skeletons in the Closet" — and the
costume is not a skin over the tool. The costume *is* the data model.

## Every ghost is a fact

The rule I gave myself, written into the project as a steering file that every
agent working on the code had to respect:

> No decorative element. Every frightening thing on screen encodes a property of
> a finding.

Here is the mapping:

| In the manor | In your repository |
|---|---|
| A floor | One year of history — the attic is the oldest |
| A door | A commit that hides at least one finding |
| A wall panel labelled "312 commits" | A run of commits with nothing to report |
| Spiderwebs on a door | How old that commit is |
| The glow under the door | The worst severity behind it |
| The skeleton's costume | The finding's family: key-bearer, paper-bearer (personal data), locked chest (risky file), loose bones (unidentified string) |
| The skeleton's size | The danger score, 0–100 |
| Bony footprints between doors | One secret's lifetime, from the commit that introduced it to the commit that removed it |
| A skeleton standing in the hall | A secret **still in your current code** |
| An open window | The remote is public — the exposure is real |
| A wax seal | Remediated |
| A ribbon | Dismissed, with a written reason |

Two things fell out of that constraint that I did not plan.

**First, triage became spatial.** "Start at the attic, the red door on the left"
is a sentence you can act on. "Sort 214 findings by severity" is not. When a
judge — or a tired maintainer at 11 pm — opens the manor, the eye goes to the
glowing door immediately, and the footprints tell them whether this secret died
three years ago or is still walking around in `main`.

**Second, the costume forced honesty.** I could not add a bat, because a bat
would encode nothing. Every element had to earn its place by carrying data. That
is a stricter design review than any I have run on a "serious" dashboard.

## The part that actually saves you: the order

Here is the mistake I have made and watched colleagues make: find a leaked key,
panic, rewrite history with `git filter-repo`, feel clean.

The key was already cloned. Rewriting your history does not un-leak a credential.
**Rotation comes first, purge second.**

So in Placard, the purge step is *locked*. Not greyed out with a tooltip — locked,
with the reason printed next to it, until you tick "I revoked this key at the
provider" (or declare it not applicable, with a reason, which is the case for
personal data: there is nothing to rotate, and the tool says so without pretending
to give legal advice).

The tool then writes the purge script and its replacements file. Two details I
care about:

- the replacements file — the only place a secret value is ever written — goes
  **outside the repository**, with mode `0600`;
- Placard **never runs the script against your repository**. It hands you the
  commands and the warnings (commit ids will change, collaborators must re-clone,
  forks and host-side caches keep the old history until *they* purge it).

A tool that rewrites your history for you is a tool that will eventually destroy
something you loved.

## A scanner that leaks secrets is worse than no scanner

This one surprised me, because I got caught by my own rule.

Early in the build, an agent working on the project wrote a test fixture
containing a real-format AWS example key. GitHub push protection would have
flagged my own security tool's repository. The steering file says: **no
real-format secret is ever written into the repository — test values are
generated at runtime from a seed.** After that, 100 % of test values come from a
deterministic generator, and the repository is scanned by itself in CI, which
fails the build if a single finding is open.

The first time I ran that self-scan, it reported **378 findings on my own
repository**. Every one was a false positive, and every one taught me something:

- `react-dom@19.3.1` in a lockfile is not an email address (368 of the 378 —
  an npm specifier has the *shape* of `local@domain`);
- an `sha512-…` integrity hash is not a secret;
- `https://user:token@host` — the authority of a URL — is not a personal email;
- `0123456789` is not a phone number;
- `index 0000000..1111111 100644` in a diff fixture is not a payment card;
- `'plaintext-password': 'key-bearer'` in a translation table is not a
  password;
- and my favourite: `[REDACTED:plaintext-password]` — the tool's own masking
  marker — is not a password.

Fixing those took the count from 378 to **zero open findings**, with seven
regression tests and no loss of recall: all 12 values planted by the synthetic
repository generator are still found.

And the four findings that remain? They are historical, they are documented, and
they are dismissed **through the product's own exclusion file** — with a reason,
an author and a date. One of them is that AWS documentation example key, which
the tool still finds *in the history* even though it is gone from the code. Which
is, again, the entire point of the product.

## What I would tell you to do tonight

If you are about to make a private repository public, or hand one to a client:

1. Scan the **history**, not the working tree.
2. Triage before you act. Half of what you find is noise, and noise you cannot
   rank is noise you will ignore.
3. **Rotate before you purge.** Always.
4. Then purge, on a mirror clone, and re-scan to prove it.
5. Keep a dated record — a certificate, a badge, an exclusion file with reasons.
   "It's clean" is not evidence.

Placard is MIT-licensed, runs entirely on your machine, and the demo needs no
install: <https://baptistefaisy.github.io/placard/>. The manor you see there was
generated by the real engine, from a synthetic repository with a fixed seed — not
hand-written JSON.

*Built for Kiroween 2026 with Kiro: six specs, four steering files, four hooks,
one read-only reviewer agent whose only job was to reject decorations that
encoded no data. It rejected a bat.*
