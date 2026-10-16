# Chevron ring geometry

The full math behind `scripts/chevron-wheel.js`. Read this when adapting
the script, debugging a shape that doesn't look right, or explaining *why*
a parameter is the way it is.

All angles use the convention **0° = top (12 o'clock), increasing
clockwise** - this matches how people describe clock positions and reads
naturally when reasoning about "first segment at the top," "gap between
segment 3 and 4," etc. Polar-to-Cartesian conversion:

```js
function polar(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}
```

(The `-90` rotates the standard math convention, 0°=right/3-o'clock, to
0°=top/12-o'clock.)

## Parameters

| Name | Meaning | Reasonable default if no reference |
|---|---|---|
| `outerR` | outer radius of the ring | pick to fit your canvas, e.g. 166 in a 360×360 viewBox |
| `innerR` | inner radius (the hole) | `outerR * 0.55–0.6` - a thick band reads as "ring," a thin one reads as "donut chart outline" |
| `gapArc` | gap between segments, in SVG units of **arc length** (not degrees) | `~5–9` units at `outerR` scale |
| `kinkR` | radius of the corner "kink" vertex | `(outerR + innerR) / 2` - mid-band |
| `kinkDeg` | how far the kink bulges, in degrees | `10–12` |

If you measured a reference (see `reference-matching.md`), use the
measured numbers instead of these defaults - they came from a real
PowerPoint-exported chevron diagram and a clean generator-produced one,
not a universal constant.

## Why the gap must be a constant arc length, not a constant angle

Arc length at radius `r` for an angle `θ` (radians) is `r·θ`. If you inset
every segment's boundary by the same fixed *angle* on both sides, the gap
looks `innerR/outerR` as wide at the inner edge as it does at the outer
edge - visibly narrowing toward the center, like the segments are
converging rather than running in parallel bands.

Fix: pick a target arc length (`gapArc`), then compute the angular inset
*per radius*:

```js
// Half-angle (degrees) a radius-r edge must be inset by for the full gap
// to measure `gapArc` units wide along that radius's own circle.
function gapInsetDeg(gapArc, r) {
  return (gapArc / r) * (90 / Math.PI); // = (gapArc/r in radians) / 2, in degrees
}
```

Apply this separately at `innerR`, `outerR`, and `kinkR` - three different
insets for the same nominal boundary angle, one per radius. The result:
the gap measures the same visual width all the way from the inner edge,
through the kink, to the outer edge.

## Why each corner is a 2-segment "kink," not a tapered point or a straight cut

Three things were tried and rejected before landing on this, in order:

1. **Plain straight radial cut** (each segment literally a pie slice,
   trimmed by the gap). Technically correct, reads as "pie chart," not
   "chevron" - there's no visual cue of directionality/flow.
2. **A pointed taper to a single vertex** at one end, mirrored into a
   notch at the other (point-and-socket, like actual arrowheads nested
   into each other). Looks like a real chevron arrow up close, but doesn't
   match how reference chevron-cycle graphics (PowerPoint SmartArt, and
   AI-generated ones) are actually built - and is fiddly to get an actual
   non-self-intersecting notch shape right (see pitfalls.md's bowtie bug).
3. **The kink** (what reference graphics actually do): from the inner
   corner, go to a point at `kinkR`, offset `kinkDeg` further around the
   ring than the segment's nominal boundary angle, *then* to the outer
   corner. Apply the exact same construction - same radius, same
   `kinkDeg`, same rotational direction - at **both** ends of **every**
   segment.

Because every segment uses the identical construction, two adjacent
segments' facing edges are parallel copies offset by the gap, at every
radius along the cut, including through the kink. That means `kinkDeg` can
be *larger* than the gap without the kink visually crossing into the next
segment - there's no risk of collision to budget for, which is easy to
assume incorrectly by analogy with "the bulge needs room inside the gap."

```js
function segmentPath(cx, cy, outerR, innerR, kinkR, kinkDeg, gapArc, lo, hi) {
  const innerGap = gapInsetDeg(gapArc, innerR);
  const pointGap = gapInsetDeg(gapArc, kinkR);
  const outerGap = gapInsetDeg(gapArc, outerR);

  const [ix1, iy1] = polar(cx, cy, innerR, lo + innerGap);
  const [kx1, ky1] = polar(cx, cy, kinkR, lo + pointGap + kinkDeg);
  const [ox1, oy1] = polar(cx, cy, outerR, lo + outerGap);
  const [ox2, oy2] = polar(cx, cy, outerR, hi - outerGap);
  const [kx2, ky2] = polar(cx, cy, kinkR, hi - pointGap + kinkDeg);
  const [ix2, iy2] = polar(cx, cy, innerR, hi - innerGap);

  return (
    `M${ix1},${iy1} L${kx1},${ky1} L${ox1},${oy1} ` +
    `A${outerR},${outerR} 0 0 1 ${ox2},${oy2} ` +
    `L${kx2},${ky2} L${ix2},${iy2} ` +
    `A${innerR},${innerR} 0 0 0 ${ix1},${iy1} Z`
  );
}
```

Each of the 6 points (`ix1`, `kx1`, `ox1`, `ox2`, `kx2`, `ix2`) is visited
**exactly once** - see pitfalls.md for what goes wrong if a vertex gets
visited twice while trying to build a "mirrored notch."

## Label centroid

A segment's label should sit at its shape's true visual center, not the
nominal `(lo+hi)/2` angle at mid-radius - the kink makes the polygon
asymmetric around that naive point (it bulges outward past `hi` on one
side, cuts inward past `lo` on the other, both in the same rotational
direction), so a label placed at the naive midpoint reads visibly
off-center.

Approximate the outer/inner arcs with a handful of straight segments
(`ARC_STEPS`, 6-10 is plenty) to turn the boundary into a polygon, then
apply the shoelace centroid formula:

```js
function segmentCentroid(cx, cy, outerR, innerR, kinkR, kinkDeg, gapArc, lo, hi, arcSteps = 8) {
  const innerGap = gapInsetDeg(gapArc, innerR);
  const pointGap = gapInsetDeg(gapArc, kinkR);
  const outerGap = gapInsetDeg(gapArc, outerR);
  const aInner0 = lo + innerGap, aInner1 = hi - innerGap;
  const aOuter0 = lo + outerGap, aOuter1 = hi - outerGap;

  const pts = [
    polar(cx, cy, innerR, aInner0),
    polar(cx, cy, kinkR, lo + pointGap + kinkDeg),
    polar(cx, cy, outerR, aOuter0),
  ];
  for (let i = 1; i <= arcSteps; i++) {
    pts.push(polar(cx, cy, outerR, aOuter0 + (aOuter1 - aOuter0) * (i / arcSteps)));
  }
  pts.push(polar(cx, cy, kinkR, hi - pointGap + kinkDeg));
  pts.push(polar(cx, cy, innerR, aInner1));
  for (let i = 1; i <= arcSteps; i++) {
    pts.push(polar(cx, cy, innerR, aInner1 - (aInner1 - aInner0) * (i / arcSteps)));
  }

  let area = 0, cxAcc = 0, cyAcc = 0;
  for (let i = 0; i < pts.length; i++) {
    const [x0, y0] = pts[i];
    const [x1, y1] = pts[(i + 1) % pts.length];
    const cross = x0 * y1 - x1 * y0;
    area += cross;
    cxAcc += (x0 + x1) * cross;
    cyAcc += (y0 + y1) * cross;
  }
  area /= 2;
  return [cxAcc / (6 * area), cyAcc / (6 * area)];
}
```

## Rotation

To put a specific segment at a specific clock position (most commonly:
the first segment centered at 12 o'clock, i.e. angle 0), add a single
rotation offset to every segment's `lo`/`hi`, rather than special-casing
one segment's geometry. For `n` evenly-sized segments of `step = 360/n`
degrees each, the first segment's own center sits at `step/2` by default
(it *starts* at angle 0, not centered there) - so centering it needs a
rotation of `-step/2`:

```js
const step = 360 / n;
const rotation = -step / 2;
// then for segment i: lo = i*step + rotation, hi = (i+1)*step + rotation
```

For a different target segment or a different clock position, adjust the
offset accordingly - the principle is "one global rotation constant,
applied uniformly," not per-segment angle hacks.

## Verifying a label actually fits

Don't eyeball a screenshot - borderline cases are easy to misjudge in
either direction (see the pitfalls.md case where a real ~1-2px overflow
read, at one zoom level, as a dramatic half-letter overhang). Use
`isPointInFill` against the segment's own `<path>`:

```js
function labelFits(textEl, pathEl, paddingUnits = 3) {
  const box = textEl.getBBox(); // REAL rendered extents, not guessed x +/- textLength/2
  const xs = [box.x - paddingUnits, box.x + box.width / 2, box.x + box.width + paddingUnits];
  const ys = [box.y - paddingUnits, box.y + box.height / 2, box.y + box.height + paddingUnits];
  return xs.every((x) => ys.every((y) => pathEl.isPointInFill(new DOMPoint(x, y))));
}
```

The `paddingUnits` term matters: test points *outside* the glyph's actual
edges by a small margin, requiring real clearance. Testing points pulled
*inward* from the edges (an easy mistake - it looks like "a safety
margin" but is actually a laxer check) lets a label that's flush against,
or just barely over, the boundary pass as "fits."
