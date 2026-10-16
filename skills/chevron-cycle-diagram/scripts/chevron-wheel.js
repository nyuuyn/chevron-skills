/**
 * Chevron cycle diagram geometry - framework-agnostic reference
 * implementation. Plain functions returning numbers/path strings; no
 * React/Preact/Vue/DOM dependency except the optional `labelFits` helper
 * at the bottom, which needs a real browser (SVGGeometryElement APIs).
 *
 * This is meant to be COPIED into the target project and adapted to its
 * naming/style conventions - not imported as a black-box dependency. The
 * geometry is easy to get subtly wrong by hand-rolling it fresh each time
 * (see references/pitfalls.md); start from working code instead.
 *
 * See references/geometry.md for the derivation and reasoning behind each
 * piece of this.
 *
 * ESM export at the bottom; for a plain <script> include, delete the
 * `export` keywords and everything attaches to the enclosing scope, or
 * wrap in an IIFE assigning to `window.ChevronWheel`.
 */

// angleDeg: 0 = top (12 o'clock), increasing clockwise.
function polar(cx, cy, r, angleDeg) {
  const a = ((angleDeg - 90) * Math.PI) / 180;
  return [cx + r * Math.cos(a), cy + r * Math.sin(a)];
}

// Half-angle (degrees) a radius-r edge must be inset by for the FULL gap
// between two segments to measure `gapArc` SVG units wide along that
// radius's own circle - NOT a fixed angle, which would look narrower at
// the inner radius than the outer radius. See geometry.md § "Why the gap
// must be a constant arc length."
function gapInsetDeg(gapArc, r) {
  return (gapArc / r) * (90 / Math.PI);
}

/**
 * The `d` attribute for one ring segment spanning [lo, hi] degrees.
 * Each of outer/inner/kink corners is inset by its own radius-appropriate
 * gap (see gapInsetDeg), and each corner is a 2-segment "kink" - inner
 * corner to a point bulged `kinkDeg` further around the ring at
 * mid-band radius, to the outer corner - applied identically (same
 * radius, same kinkDeg, same rotational direction) on BOTH ends of the
 * segment. See geometry.md § "Why each corner is a 2-segment kink."
 *
 * @param {number} cx center x
 * @param {number} cy center y
 * @param {number} outerR outer radius
 * @param {number} innerR inner radius (the hole)
 * @param {number} kinkR radius of the corner kink vertex, typically (outerR+innerR)/2
 * @param {number} kinkDeg how far the kink bulges past the nominal boundary angle
 * @param {number} gapArc gap between segments, in SVG units of arc length (not degrees)
 * @param {number} lo segment start angle, degrees
 * @param {number} hi segment end angle, degrees
 * @returns {string} SVG path `d` attribute
 */
export function segmentPath(cx, cy, outerR, innerR, kinkR, kinkDeg, gapArc, lo, hi) {
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

/**
 * The segment's true visual centroid - NOT the naive (lo+hi)/2 angle at
 * mid-radius, which the kink makes asymmetric (see geometry.md § "Label
 * centroid"). Approximates the outer/inner arcs with `arcSteps` straight
 * segments so the shoelace formula (which needs a polygon) can be applied
 * to the full kinked boundary.
 *
 * @returns {[number, number]} [x, y]
 */
export function segmentCentroid(cx, cy, outerR, innerR, kinkR, kinkDeg, gapArc, lo, hi, arcSteps = 8) {
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

/**
 * Convenience: build all N segments' path + label-anchor data at once,
 * evenly spaced, with an optional rotation so a specific segment lands at
 * a specific clock position (see geometry.md § Rotation). Does not touch
 * color/label text/interactivity - wire those up in your own component
 * using the returned `path`/`labelX`/`labelY` per segment.
 *
 * @param {object} opts
 * @param {number} opts.count number of segments (N)
 * @param {number} [opts.centerFirstAt=0] angle (degrees, 0=top) to center the FIRST segment at;
 *   default 0 leaves segments starting at 0 rather than centered there -
 *   pass 0 explicitly only if you want that; to center segment 0 at the
 *   top, this function already applies the -step/2 rotation for you.
 * @returns {{lo:number, hi:number, path:string, labelX:number, labelY:number}[]}
 */
export function buildChevronWheel({
  count,
  cx,
  cy,
  outerR,
  innerR,
  kinkR = (outerR + innerR) / 2,
  kinkDeg = 11,
  gapArc = 7,
  centerFirstAt = 0,
}) {
  const step = 360 / count;
  const rotation = centerFirstAt - step / 2;
  const segments = [];
  for (let i = 0; i < count; i++) {
    const lo = i * step + rotation;
    const hi = (i + 1) * step + rotation;
    const [labelX, labelY] = segmentCentroid(cx, cy, outerR, innerR, kinkR, kinkDeg, gapArc, lo, hi);
    segments.push({
      lo,
      hi,
      path: segmentPath(cx, cy, outerR, innerR, kinkR, kinkDeg, gapArc, lo, hi),
      labelX,
      labelY,
    });
  }
  return segments;
}

/**
 * Browser-only: does a rendered <text> label fit inside its segment's
 * <path> with real clearance? Tests the label's ACTUAL rendered bbox
 * (getBBox - accounts for real font metrics, not a guessed
 * x +/- textLength/2), with `paddingUnits` of REQUIRED clearance -
 * tested OUTWARD from the glyph edges, not inward (an inward margin looks
 * like a safety margin but is actually a laxer check that lets
 * borderline-overflowing text pass - see references/pitfalls.md).
 *
 * @param {SVGTextElement} textEl
 * @param {SVGPathElement} pathEl the label's own segment path
 * @param {number} [paddingUnits=3]
 * @returns {boolean}
 */
export function labelFits(textEl, pathEl, paddingUnits = 3) {
  if (typeof pathEl.isPointInFill !== "function") return true; // unsupported - don't block on it
  const box = textEl.getBBox();
  const xs = [box.x - paddingUnits, box.x + box.width / 2, box.x + box.width + paddingUnits];
  const ys = [box.y - paddingUnits, box.y + box.height / 2, box.y + box.height + paddingUnits];
  try {
    return xs.every((x) => ys.every((y) => pathEl.isPointInFill(new DOMPoint(x, y))));
  } catch {
    return true;
  }
}
