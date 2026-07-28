# Tabota / Cycla — meter morphing and local grid adjustment

*Design notes, 2026-07-27. Thinking only; no format or interface decision is
settled here.*

## Working idea

Meter morphing and situational grid adjustment can use the same underlying
operation: **make the metric grid vary over the score**.

The score clock remains continuous. A grid maps normalized bar phase onto
metric boundaries, assigns each boundary an indispensability level, and supplies
the snap targets. Morphing changes that map over a span. A local adjustment is a
short, manually authored morph whose state before and after the adjusted span may
be identical.

This follows the chart model's conservation law. Editing the grid moves the
ruler, not the notes or the underlying seconds. Existing notes keep their sounding
times unless the user separately asks to re-snap or re-hang them.

## Three changes that should remain distinct

1. **Tempo change** changes how metric coordinates map to seconds. It stretches
   or compresses time.
2. **Meter or grid change** changes the boundaries and weights inside a bar or
   cycle. It changes where the ruler offers divisions and snap targets.
3. **Note movement** changes an event's position.

The interface may let a user perform two of these together, but the model should
not conflate them. For example, moving the middle boundary of a `2+3` bar from
phase `0.4` to `0.6` changes it toward `3+2`; it does not by itself change the
bar's duration in seconds.

There is one boundary case. If the user moves the start or end of the bar, the
operation changes the chart-to-seconds map and therefore belongs to tempo,
offset, or chart pinning rather than an internal grid adjustment.

## A minimal variable-grid model

A static Cycla grammar already produces boundaries such as:

```text
[
  { path: "root",   phase: 0,   level: 0 },
  { path: "root/1", phase: 0.4, level: 1 },
  ...
]
```

A variable grid would let boundary phase and possibly boundary strength vary
with score time:

```text
grid state at time t:
  boundary(path).phase = f(t)
  boundary(path).strength = g(t)
```

`path` is a stable address in the subdivision tree. Phase must remain ordered
inside its parent cell. Strength represents whether a boundary is available and
how strongly it should draw or snap; Cycla's current level can supply its default
strength.

The shared grid operation then remains the source for both rendering and
snapping:

```text
gridAt(chart, second) -> boundaries with phase, level, strength
snap(chart, second, policy) -> one of those boundaries
```

This extends the existing Grid Law rather than adding a second morph-specific
renderer.

## Easy case: topology-preserving morphs

Two grids are directly morphable when their subdivision trees have corresponding
nodes. Interpolate the weights or boundary phases of nodes with the same path,
then derive every descendant boundary from its parent.

Examples:

- `2+3` to `3+2`: move the root's internal boundary from `0.4` to `0.6`.
- straight eighths to swing: keep each beat boundary fixed and move its internal
  division from `0.5` toward `2/3`.
- a hand adjustment inside one beat: move only that beat's child boundary while
  the surrounding beat and bar boundaries remain fixed.

Interpolation should preserve boundary order. A monotone curve or constrained
weights is safer than interpolating unrestricted absolute positions.

The transition curve could be linear, smooth, or stepped. This is separate from
the segment shapes used by tempo and note glides even if the interface gives them
the same small vocabulary.

## Hard case: topology-changing morphs

`4/4` to `7/8`, or a binary tree to a tree with an additional subdivision, has no
automatic one-to-one node mapping. Several policies are possible:

- **Explicit correspondence.** The author pairs nodes in the source and target
  trees. Unpaired nodes fade in or out.
- **Union of boundaries.** Keep every boundary from both grids, interpolate the
  paired ones, and vary the strength of unpaired ones between zero and their
  target strength.
- **Discrete handoff.** Keep both grids visible during a transition but make only
  one the active snap grid at a chosen point.

The first two make a continuous visual morph possible. They also introduce
questions for snapping: when does an emerging boundary become selectable, and
when does a disappearing boundary stop being selectable? A strength threshold
with hysteresis would avoid a target flickering on and off near the threshold.
The discrete handoff is less expressive but has unambiguous authoring behavior.

There should be no default claim that unrelated grids have a musically correct
correspondence. The editor can suggest a nearest ordered match, but the stored
mapping should be explicit.

## Situational custom grid adjustment

The Roll could expose a temporary **grid edit** mode over a selected span:

1. Select a chart and a time span.
2. Display the Cycla subdivision tree as handles on the Roll.
3. Drag an internal boundary. Parent and sibling constraints prevent crossings.
4. Choose whether the edit holds, returns to the original grid, or transitions
   into another saved grid.

This yields several useful forms without separate mechanisms:

- one late or early subdivision in a single bar;
- a gradual straight-to-swung passage;
- a local stretch of one beat followed by a compensating compression, with the
  bar ends fixed;
- a transition between two Cycla grammars;
- a grid that changes only in snapping strength while its boundary positions
  stay fixed.

Grid edits should not silently quantize existing events. After an edit, the Roll
can offer an explicit command such as **Move selected points to the revised
grid**. This keeps ruler editing and event editing legible.

## Where the data belongs

Cycla should continue to describe reusable, score-independent subdivision
grammars. Tabota should describe when a grammar applies and how it is changed in
a particular score.

A first implementation could therefore remain Roll-project data:

```text
chart.grid:
  source: cycla id or embedded grammar
  keyframes:
    - at: chart coordinate
      nodeEdits:
        root/1: { phase: 0.4, strength: 1 }
    - at: chart coordinate
      nodeEdits:
        root/1: { phase: 0.6, strength: 1 }
```

This is only a sketch. It should not enter the Tabota schema until the editing
behavior and round-trip requirements are proven.

Tabota v2.1's scalar `value.curve` can describe the transition of one phase or
strength value, but a whole grid is a structured set of linked curves with order
constraints. Reusing the curve segment vocabulary may be useful; treating the
entire grid as one scalar curve would lose its structure.

If reusable morphs later become useful outside one score, Cycla could add stable
node names and a separate morph form that maps one grammar to another. That need
does not yet justify changing `.cyc`.

## Questions to keep open

- Is a morph evaluated once per bar, continuously inside a bar, or both?
- Do the bar's exterior boundaries always remain fixed during a grid morph?
- Should strength be continuous, or should boundary availability remain
  categorical?
- How does snap depth interact with strength during a topology-changing morph?
- Can node paths remain stable when a Cycla grammar is edited, or do reusable
  morphs require explicit node IDs?
- Does a local grid edit belong to the chart, to a grid-automation Event, or only
  to Roll project payload until the model settles?
- When two charts overlap, does grid editing affect one named chart only? The
  chart model suggests yes; borrowing a grid for snapping should not make it
  editable through the borrowing chart.

## Provisional direction

Start with topology-preserving local edits. Keep bar boundaries fixed, store
per-node phase keyframes in Roll project data, and make the existing per-region
grid generator consume them before it draws or snaps. This covers `2+3` to `3+2`,
straight to swing, and situational hand adjustments.

Defer topology-changing morphs until a concrete musical case establishes how
boundary correspondence and snap strength should work. The data model above
leaves room for them without making the first editor solve them.
