---
name: chevron-cycle-diagram
version: 1.0.0
description: |
  Use this skill to draw a circular chevron/cycle diagram as inline SVG: N
  arrow-shaped segments arranged in a ring around a center label, each
  segment a distinct color, used for process wheels, PDCA/DMAIC-style
  cycles, maturity models, or any "N phases in a loop" diagram.

  Use for: building the SVG path geometry for the ring segments (gap, corner
  shape, band thickness), positioning and sizing segment labels so they fit
  inside their wedge, rotating the ring so a given segment sits at a chosen
  position (e.g. 12 o'clock), and reverse-measuring a reference image/SVG
  the user provides instead of guessing proportions.

  Do not use for: non-circular process diagrams (flowcharts, swimlanes - use
  general diagramming skills), charts/graphs of data (use a dataviz skill),
  or one-off arrow glyphs that aren't part of a ring.

  **Workflow skill** - read this file, then references/geometry.md for the
  exact math and scripts/chevron-wheel.js for ready-to-use code.
---

# Chevron Cycle Diagram

Draws a ring of N arrow-shaped ("chevron") segments as inline SVG - the
kind of diagram used for PDCA cycles, BPM lifecycle wheels, maturity
models, or any circular "phase 1 → phase 2 → ... → back to phase 1" process.

This skill exists because the shape looks simple but almost every
intuitive way of building it is subtly wrong: a plain pie-chart donut reads
as "categories," not "process" or "flow" or "cycle" - the chevron notches
are what make it read as directional. Getting those notches right (and the
gap between segments, and label placement) took several wrong turns worth
skipping. The core lesson, repeated throughout this skill: **when the user
gives you a reference image, measure it - don't eyeball proportions from a
screenshot.**

## Step 1 — Is there a reference image/SVG?

Ask, if not already given: *"Do you have a reference image of the diagram
style you want? If so, share the file (SVG is ideal; a screenshot/PNG also
works but is less precise)."*

**If yes:** follow [references/reference-matching.md](references/reference-matching.md)
to measure it precisely (render it, sample path coordinates via browser
DOM APIs, derive the actual gap/kink/band-ratio numbers) rather than
estimating from how it looks. This is the single highest-leverage step in
this whole skill - every geometry bug documented in
[references/pitfalls.md](references/pitfalls.md) came from skipping it and
guessing instead.

**If no:** use the defaults in [references/geometry.md](references/geometry.md)
(band ratio ~0.55–0.6, gap ~3–9 SVG units of arc length, corner kink
~10–12°) - these come from reverse-measuring the kind of chevron cycle
diagrams that show up as PowerPoint SmartArt exports and AI-generated
references, so they're a reasonable starting point, not a guess.

## Step 2 — Build the ring geometry

Use [scripts/chevron-wheel.js](scripts/chevron-wheel.js) - a small,
framework-agnostic module (plain functions, no React/Preact/Vue
dependency) that generates the SVG `<path>` `d` string for one ring
segment, given the measured or default parameters. Copy it into the
target project and adapt the parameter names/style to match that
project's conventions; don't just inline a one-off reimplementation,
the geometry is easy to get subtly wrong by hand (see pitfalls.md).

The three things that actually make it read as "chevron ring" rather than
"pie chart," each detailed in [references/geometry.md](references/geometry.md):

1. **The gap between segments is a constant arc LENGTH, not a constant
   angle.** A fixed angular gap looks like it narrows toward the center,
   because arc length shrinks with radius. Each radius (inner edge, outer
   edge, corner kink) needs its own angular inset computed from the same
   target width.
2. **Each segment's two ends are a 2-segment "kink," not a straight radial
   cut or a tapered point.** From the inner corner to the outer corner, the
   edge bulges outward at mid-radius by a fixed angle, in the *same*
   rotational direction on both ends of every segment (not mirrored).
   This is the actual source of the "arrow" look - not a pointed tip.
3. **Label anchors go at each segment's true polygon centroid**, not the
   naive mid-angle/mid-radius point - the kink makes the shape asymmetric
   around that naive point, so a label placed there reads visibly
   off-center. `scripts/chevron-wheel.js` includes a centroid helper
   (shoelace formula over arc-sampled boundary points).

## Step 3 — Fit the labels

Render at a single, uniform font-size across all segment labels, sized so
the *longest* label fits every segment with real clearance - not per-label
auto-fit. Per-label fitting (e.g. SVG `textLength`/`lengthAdjust` to
compress only the labels that overflow) was tried and discarded: it can
pass every geometric containment check and still look wrong to a human,
because the one compressed label reads as skewed/inconsistent next to its
neighbors at full width. See
[references/pitfalls.md](references/pitfalls.md) for how this was
diagnosed and reverted.

To find the right uniform size: measure the longest label's rendered
width (or char count as a rough proxy) against the *narrowest* segment's
available width at the label radius, verified geometrically (see
"Verifying a label actually fits" in
[references/geometry.md](references/geometry.md)) - don't just eyeball a
screenshot at one zoom level, borderline overflow is easy to miss or
overstate by eye (documented case in pitfalls.md where a screenshot read
as a severe overlap but the real glyph edge was ~1-2px over the boundary).

## Step 4 — Rotation and polish

- To put a specific segment at a specific position (commonly: the first
  phase at 12 o'clock), add a single rotation offset to every segment's
  angle rather than special-casing one segment - see
  `references/geometry.md` § Rotation.
- A soft drop shadow (SVG `feDropShadow`, ~1-2px offset, ~1-2px blur, ~40%
  black) reads as "distinct pieces of a ring" rather than "a flat painted
  circle" - cheap, worth adding by default.
- White label text with a small `text-shadow` is more robust across a
  varied segment color palette than per-segment contrast-computed text
  color (simpler, and avoids a label going illegible against the one
  Mid-tone segment color a contrast formula got wrong).

## Step 5 — Verify, don't just look

A zoomed screenshot is a *starting point* for spotting problems, not proof
of a fix. Browsers expose real geometric and rendering APIs - use them to
confirm a claim before reporting it done:

- `path.isPointInFill(point)` - true geometric containment against a
  `<path>`'s actual fill, independent of how it looks on screen.
- `element.getBBox()` - real rendered extents (accounts for font metrics
  that hand-computed `x ± textLength/2` math gets wrong).
- `document.elementFromPoint(x, y)` - what's actually composited at a
  screen pixel; cross-check against `isPointInFill` when they might
  disagree (e.g. near an edge, under a blur filter).

Full recipes and the self-intersecting-path bug these checks would have
caught immediately: [references/pitfalls.md](references/pitfalls.md).
