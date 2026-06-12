# Tabota Roll — Chart Model Contract

*Supersedes `tabota_region_model.md`. That document's mechanics (conservation,
recoordinate, the merge prompt, snap-as-order, offset) survive almost intact; what
changes is the **frame** they sit in. Read §11 for the precise diff — the region
seam already built is a clean subset of this model, not a contradiction of it.*

This is the specification the Roll's region/chart work implements against. As before,
it is the authoring-side counterpart to `tabota-resolve.js`: the Roll edits a score
of charts and notes, and on save those serialize to v2 such that `resolve()` reads
them back unchanged. Lock this before building per-region looks, tabs, and the
tempo track; the [invariant checklist](#invariant-checklist) is the correctness target.

---

## 0. The reframe (where the system actually landed)

Following the model to its end — extend a lens backward, make a lens identical to the
main extended both ways, stack intersecting lenses in one chronal main — collapses the
last thing pretending to be a container:

> **The score is one event with one real clock — seconds from the datum `z`. Every
> coordinate system, "main" or "lens", metric or chronal or pitch, is a chart over
> that clock.**

This is the atlas: the clock is the manifold (the physical truth, where things
*sound*); charts are maps from local coordinates (beats, bars, note names) onto it.
A "region" was always just a chart the UI treated as a container. There is no
ontological "main frame" — only charts, and editorial choices about how to read and
encode them.

---

## 1. The conservation law (unchanged, still the spine)

> **Every operation conserves seconds and only rewrites labels.**

Seconds-from-`z` are physical truth; all coordinates are charts over them. Merge,
offset, swap-of-reading-chart, cross-boundary drag, re-hang — none may move where a
note *sounds*; they may only change what a moment is *called* or *read through*. A
note moves in time only when the user moves it (or its chart). Everything below is a
consequence of this.

---

## 2. Data shape

```
Score {                 // the one event; owns the clock
  charts[]              // every coordinate system (was: regions + their lenses)
  readingDefault        // id of the chart whose bars label the timeline by default (§6)
  notes[]
}

Chart {                 // a coordinate map over the clock; main and lens are the same kind
  id                    // stable, opaque
  span                  // its extent over the clock: [startSec, endSec], or open (±∞)
  temporal              // "metered" {bpm|ramp, cycla, offset} | "chronological" {units, offset}
  axis                  // optional pitch side: tuning / scala  (a chart may govern time, pitch, or both)
  role                  // "main" (editorial: tiles + reads length, §6) | "lens" (overlay)
}

Note {
  id
  chart                 // HOME chart — where the note was drawn / belongs (positional default)
  pts[]                 // a bag of points; cross-chart-ness lives here, not in a note type
  voice
}

Point {
  t (or beat), hz       // position + pitch
  // the attribute family — extensible; hangsOn is one member, not special plumbing:
  hangsOn               // chart id this point is READ in; null ⇒ the note's home chart
  velocity, breath, …   // (future) the same family
  curve                 // (segment shape, existing)
}
```

The model-defining decisions:

* **`hangsOn` is a per-POINT attribute**, in the same family as velocity / breath. This
  is what makes a cross-chart note ("starts on the main grid, ends pinned to a lens")
  just *a note whose points name different charts* — exactly as a glide is a note whose
  points have different Hz. No hybrid-note type is ever introduced.
* **`hangsOn` defaults to `null`, meaning "the note's home chart."** The common note —
  all points on home — stores no `hangsOn` at all and reads exactly as today. The
  attribute is present but collapsed, the same discipline that kept the seam cheap.
* **A pitch chart and a tempo chart are one kind of object** — a `Chart` governing an
  axis over a span. "See Pythagorean across B and C," draggable and defined across
  spans, is a pitch chart spanning those seconds; a polytempo lens is a temporal chart
  spanning some seconds. Same shape, same machinery.

---

## 3. Two verbs: snapping ≠ hanging

The keystone that keeps the atlas friendly:

* **Snapping** is a *visual aid*. The active snap chart — which may be a lens extended
  into this span from a neighbor — supplies grid points to land on. Snapping to a lens
  does **not** change what a point belongs to.
* **Hanging** is a point's *coordinate allegiance* — which chart it is read in. A drawn
  point hangs on its note's **home** chart by default (positional). It is re-hung onto
  another chart only by an **explicit command** ("hang this point on chart X").

So a note can be aimed using a borrowed ruler yet belong where it was drawn. The
atlas's scary property — a second sits under many charts — never has to be *guessed*:
a point's chart is either the positional default or an explicit name, never ambiguous.

---

## 4. Home, default, and explicit re-hang

- A note's **home chart** is set on creation: the chart that defines the extent where
  it was drawn (positional attachment).
- A point's **effective chart** = `point.hangsOn ?? note.chart`.
- **Re-hang** sets `point.hangsOn = X` for one or more selected points (the per-point
  attribute editor — same surface as setting velocity). Re-hanging conserves seconds:
  the point keeps sounding at the same moment; only the coordinates it is *read in*
  change, so its displayed beat/bar jumps (the jump is the honesty — §8's cross-boundary
  rule, applied deliberately).
- Re-hang is what lets a point attach to a lens extended from an adjacent span; such a
  point is then **defined in terms of that neighbor's chart**, which is the granular
  polytempo/polymeter capability, reached without a new mechanism.

---

## 5. Charts: span, extension, intersection

- A chart has a **span** over the clock and may be **open** (±∞).
- Charts may **extend** beyond where they "read length" and may **intersect** — this is
  legal and consequential to nothing, because the clock underneath is indifferent. A
  point read in a chart uses that chart's coordinates at the point's second.
- A new lens initialized over a main is, by default, **measure-synchronized**: its bars
  align with the main's at the span start and it follows the main's tempo deformations.
  The composer may **decouple** (let the lens's rate diverge) and **re-pin** (assert
  that lens-bar *m* and main-bar *n* coincide at a second) — "resewing seams." A pin is
  a cross-chart constraint evaluated against the clock; decoupling lets rates diverge
  between pins. *(Decouple/pin is a deferred authoring surface — §12 — but the model
  must allow a lens's rate to differ from its main's.)*

---

## 6. "Main" / extent-defining is editorial, not structural

The score's only true extent is its seconds. The **`main` role** does exactly two
*human* things, and nothing physical:

1. **Reading length.** A main chart is one the user reads the score's duration through —
   *see these 30 seconds as 15 bars of 4/4*. Switching a main between metric and
   chronological is for human convenience; the clock is unchanged (the computer sees
   only seconds).
2. **Encoding intent.** Which charts are `main` records *how the composer wants the
   piece sectioned and notated*. The orderly composer (Metered-A, Chronal-B, Metered-C)
   and the granular composer (one chronal main + meter lenses) can produce the *same
   sounding score*; they differ only in which charts they named `main`. That difference
   is real and worth preserving — it is the composer's encoding — but it is editorial.

A computational system needs a clock to be tractable; the `main`/extent-defining chart
is the UI making that global clock **legible and consequential** to the composer. That
is its whole job.

---

## 7. Tiling is the default MODE, not a law

The region-model contract made "main charts tile time with no gaps" a *law* so that
"which chart owns this second?" always had one answer. The atlas removes that as a law
and keeps it as the **friendly default mode**:

- **Tiled default mode** (today's behavior, now a mode): main charts tile the clock, no
  gaps/overlap, ends open; a drawn note's home is the covering main chart (positional);
  one active chart reads/snaps at a time. The seam already built *is* this mode. **#10
  parity holds here.**
- **Granular mode** (the deferred power): charts may intersect and extend; notes still
  attach positionally to their home by default, but points may be explicitly re-hung
  (§4), shown by color (§10).

The same data model serves both. The UI chooses which conveniences to offer; nothing
in the model forbids intersection.

---

## 8. Recoordinate, merge, cross-boundary (carried over)

The region-model engine survives; "region" now reads "main chart":

- **`recoordinate(span, claimingChart)`**: every note whose seconds fall in `span`
  keeps its seconds, has its *home-hung* points relabeled into `claimingChart`, and its
  home set to `claimingChart`. **Points with an explicit `hangsOn` keep their chart** —
  they are not recoordinated (their allegiance was named, not positional).
- **Merge / insert / drag-cannibalize** are gestures over `recoordinate`. Merge keeps
  the non-survivor system as a **lens** (lossless); one chart is flagged the survivor
  `main`.
- **Merge prompt** (metric survivor only): *keep negative coordinates* (default — never
  fractionalizes the survivor's own beats) vs *renumber from the survivor's last whole
  bar* (snapped to its grid, never the raw merged start).
- **Cross-boundary drag** recoordinates a positionally-hung note into the new chart
  (its bar/beat jumps, seconds unchanged); an explicitly-hung point dragged across keeps
  its named chart.

---

## 9. Offset (carried over) and pinning

- **Offset** is a constant added to a chart's labeling function — *re-point*, not move:
  labels slide, notes and tempo deformations stay at the same second. Offset edits
  **snap** to the active subdivision by default; the UI handle moves the **ruler**, not
  the notes. "Lead-in / two bars of silence" is an offset on the first chart (negative
  coordinates), not an extension of the ±∞ edge.
- **Pin / decouple** (§5) is the offset idea generalized to *between two charts*: a pin
  fixes a coincidence at a second; offset is the special case of pinning a chart to the
  datum. Deferred, but the model's "a lens may have its own rate" must hold so it can
  arrive without rearchitecture.

---

## 10. Lens-as-color (a rendering rule, not model state)

Because `hangsOn` is per-point, a point's chart allegiance must be visible at a glance:
**each chart is assigned a hue; a point is drawn in its effective chart's color.** A
cross-chart note shows its allegiance changing along its length; intersecting charts
read as overlaid colored grids; a note threading them reads as a color gradient. This is
ambient (no keys), which fits the touch / cross-device goal. **Color encodes `hangsOn`;
it is derived presentation, never stored** — `hangsOn` stays a chart id, color is a
view rule.

---

## 11. What changed from the region-model contract

| Region-model contract | Chart model |
|---|---|
| regions tile time; "which region owns this second?" has one answer (a **law**) | tiling is the **default authoring mode**; charts may intersect/extend (granular mode) |
| a note's region is **derived** from its position | a note has a **home** chart (positional default) + **per-point `hangsOn`** (explicit override) |
| `hangsOn` a future flag, "always main, collapsed" | `hangsOn` is the **per-point primary attribute**, null⇒home, in the velocity/breath family |
| "main / extent-defining" defines the region | `main` is **editorial** (reading length + encoding intent); the clock is the only true extent |
| lenses (temporal) vs pitch tunings: separate ideas | one **chart** kind governs time and/or pitch over a span; pitch lenses = tempo lenses |
| cross-chart = hybrid note (special) | cross-chart = a note with mixed point `hangsOn` (no special type) |

Everything in §1, §8, §9 (conservation, recoordinate, merge prompt, offset, snap-as-order)
is **unchanged**. The seam already built (one home chart, `hangsOn` collapsed to home,
tiled) is exactly Tiled Default Mode, §7 — a valid subset, not a contradiction.

---

## 12. Round-trip to v2

- A **chart** → a frame Event (`main`) or a `lenses[]` entry; its offset →
  `temporalSettings.offset`; its pitch side → `axis`/`axisSettings`.
- A **note** → a child Event. Points all on home ⇒ `position` + `extent` in the home
  chart's coordinates (today's shape, unchanged). A **start-chart / end-chart hybrid** ⇒
  `position` in the start chart, `extent.until` a landmark with `lens` in the end chart
  (the v2 schema already carries per-endpoint `lens`).
- **Arbitrary per-point `hangsOn`** beyond the two endpoints exceeds what v2
  `position`/`extent` express; like the Roll's multi-point contour, it rides in
  `payload` until the language grows a first-class per-point hang. The common and
  hybrid-endpoint cases serialize cleanly; deep per-point allegiance is a known
  serialization seam, not a blocker.
- `resolve()` reads it; the Roll's adapter consumes the resolver's nodes. Conservation
  must hold across save → load: every note sounds at the same second.

---

## Invariant checklist

The work is correct iff:

1. **Seconds conserved** by every operation (§1, §4, §8, §9); only labels/allegiance
   change.
2. **Chart over clock.** Every coordinate is a chart over the score's seconds; the score
   has one true extent (its seconds), not per-region extents that compete.
3. **Identity by id.** Notes name a home chart by id; points name `hangsOn` by id; nothing
   positional/indexed survives merge/extend/reorder.
4. **Two verbs separated.** Snapping never sets `hangsOn`; only an explicit re-hang does.
5. **`hangsOn` collapsed by default.** A note with all points on home stores no `hangsOn`
   and behaves exactly as today; the attribute is present but null-means-home.
6. **One engine.** Merge/insert/drag-cannibalize/cross-boundary all call `recoordinate`,
   which relabels home-hung points and leaves explicitly-hung points on their chart.
7. **Offsets re-point and snap** (§9); the ruler moves, not the notes.
8. **Color is derived.** `hangsOn` is a stored id; chart color is a render rule over it.
9. **Mode, not law.** Tiled single-active-chart is the default face and satisfies #10
   parity; intersection/extension/re-hang are the granular mode on the same model.
10. **One-chart parity.** With a single main chart and no re-hangs, the Roll behaves
    exactly as today (the build checkpoint: nothing visible changes).
11. **Round-trips.** Author → export v2 → re-import places every note at the same second;
    home-only and hybrid-endpoint notes serialize without payload escape.

---

## Deferred seams (carry the shape now, build later)

- **Granular mode**: intersecting/extending charts in the Roll UI; explicit per-point
  re-hang; lens-as-color. (Model ready: `hangsOn` per-point, charts with spans.)
- **Pitch charts as lenses**: "Pythagorean across B and C," draggable, cross-span.
- **Decouple / pin** between charts (polytempo authoring surface).
- **The attribute family**: velocity, breath, etc. on points alongside `hangsOn`.
- **Deep per-point serialization**: first-class per-point hang in the v2 language (today
  rides in `payload` beyond endpoints).

The discipline throughout: the model commits to the atlas now (one clock, charts,
per-point `hangsOn`), while the Roll's default face stays tiled and single-active-chart
so every step ships and #10 parity holds. The granular features are capabilities added
on the same shape, never rewrites.
