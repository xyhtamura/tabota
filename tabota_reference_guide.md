# Tabota Language Reference v2.0

Tabota is a language for **describing** time‑based events. In v2 there is a single
recursive type — the **Event** — and everything in a score is one. A note is an
Event; a regime is an Event; a whole movement is an Event. They differ only in
which optional facets they carry.

Tabota describes; it does not schedule. A score may state relations that are
under‑determined, over‑determined, indeterminate, or even paradoxical. A
**realizer** (TaboTa Roll, the MIDI compiler, a future visualizer) attempts to
turn a score into something concrete and reports what it cannot. The language
permits what a realizer may refuse.

## Table of Contents
1. [The Event and its facets](#the-event-and-its-facets)
2. [Frames: the regime role](#frames-the-regime-role)
3. [The value facet](#the-value-facet)
4. [The position facet](#the-position-facet)
5. [Landmarks](#landmarks)
6. [The extent facet](#the-extent-facet)
7. [Nesting](#nesting)
8. [Indeterminacy and paradox](#indeterminacy-and-paradox)
9. [References and imports](#references-and-imports)
10. [Realization: the determinate fragment](#realization-the-determinate-fragment)
11. [Migrating from v1.5](#migrating-from-v15)
12. [Complete examples](#complete-examples)

---

## The Event and its facets

A score is a document with a little metadata and a `score` array of top‑level
Events:

```json
{
  "projectName": "Minimal",
  "languageVersion": "2.0",
  "score": [ {} ]
}
```

`{}` is a valid Event — an undefined happening somewhere in its container. You
make an Event mean something by adding facets. Every facet is optional and they
stack freely:

| Facet | Role |
|-------|------|
| `id` | A name. Only Events you want to *refer to* need one. Naming an Event is the act of making it relatable. |
| `frame` | The **regime** role: turns the Event into a coordinate field its children are read in. |
| `value` | What the Event *is*: a pitch, a lane, an instruction, a velocity. |
| `position` | When/where it sits — exactly, relationally, or within a window. |
| `extent` | Its own duration / end — independent of what it contains. |
| `events` | Nested Events. |
| `ref` | Makes the Event an instance of another Event or an external file. |
| `payload` | Arbitrary attached data, text, comments, conditions. |

Because there is one type, the same shape describes a note and a regime, and you
can be both at once: an Event may carry a `frame` (establishing coordinates for
its children) *and* a `value` (being a note in its own parent's coordinates).

### The Conversion Principle (preserved from v1.x)

Tabota still rests on mutual translation between abstract ideas and physical
realization, but the keys now live on a `frame`:

* **Temporal** — `metered` (beats) converts to `chronological` (seconds) using a
  **bpm** key.
* **Axial** — `symbolic` (note names) converts to `frequency` (Hz) using a
  **tuning** key.

A useful rule falls out: **numbers need a frame; relations don't.**
`position.at: 2` means nothing until a frame says two‑*what* — beats or seconds —
because units are something a frame supplies. But `after`, `meets`, `equals` need
no units; they are pure ordering. So an Event can define itself entirely
relationally, own no frame, and belong to none — pinned in the web of other
Events — right up until it wants a number, at which point it borrows units from a
frame.

---

## Frames: the regime role

A **frame** turns an Event into a coordinate field. It does two things, each
optional and independently inheritable: it sets the **temporal regime** (how
its children's time is measured) and the **axis** (what their `value` means), and
it supplies the conversion keys.

| Temporal regime | Description | Use cases |
|-----------------|-------------|-----------|
| **metered** | Musical time, beats + bpm | Traditional scores, rhythmic music |
| **chronological** | Absolute time, seconds/minutes | Sound design, film scores, precise timing |
| **achronous** | Sequential order, no time | Interactive media, performer cues |

| Axis | Description | Use cases |
|------|-------------|-----------|
| **frequency** | values are Hz | Pitched music, microtonal composition |
| **symbolic** | values are note names | Conventional notation, custom tunings |
| **categorical** | values are named lanes | Percussion, MIDI triggers, lighting |
| **instructional** | values are text / layout only | Theater, performance art, scores as prose |

```json
{
  "id": "Theme",
  "role": "regime",
  "frame": {
    "temporal": "metered", "temporalSettings": { "beats": 8, "bpm": 100, "timeSignature": "4/4" },
    "axis": "symbolic", "axisSettings": { "tuning": "12-TET", "a4": 440 }
  },
  "events": [
    { "value": { "pitch": { "note": "C4" } }, "position": { "at": 0 }, "extent": { "duration": 1 } }
  ]
}
```

`role` is an advisory hint for humans and editors only; interpretation follows the
facets actually present. The word *regime* survives the type merger as a role, not
a type — a regime is simply an Event that carries a `frame`.

### Inheritance is lexical scope (think CSS, not Allen)

A child with no frame of its own is read in the nearest ancestor frame. Each half
inherits independently: a frame may set only the temporal regime (inheriting axis
from above) or only the axis. This is the same cascade as CSS `inherit` — and, as
in CSS, a child may **overflow** its parent (see [Nesting](#nesting)). Frame‑less,
metered without bpm, axis without tuning — all legal; they're relative units
awaiting a key, like `em` with no root font‑size.

### Meter without bpm

```json
{ "frame": { "temporal": "metered", "temporalSettings": { "beats": 7 } } }
```

A metered frame needs only `beats`. Without `bpm` it has no seconds — but the
relationships it captures (this bar is twice that, these downbeats align, 7/8
against 4/4) are often the only ones that matter. Such a frame is valid in the
language and simply unrealizable by a seconds‑based realizer until a bpm is
supplied somewhere up the tree.

---

## The value facet

`value` says what an Event *is*, along one or more axes. Sub‑values stack: an
Event can carry a pitch *and* text at once.

```json
{ "value": { "pitch": { "note": "A4" }, "text": "sul ponticello" } }
```

### Pitch

A pitch may be exact, gliding, an indeterminate band, or relative to another
Event. Use `hz` for the frequency axis, `note` for the symbolic axis.

```json
{ "value": { "pitch": { "hz": 261.63 } } }
{ "value": { "pitch": { "note": "C4" } } }
{ "value": { "pitch": { "from": "A4", "to": "D5", "interpolation": "linear" } } }
{ "value": { "pitch": { "between": { "low": 440, "high": 660, "intent": "free" } } } }
{ "value": { "pitch": { "relativeTo": "A", "relation": "higher", "offsetCents": 50 } } }
```

`between.intent` distinguishes **`free`** (genuinely indeterminate — a realizer
should keep the band or choose within it, not pretend it was exact) from
**`unspecified`** (you simply didn't pin it; a realizer may pick anything in
range).

### Lane, text, velocity

```json
{ "value": { "lane": "Kick" } }
{ "value": { "lane": { "anyOf": ["Snare", "Rim"] } } }
{ "value": { "text": "House lights down." } }
{ "value": { "velocity": 96 } }
{ "value": { "velocity": { "between": [80, 110] } } }
```

---

## The position facet

`position` constrains an Event's onset. Any combination of fields may appear;
together they form constraints, which may be over‑determined or contradictory —
the realizer resolves or reports. With no `position` at all, the Event floats
freely in its container.

### Exact placement

In the governing frame's units (beats / seconds / index):

```json
{ "position": { "at": 4.5 } }
{ "position": { "meter": { "measure": 3, "beat": 2 } } }
{ "position": { "index": 2 } }
```

### Anchor

Pin a known internal point of the Event to a time. `position` 0 = start,
0.5 = middle, 1 = end.

```json
{ "position": { "anchor": { "time": 10, "position": "50%" } }, "extent": { "duration": 6 } }
```

The middle sits at 10, so this spans 7 → 13.

### Relations (Allen's interval algebra)

Place an Event by its relation to a [landmark](#landmarks) on another Event. The
relation is written subject‑relative — `X r Y` — using Allen's thirteen, with an
optional metric `offset`.

| | relation | meaning | inverse |
|---|----------|---------|---------|
| `b` | before | X ends, gap, then Y | `bi` after |
| `m` | meets | X ends exactly as Y starts | `mi` met‑by |
| `o` | overlaps | X starts first, they share a middle | `oi` overlapped‑by |
| `s` | starts | same start, X shorter | `si` started‑by |
| `d` | during | X strictly inside Y | `di` contains |
| `f` | finishes | same end, X starts later | `fi` finished‑by |
| `=` | equals | identical span | — |

```json
{
  "id": "B",
  "value": { "pitch": { "note": "G4" } },
  "position": { "relations": [ { "type": "m", "of": { "event": "A", "point": "end" } } ] }
}
```

Note: relations are **not** nesting. Putting B inside A's `events` is a *scope*
statement; a relation is a *temporal* statement. They are orthogonal — see
[Nesting](#nesting).

### Indeterminate window

An onset somewhere within a window, bounded by numbers or landmarks
("sometime between Event A and Event B"):

```json
{ "position": { "between": { "from": { "event": "A" }, "to": { "event": "B" } } } }
{ "position": { "between": { "from": 5, "to": 10, "intent": "free" } } }
```

---

## Landmarks

A **landmark** is a point in time located by reference. There are three forms.

**Structural** — an edge or proportion of any Event, regardless of its frame:

```json
{ "event": "A", "point": "end" }
```

`point` is `start` / `end` / `onset` / `middle`; it defaults to `end`, matching
the intuition that "after A" means after A finishes.

**Coordinate** — a position *inside* a regime's coordinate field, in that frame's
units. Only Events carrying a frame can be addressed this way. "Beat 12 of
Regime A":

```json
{ "event": "Spine", "coord": 12 }
{ "event": "Spine", "coord": { "measure": 3, "beat": 2 } }
```

This is the difference between *pointing at* an Event (its edges — true of any
Event) and *pointing into* one (its interior — true only of coordinate fields). A
frame promotes an Event from three structural points to a continuum of addressable
positions.

**Datum** — the score's temporal reference point *z*, "when the score starts":

```json
{ "origin": "score-start" }
```

A purely relational web floats; nothing pins it to a clock. The datum is the one
privileged ground. "Starts when the score starts" is a relation to it. The most
intent‑preserving scores touch the datum once — the opening — and hang everything
else off relations between Events, so that moving the anchor moves the whole piece
coherently.

---

## The extent facet

`extent` is an Event's **own** duration / end — decoupled from what it contains. An
Event may have a short extent yet hold children that outlast it, or hold children
and have no extent at all.

```json
{ "extent": { "duration": 3 } }
{ "extent": { "endAt": 8 } }
{ "extent": { "endMeter": { "measure": 4, "beat": 0 } } }
{ "extent": { "until": { "event": "Z", "point": "end" } } }
{ "extent": { "end": "open" } }
{ "extent": { "end": "untilChildrenEnd" } }
{ "extent": { "between": { "from": 2, "to": 4 } } }
```

`end` conditions: **`open`** goes on forever (a drone, an unbounded regime) —
representable, but flagged non‑exportable by realizers; **`untilChildrenEnd`** sets
the extent to the bounding span of contained children; **`untilParentEnds`** ends
when the container ends.

This is the answer to "when does a regime end?" — its extent is whatever its
`extent` says, separate from where its children fall. Traditional notation welds
the two together (a barline is both a scope boundary and a time boundary); Tabota
pries them apart.

---

## Nesting

Nesting is the `events` array. Any Event may contain Events; this is the recursion
that makes one type enough.

Nesting carries the **scope** edge — "X is read in Y's coordinate frame" — and
nothing else. It is *not* Allen's `during`. `during` requires the child to fall
strictly inside the parent's span; nesting imposes no such constraint, so a child
may legally extend past its parent's extent (CSS `overflow: visible`, not
`hidden`). The temporal relation between a container and its child is a separate,
free relation you may state explicitly with `position.relations` if you wish; left
unstated, a realizer treats a nested child as falling within its parent for layout,
but the language does not require it.

```json
{
  "id": "Parent", "role": "regime",
  "frame": { "temporal": "metered", "temporalSettings": { "beats": 40, "bpm": 100 } },
  "events": [
    {
      "id": "Child", "role": "regime",
      "frame": { "temporal": "chronological", "temporalSettings": { "duration": 12 } },
      "position": { "at": 16 },
      "events": []
    }
  ]
}
```

`Child` starts at beat 16 of `Parent` (its `position.at` is read in the parent's
metered frame) and then measures *its own* children in seconds. The old
`childSections` / `startTrigger` / `parallelTo` / `tracks` machinery is all just
this: nested Events with a `position`.

---

## Indeterminacy and paradox

Tabota is a system of description, not a scheduler, so it must be able to hold
configurations that no timeline can satisfy. This is deliberate.

```json
{
  "score": [
    {
      "id": "P1", "value": { "pitch": { "note": "D4" } },
      "position": { "relations": [ { "type": "bi", "of": { "event": "P2" } } ] }
    },
    {
      "id": "P2", "value": { "pitch": { "note": "F4" } },
      "position": { "relations": [ { "type": "bi", "of": { "event": "P1" } } ] }
    }
  ]
}
```

`P1` after `P2`, `P2` after `P1`: a perfectly well‑formed constraint graph that
happens to have no linearization. It is **valid Tabota**. A realizer that draws
timelines will report it as unschedulable; a realizer that draws *graphs* could
show it directly as a directed cycle, with nothing to refuse. The error, when it
occurs, lives in the projection onto a clock — never in the structure.

The same freedom covers indeterminacy: an onset that is a window
(`position.between`), a pitch that is a band (`pitch.between`) or a comparison
(`pitch.relativeTo`). Expressible everywhere; resolved only where a realizer
chooses and is able to.

---

## References and imports

Declare external files at the top with `imports`; instance Events with the `ref`
facet (local id, imported id, or direct file), optionally transformed.

```json
{
  "projectName": "Main Composition",
  "languageVersion": "2.0",
  "imports": [
    { "id": "rain", "file": "./recordings/rain.json" },
    { "id": "rock", "file": "./library/percussion.json", "target": "BasicRock16" }
  ],
  "score": [
    {
      "id": "Movement1", "role": "regime",
      "frame": { "temporal": "metered", "temporalSettings": { "beats": 64, "bpm": 120 } },
      "events": [
        { "ref": { "externalRef": "rain" }, "position": { "at": 32 } },
        { "ref": { "target": "Movement1" }, "position": { "at": 0 }, "extent": { "duration": 8 } }
      ]
    }
  ]
}
```

`ref.transform` may carry `timeOffset`, `transpose` (+ `transposeUnit`), and a time
`scale`.

---

## Realization: the determinate fragment

A realizer cannot do everything the language can say, and shouldn't pretend to.
The **determinate fragment** is the subset that round‑trips losslessly to a
timeline and to MIDI: Events placed at exact coordinates (`at` / `meter` /
`index`), with exact or gliding pitch, in frames whose conversion keys are
present. `metadata.profile: "determinate"` is an advisory claim that a score stays
inside it; `"full"` makes no such promise. The schema enforces neither — the check
is a realizer's job.

* **TaboTa Roll** writes only the determinate fragment (every drawn note is a
  `value` + `position.at` + `extent.duration` in one metered frequency frame) and
  reads full Tabota, gracefully skipping what it cannot draw.
* **The compiler** plots and exports the determinate fragment and lists everything
  else under "cannot schedule here" — relational placement, ranges, open extents,
  cycles. That list is the realizer being honest about its limits, not the
  language failing.

---

## Migrating from v1.5

The collapse of Section / Track / ChildSection / Event into one type is mostly a
mechanical rename. The shape of the numbers is unchanged.

| v1.5 | v2 |
|------|----|
| a `section` object | an Event with a `frame` |
| `sectionId` / `trackId` | `id` |
| `temporalRegime` + `regimeSettings` | `frame.temporal` + `frame.temporalSettings` |
| `axisMode` + `modeSettings` | `frame.axis` + `frame.axisSettings` |
| `timeSignature: [4,4]` | `temporalSettings.timeSignature: "4/4"` |
| `tracks: [...]` | nested `events` (each a child frame) |
| `childSections` + `startTrigger` | nested `events` with a `position` |
| `parallelTo` | a nested or sibling Event with a `position` |
| event `type: "point"/"line"/"group"` | dropped — inferred from facets present |
| `time` / `startTime` / `startIndex` | `position.at` (or `meter` / `index`) |
| `startMeter` | `position.meter` |
| `duration` / `endTime` / `endMeter` | `extent.duration` / `extent.endAt` / `extent.endMeter` |
| `yValue` / `note` (single pitch) | `value.pitch.hz` / `value.pitch.note` |
| `startYValue` + `endYValue` (glide) | `value.pitch.from` + `value.pitch.to` |
| categorical `yValue` | `value.lane` |
| instructional `payload.text` | `value.text` |
| `relativeTime: { after, offset }` | `position.relations: [ { type, of, offset } ]` (Allen) |
| `anchor` | `position.anchor` (unchanged) |
| `imports` / `externalRef` | unchanged / `ref.externalRef` |

---

## Complete examples

### Example 1 — Symbolic melody with a glide, custom tuning

```json
{
  "projectName": "Pythagorean Melody",
  "languageVersion": "2.0",
  "metadata": { "profile": "determinate" },
  "score": [
    {
      "id": "MainTheme", "role": "regime",
      "frame": {
        "temporal": "metered", "temporalSettings": { "beats": 8, "bpm": 100 },
        "axis": "symbolic",
        "axisSettings": { "tuning": { "system": "custom", "file": "./tunings/pythagorean_c.json" } }
      },
      "events": [
        { "value": { "pitch": { "note": "C4" } }, "position": { "at": 0 }, "extent": { "duration": 2 } },
        { "value": { "pitch": { "note": "G4" } }, "position": { "at": 2 }, "extent": { "duration": 2 } },
        { "value": { "pitch": { "from": "D4", "to": "A4" } }, "position": { "at": 4 }, "extent": { "duration": 2 }, "payload": { "comment": "rising fifth glide" } },
        { "value": { "pitch": { "note": "A4" } }, "position": { "at": 6 }, "extent": { "duration": 2 } }
      ]
    }
  ]
}
```

The referenced tuning file is a simple map of note names to exact Hz:

```json
{
  "name": "Pythagorean Scale on C",
  "referenceNote": "A4",
  "referenceFreq": 440.0,
  "notes": { "C4": 260.74, "D4": 293.33, "E4": 330.0, "F4": 347.65, "G4": 391.11, "A4": 440.0, "B4": 495.0 }
}
```

### Example 2 — Two axes by nesting (the old multi‑track)

```json
{
  "projectName": "Mixed Regime Composition",
  "languageVersion": "2.0",
  "score": [
    {
      "id": "MainSection", "role": "regime",
      "frame": { "temporal": "metered", "temporalSettings": { "beats": 32, "bpm": 100 } },
      "events": [
        {
          "id": "MelodicLayer", "role": "regime",
          "frame": { "axis": "symbolic" },
          "events": [
            { "value": { "pitch": { "note": "A4" } }, "position": { "anchor": { "time": 16, "position": "50%" } }, "extent": { "duration": 8 }, "payload": { "comment": "climax centered at beat 16" } }
          ]
        },
        {
          "id": "Percussion", "role": "regime",
          "frame": { "axis": "categorical", "axisSettings": { "categories": ["Kick", "Snare", "HiHat"] } },
          "events": [
            { "value": { "lane": "Kick" }, "position": { "at": 0 } },
            { "value": { "lane": "Snare" }, "position": { "at": 1 } }
          ]
        }
      ]
    }
  ]
}
```

Both child frames inherit the parent's metered timebase (bpm 100) and override only
the axis. There are no "tracks" — only Events inside Events.

### Example 3 — Relational spine with an unschedulable tail

```json
{
  "projectName": "Relations and the Unschedulable",
  "languageVersion": "2.0",
  "metadata": { "profile": "full" },
  "score": [
    {
      "id": "Spine", "role": "regime",
      "frame": {
        "temporal": "metered", "temporalSettings": { "beats": 8, "bpm": 100 },
        "axis": "symbolic", "axisSettings": { "tuning": "12-TET" }
      },
      "events": [
        { "id": "A", "value": { "pitch": { "note": "C4" } }, "position": { "at": 0 }, "extent": { "duration": 2 } },
        { "id": "B", "value": { "pitch": { "note": "G4" } }, "position": { "relations": [ { "type": "m", "of": { "event": "A", "point": "end" } } ] }, "extent": { "duration": 2 } },
        { "id": "C", "value": { "pitch": { "between": { "low": "E4", "high": "B4" } } }, "position": { "between": { "from": { "event": "A" }, "to": { "event": "B" } } } }
      ]
    }
  ]
}
```

`A` is determinate and will plot. `B` is placed by relation and `C` is doubly
indeterminate; a timeline realizer lists both under "cannot schedule here" while
keeping them in the score, intact, for a realizer that can.
