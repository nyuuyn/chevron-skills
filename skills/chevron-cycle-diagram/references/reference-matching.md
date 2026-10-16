# Measuring a reference image instead of guessing

If the user has a reference image of the style they want, this is the
single highest-leverage step in the whole skill. Every geometry mistake in
`pitfalls.md` traces back to estimating proportions from how a screenshot
*looked* instead of measuring the actual numbers. A human eye is bad at
judging angles, arc widths, and radius ratios from a picture; a browser's
own geometry APIs are not.

## If the reference is a raster image (PNG/JPG/screenshot)

Less precise than a vector reference, but still far better than guessing:
view it at full resolution, pick a handful of landmark points (segment
corners, the kink vertices, the inner/outer edges at a few angles) by
eye/pixel-coordinates, and fit the same parameters (`outerR`, `innerR`,
`gapArc`, `kinkDeg`) to those landmarks. Cross-check the fit by rendering
your candidate shape and overlaying/comparing it side-by-side with the
original at the same scale - don't trust a single pass.

## If the reference is an SVG (by far the better case)

### 1. Get it rendering in a real browser

Don't try to hand-parse the path data from the raw file (especially if
it's a PowerPoint/Illustrator export - see the warning on embedded
shadow/text layers below). Render it and inspect it live via a browser
automation tool (e.g. `claude-in-chrome`'s `javascript_tool`, or a
Playwright script). If the SVG has no surrounding `<html>`, wrap it in a
minimal page:

```html
<!doctype html><html><body style="margin:0">
<img src="reference.svg" style="width:1280px;display:block">
</body></html>
```

(An `<img>` wrapper, not inlining the raw SVG into the page, avoids
accidentally exposing a huge embedded-text-as-paths DOM to tooling that
tries to read the whole page - PowerPoint exports especially can embed
every text glyph as its own `<path>`, which bloats the document
enormously without being geometrically relevant.)

### 2. Identify the real colored shape - watch for decorative duplicates

Reference SVGs exported from design tools often contain **more than one
copy of the same path data** - typically a blurred/blackened duplicate
used as a drop shadow, positioned at a slightly different `transform` than
the crisp, visible, colored version. If you naively grab "the first
`<path>` with this fill color" you may get the shadow copy instead of the
real one, and its geometry will look confusingly close-but-not-quite
right.

Check each candidate's `getCTM()` (current transform matrix) and the
ancestor chain for an SVG `<filter>` (especially one with
`feComponentTransfer` forcing R/G/B to 0, i.e. "turn this black," which is
the giveaway for a shadow layer). The real, crisp, interactive shape is
the one *not* wrapped in such a filter.

### 3. Sample the path's actual vertices

Once you have the right `<path>` element:

```js
const d = path.getAttribute('d');
const subpaths = d.split(/(?=M)/).filter(s => s.trim().length); // one per ring segment

// For precise vertex-level parsing of a CLEAN svg (plain M/L/A commands,
// no Bezier curves - common for programmatically-generated references):
// tokenize and read M/L endpoints and C's final control point directly.
// For a hand-authored/exported svg with real Bezier curves approximating
// the circle, sample along the rendered path instead:
const len = path.getTotalLength();
const samples = [];
for (let i = 0; i <= 200; i++) {
  samples.push(path.getPointAtLength(len * i / 200));
}
```

### 4. Find the center and convert to polar

Union the bounding boxes of all ring segments to estimate the circle's
center and outer radius, then convert every sampled point to
`(radius, angleDeg)` relative to that center (same convention as
`geometry.md`: 0°=top, clockwise):

```js
function toPolar(cx, cy, x, y) {
  const dx = x - cx, dy = y - cy;
  const r = Math.hypot(dx, dy);
  let angleDeg = (Math.atan2(dy, dx) * 180) / Math.PI + 90;
  return { r, angleDeg: ((angleDeg % 360) + 360) % 360 };
}
```

### 5. Read off the parameters from the polar data

- **`outerR`/`innerR`**: the two clusters of `r` values the samples settle
  into along the long, roughly-constant-radius stretches of each segment
  (the actual outer and inner arcs, not the kink region).
- **`gapArc`**: at the outer radius, find the angular gap between one
  segment's end and the next segment's start, then convert to arc length
  (`gapAngleRad * outerR`). Repeat at the inner radius - if both give
  close to the same arc-length number, that confirms the "constant arc
  length, not constant angle" model from `geometry.md`.
- **`kinkR`/`kinkDeg`**: look for the local maximum/minimum in the
  `angleDeg` sequence near each segment's start/end - that inflection
  point *is* the kink vertex. Its radius is `kinkR`; how far its angle
  diverges from the segment's nominal boundary angle is `kinkDeg`.

### 6. Cross-check with a second reference if possible

If the first reference is a complex export (Bezier curves, embedded
shadow duplicates, decorative folds), look for a second, cleaner one to
confirm the core numbers - e.g. ask the user if they have (or can
generate, via an AI image/diagram tool) a simpler version of the same
diagram style. A plain, programmatically-generated SVG with `M`/`L`/`A`
path commands and no Bezier noise is far easier to get exact numbers from
than a hand-drawn or exported one, and serves as a sanity check against
it.
