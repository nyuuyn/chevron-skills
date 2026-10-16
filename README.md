# chevron-skills

A Claude Code skill for drawing circular chevron/cycle diagrams as inline
SVG — process wheels, PDCA/DMAIC-style cycles, maturity models, or any "N
phases in a loop" diagram with arrow-shaped (chevron) ring segments.

Distilled from building exactly this diagram for a real project: several
wrong turns (a self-intersecting path bug, a per-label auto-fit that was
geometrically correct but looked wrong, screenshots that over- and
under-stated real overflow) are documented as pitfalls, not just smoothed
over — see [`skills/chevron-cycle-diagram/references/pitfalls.md`](skills/chevron-cycle-diagram/references/pitfalls.md).

## What's here

```
skills/chevron-cycle-diagram/
  SKILL.md                          entry point: when/how to use this skill
  references/
    geometry.md                     the math - gap/kink/centroid/rotation formulas
    reference-matching.md           how to measure a reference image/SVG instead of guessing
    pitfalls.md                     bugs hit along the way, and how they were caught
  scripts/
    chevron-wheel.js                framework-agnostic reference implementation (copy + adapt)
```

## Install

As a Claude Code plugin, from this repo:

```
/plugin marketplace add <path-or-url-to-this-repo>
/plugin install chevron-skills
```

Or, for a single project without installing a plugin, copy
`skills/chevron-cycle-diagram/` into that project's `.claude/skills/`
directory directly.

> The `source.repo` field in `.claude-plugin/marketplace.json` is a
> placeholder (`nyuuyn/chevron-skills`) — update it to wherever this repo
> actually ends up living before publishing/sharing it.

## Validated

`scripts/chevron-wheel.js` was exercised end-to-end (generated a 6-segment
wheel, rendered it, visually confirmed clean kinked corners and no
self-intersection artifacts) before being written up — it's not just a
transcription of the original project's code, it was re-run standalone to
confirm the generalized version still produces correct output.
