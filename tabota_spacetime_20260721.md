# Tabota and space — what changed, and a symmetry principle for what's next

*Design note, 2026-07-21. Records that Tabota can now encode space (a fact on
the ground as of [Stanzuary](../stanzuary/stanzuary.md)), and proposes —
unbuilt — how time and space should relate in the language going forward.
Companion to [tabota_workspace_20260715.md](tabota_workspace_20260715.md) (the
coupling architecture this obeys), [tabota_compat.md](tabota_compat.md) (the
two rules any change here must satisfy), [tabota_chart_model.md](tabota_chart_model.md)
(the manifold/chart idea this generalizes), and
[../spatial-tabota_spec_20260720.md](../spatial-tabota_spec_20260720.md) (the
spatial relation ladder this is written from).*

---

## 0. What changed

Tabota described time-based events. As of Stanzuary, a `.tabota` file can
also describe where a fragment sits in three-dimensional space — position,
rotation, extent along a depth axis — inside the same Event shape, same
`score[]`, same file. Nothing in `tabota_schema.json` changed to make this
true. That is itself the finding worth recording: the language absorbed a new
kind of content (space) using only the extension points it already had
(`payload`, namespaced by app). The rest of this note is about whether that
was luck, and what a *first-class* version — folding space into `frame` and
`position` proper, not just riding in payload — should look like, guided by a
principle the user named directly: **time and space should be treated the way
physics treats them, symmetrically.**

## 1. The precedent, precisely

`Frame` and `Position` are both `additionalProperties: false` in the schema —
a closed vocabulary of `temporal`/`axis` and `at`/`meter`/`index`/`anchor`/
`relations`. Stanzuary could not have added a `frame.spatial` key even if it
wanted to; the schema forbids it by design, and that closure is itself a
compat boundary worth having (an open `Frame` would let every app invent its
own drifting dialect of "coordinate system"). `payload`, by contrast, is
`additionalProperties: true` — the deliberate escape hatch. So Stanzuary's
`payload.spatial` (position, rotation, extrude depth, style) is **Road A**
exactly as [the workspace plan](tabota_workspace_20260715.md#3-custom-event-types-two-roads)
names it: namespaced payload, zero schema edit, legal today, promotable to a
schema-level `frame.spatial` / relational `position` (**Road B**) only once a
second spatial consumer proves the same shape is needed — Foam Green City is
the standing candidate.

Nothing here required a new mechanism. It required only that Stanzuary follow
the rule the workspace plan already laid down for exactly this situation.

## 2. The symmetry was already half-built

Before asking whether time and space *should* be symmetric, it's worth
noticing how much of the current `Position` schema already is, independent of
anything Stanzuary did:

- **`position.relations`** — Allen-style relational constraints to landmarks
  on *other* Events. Several may coexist; together with the cross-Event graph
  they may form cycles, which the language *permits* — a realizer resolves or
  reports. This is, facet for facet, the same shape as the spatial relation
  ladder's L1 (`above`/`aligned`/`offset`, referencing other fragments by id):
  a graph of relative constraints that may be under-, over-, or exactly
  determined, resolved by a realizer that may refuse.
- **`achronous` + `position.index`** — ordinal position with no clock at all.
  This is already, precisely, spatial L0: order without a frame, a sequence
  that needs no units to mean something.
- **The one place time and space are *not* symmetric today**: `position.at`
  is a bare `number` — the metric, fully-determined case — and it is
  implicitly one-dimensional and implicitly temporal (its units come from
  whatever the frame's `temporal` regime says). There is no schema-level
  equivalent for "a point in a declared *n*-axis space." That gap is what
  Stanzuary's `payload.spatial.position.at: {x,y,z}` fills, off to the side,
  in payload.

So the honest claim is narrower than "make time and space symmetric" — the
relational half of `Position` already is. What's missing is a general metric
position: a labeled point over whatever axes a frame declares, of which
today's scalar `at` (one axis, always temporal, always called "beats" or
"seconds") is the degenerate single-axis case.

## 3. The physics framing — and where it stops applying

Special relativity's move was to stop treating time as a privileged
background parameter and start treating it as a coordinate on the same
footing as space: a `(t, x, y, z)` tuple, related to another observer's tuple
by a transform, neither one more "real" than the other. **This is a
simplification for our context** — physical spacetime carries a metric
signature that treats time differently in the algebra (Minkowski's
`ds² = -c²dt² + dx² + dy² + dz²`, the minus sign on `dt²`), and causality — the
light cone, the fact that influence has a direction in time it does not have
in space — is not a bookkeeping detail. Importing the idea without flagging
this would overclaim.

What transfers cleanly, and is the actual proposal: **the formal machinery a
coordinate needs — a frame to assign it units, a chart to relate it to other
frames, the option to state pure relations that need no frame at all — should
be the *same* machinery for a temporal axis and a spatial axis.** Tabota
already discovered a one-dimensional version of exactly this, independently,
in [tabota_chart_model.md](tabota_chart_model.md):

> The score is one event with one real clock — seconds from the datum `z`.
> Every coordinate system, "main" or "lens", metric or chronal or pitch, is a
> chart over that clock. ... the clock is the manifold; charts are maps from
> local coordinates onto it.

That is the manifold-and-atlas idea from differential geometry, already
built, already shipping, for a manifold of dimension one. The proposal below
is: keep the atlas discipline, generalize the manifold's dimension.

And here the digital medium takes back even more than the physics analogy
would grant. Physical time's arrow is not optional — causality gives it a
direction no observer can flip. A `.tabota` score has no such constraint: it
is read by software that can scrub backward, resolve in any order, or ignore
direction entirely. So the one asymmetry a first draft of this note wanted to
keep — time's distinguished *causal* role — is, here, **imposed rather than
given**: it appears only when a realizer (or an author) plants an origin and a
direction on the time axis, and nothing forces that planting. Strip the
conventional planting of time's arrow and time and space are the same kind of
axis all the way down; that is what makes the *language* more symmetric than
the *physics*. Whether to keep planting time's arrow by default is then a
realizer policy, not a language fact — which is the more honest place for it
to live.

## 4. The proposal (unbuilt)

Not built, not scheduled — recorded so the shape exists before code commits
to a narrower one.

**Generalize `Frame` from two special-cased halves (`temporal`+`axis`) to a
declared list of named, typed axes:**

```
frame.axes: [
  { name: "t", kind: "temporal", regime: "metered", key: { bpm: 120 } },
  { name: "x", kind: "spatial",  regime: "linear",  key: { unitsPerCm: 0.25 } },
  { name: "y", kind: "spatial",  regime: "linear",  key: { unitsPerCm: 0.25 } },
  { name: "z", kind: "spatial",  regime: "linear",  key: { unitsPerCm: 0.25 } }
]
```

**Generalize `Position.at` from a bare number to a labeled point over
whatever axes the governing frame declares:**

```
position.vec: { t: 4.5 }                    // today's temporal score, restated
position.vec: { x: 0, y: 8, z: 4 }           // Stanzuary's case, restated
position.vec: { t: 4.5, x: 0, y: 8, z: 4 }   // an event with both — melt, eventually
```

`position.at: number` remains valid forever (Rule 1, additive-only — nothing
is removed) and is defined as sugar for `position.vec` against a frame's sole
default axis, so every existing file keeps meaning exactly what it means
today; nothing currently written needs to change. `position.relations` and
`position.index` need no change at all — they were already general (§2).

This is the same move Stanzuary already made at the payload level
(§1 — labeled coordinates, named axes, so a fourth axis costs nothing later),
now proposed one layer down, in the schema itself, where it would let a
*single* Event carry both a temporal and a spatial position without splitting
across `position.at` and `payload.spatial` — which is exactly what "melt" (an
event that is simultaneously a place in gelatin and a moment as it dissolves)
will need. See [spatial-tabota_spec_20260720.md §6](../spatial-tabota_spec_20260720.md#6-phase-2-sketch-objects-as-temporal-phenomena)
for that sketch from the spatial side.

## 5. What does not unify, on purpose

Symmetry of *form* is not symmetry of *role*. Three things stay asymmetric,
deliberately:

- **Causal/realization order — but conventional, not forced (§3).** A realizer
  typically walks a score's temporal axis to produce something that plays, and
  has no equivalent habit of "walking" a spatial axis in a canonical
  direction. But this is realizer *policy*, not a schema property or a physical
  necessity — in a digital medium the arrow is planted, not given, so this
  asymmetry is one an author or tool *chooses*, and one they may decline
  (scrub-backward, orderless resolution). The proposal does not encode it
  either way; it leaves the planting to whoever realizes the score.
- **Dimension count.** A temporal frame will keep declaring exactly one axis
  in the overwhelming majority of scores; a spatial frame declares two or
  three. The general `frame.axes[]` list accommodates both without needing
  either to pretend to be the other's shape.
- **`achronous`, unmatched.** Achronous time (pure order, no clock) already
  has its spatial cousin in L0 topological relations (§2). What has no
  obvious inverse is a *spatial* regime with no analogue in time at all —
  none is proposed here, and none seems needed; the asymmetry is left as is
  rather than manufacturing a false parallel to close it.

## 6. Compat and sequencing

Per [tabota_compat.md](tabota_compat.md) Rule 1: `frame.axes` and
`position.vec` would be additive, optional, and non-breaking to add — a minor
bump, same as `value.curve` at v2.1. Per the workspace plan's own discipline
(§5 there): **do this only when ≥2 real consumers need the same shape** — the
same bar that gates Stanzuary's Road B. Candidates: Stanzuary (spatial, now),
a future melt-capable realizer (both, later), Foam Green City (spatial,
possibly). Until two are real, this stays a documented shape, not a schema
edit — which is the entire point of writing it down now rather than building
it now.

## 7. Open questions

- **Directionality may live in the relations, not the realizer — and it may be
  the L0/L1 seam.** (Raised by the user, 2026-07-21; recorded, deliberately
  unresolved.) Allen's interval relations split cleanly: a symmetric core
  (`meets`, `equals`, adjacency, `between`) presupposes no arrow and reads
  identically in time and in space; the directional ones (`before`/`after`)
  presuppose one. Time only *seems* to supply that arrow for free — it supplies
  it because we habitually plant time's origin and orientation, and (§3) a
  digital medium does not force us to. In space the *same* directional
  relations (`above`/`below`, `leftOf`/`rightOf`) are exactly the ones the
  spatial ladder puts at **L1** — the tier that needs a planted origin +
  orientation — sitting above the frame-free **L0** core (`within`, `touches`,
  `between`). So the shape the user pointed at: a directional relation *is* a
  symmetric relation plus a planted frame axis, and "time's arrow" is just the
  axis we plant by convention. The unresolved question: should the schema mark
  the frame-free symmetric relations (L0) distinctly from the origin-requiring
  directional ones (L1), uniformly across time and space — rather than carrying
  Allen's temporal set and the spatial set as two separate vocabularies that
  happen to rhyme?
- Does `kind: "temporal" | "spatial"` on an axis do any real work, or is it
  purely advisory (like `role` on an Event) — with the actual behavioral
  distinction (causal walk order) living entirely in what a realizer chooses
  to do with an axis named `t` by convention?
- Should `frame.axes` replace `temporal`/`axis` outright at some future major,
  or coexist as an alternative form forever (per Rule 1, replacement of an
  existing field is breaking; coexistence is the only additive path)?
- Units-per-axis conversion keys (`bpm` for `t`, `unitsPerCm` for `x`/`y`/`z`)
  are structurally the same "frame supplies the conversion" idea the
  Conversion Principle already names for beats↔seconds and note-name↔Hz — is
  there a single general key shape worth factoring out, or are the three
  domains different enough that forcing one shape would be the wrong kind of
  premature unification?

---

*spine: the relational half of Tabota's time model was already spatial in
shape; only the metric half was time-only. Fix that, and time and space are
one kind of axis — the arrow physics forces on time is, in a digital score,
not given but planted, and so belongs to whoever realizes the score, not to
the language.*
