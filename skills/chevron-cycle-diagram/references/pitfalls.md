# Pitfalls (and how they were actually caught)

Concrete bugs hit while building this kind of diagram, kept here instead
of just stating the fixed rule in `geometry.md` - knowing *why* a mistake
is tempting makes it easier to recognize when you're about to repeat it.

## The self-intersecting "bowtie" notch

**The mistake:** building a tapered-point-and-notch corner (see
`geometry.md`'s rejected approach #2) by visiting the "pinch" vertex
*twice* in one path - once coming from the outer-corner side, once from
the inner-corner side - intending it to read as a clean V-shaped cut into
the segment.

**What actually happened:** the SVG path self-intersected into a bowtie
shape. Instead of cutting a notch *out* of the fill, the notch area
rendered as a **separate filled triangle**, attached to the rest of the
shape only at that one shared vertex - visually indistinguishable from
"someone added a stray triangle in the gap" rather than "a notch was cut."

**The fix:** a vertex that's meant to be a single pinch point in the
boundary must be visited **exactly once** in the path - as the point where
the boundary's outer-side approach and inner-side approach connect
*directly* to each other, not as two separate visits that happen to land
on the same coordinates. (This is part of why `geometry.md`'s accepted
kink construction routes through the kink point as a single step between
the inner/outer corner on each side, never twice.)

**How it was caught:** by zooming into a screenshot of the rendered shape
and recognizing the triangle didn't look like a "cut," it looked like an
"addition" - worth a closer look, not something a geometric check would
have flagged automatically (the fill *was* geometrically well-defined,
just not what was intended).

## Per-label auto-fit passed every check and still looked wrong

**The approach:** for a label too wide for its segment ("Optimization"
overflowing a wedge that "Execution," a similar-length word, fit fine in
the mirror-image segment), compress only the overflowing label via SVG
`textLength`/`lengthAdjust`, binary-searching for the widest size that
still passes an `isPointInFill` containment check (see `geometry.md`'s
`labelFits`).

**What actually happened:** it worked exactly as designed - the
overflowing label shrank just enough to fit with clearance, verified
geometrically. The user's reaction: *"optimization looks now skewed, I
rather have a global font change."* The per-label compression was
correct by the containment check, and still read as wrong, because a
human eye compares a word against its *neighbors* (same ring, same font,
presumably same size) - one visibly narrower/denser word stands out as an
inconsistency, independent of whether it individually "fits."

**The fix:** a single, global font-size reduction applied to every label,
sized so the single longest label fits with clearance (verified the same
way, via `isPointInFill` + `getBBox`) - every label ends up the same size,
some with a bit more spare room than others, which reads as consistent.

**The lesson:** a geometric correctness check (does it fit?) and a
readability/consistency judgment (does it look right next to its
neighbors?) are different questions. Build the fit check - it's how you
*know* a problem exists and *verify* a fix - but don't assume passing it
settles the aesthetic question. Ask, or show a screenshot, before
assuming a geometrically-valid per-element fix is the right call over a
simpler global one.

## A borderline overflow looked dramatic in one screenshot, and fine in isolation-tested points

**What happened:** a zoomed screenshot of one label appeared to show a
large overflow - a letter clearly spilling into the background. A direct
`isPointInFill` check at five points along that label's horizontal
midline all came back "inside the fill." The two observations seemed to
contradict each other.

**The resolution:** the check was *testing the wrong thing*, not wrong
about the geometry. It tested points pulled *inward* from the label's
edges by a margin (meant as "safety margin," but actually a laxer test -
see `geometry.md`'s note on `paddingUnits`), and it only tested a single
horizontal line (the vertical center), not the full height of the
rendered glyphs. Re-testing against the label's *actual* `getBBox()`
extents, at multiple vertical positions, with the padding applied
*outward* instead of inward, found the real (much smaller, but real)
overflow: a few CSS pixels past the boundary, not "half a letter."

**The lesson:** when a geometric check and a visual impression disagree,
distrust both until you've tightened the check - don't just believe
whichever one is more convenient, and don't assume the screenshot is
automatically right either (zoomed screenshots, especially with blur
filters like a drop-shadow nearby, can make a small overflow look larger
than it is, or a real one easy to miss). Cross-checking with
`document.elementFromPoint()` (what's actually composited at a screen
pixel) against `isPointInFill()` (pure path geometry) is a good way to
resolve a disagreement - they should agree away from anti-aliased edges,
and if they don't, that's informative about *why* the check and the
screenshot disagreed.

## Guessing proportions from a screenshot instead of measuring

**What happened, repeatedly, before the reference-matching workflow was
nailed down:** looking at a reference chevron diagram and estimating "the
band looks maybe half the radius thick" or "there's a small gap, call it
a few degrees" - then building something that was structurally wrong
(e.g., concluding the reference had *no* corner shaping at all, when it
actually had the kink construction just at a scale/angle that wasn't
obvious at a glance) and needing another full round-trip once the
estimate turned out to be off.

**The fix:** `reference-matching.md`'s whole workflow - render the
reference in a real browser, sample its actual path coordinates, convert
to polar, read the parameters off the numbers. Every one of the numeric
defaults in `geometry.md` (band ratio, gap arc length, kink degree) came
from this process on two different real references, not from eyeballing
either one.
