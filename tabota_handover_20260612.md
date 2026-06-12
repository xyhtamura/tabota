# Tabota — Development Handover

*For future development sessions (human or LLM). Read this first; then the two
contracts. Last updated: June 2026, end of the "shippable next version" push.*

---

## 1. What Tabota is

**Tabota** is a music **description language** (not a scheduler): a JSON format in
which every node of a score is one recursive **Event** with stackable optional
facets (`frame`, `lenses`, `value`, `position`, `extent`, `events`, `ref`,
`payload`). It can describe things no timeline can play — relational placements,
indeterminate pitches/onsets, paradoxical cycles, unpegged meters — and leaves the
refusing to *realizers*. The name references rice paddies (田): adjacent plots of
cultivated ground; heterogeneous temporal/pitch encodings coexisting and remaining
commensurable in one score.

Key vocabulary (used throughout code and docs):

- **Chart / lens**: a coordinate system over the score's one real clock (seconds
  from the datum *z*). bpm is an *exchange rate* from beats to seconds; seconds are
  the *currency/numéraire*. A chart with no path to seconds is *unpegged* — legal,
  unrealizable.
- **Region** (Roll): a chart the UI treats as a section. **Main/extent-defining**
  is *editorial* (reading convention + encoding intent), not structural.
- **Hybrid note**: a note whose endpoints hang on *different* charts — same shape
  as "starts at C4, ends at 1200 Hz", on the time axis.
- **Determinate fragment**: the subset realizable to a timeline/MIDI.
- **Tiling**: regions covering the clock with no gaps/overlap — a default authoring
  MODE, not a semantic law.

## 2. The files

| File | Role |
|---|---|
| `tabota_schema_v2.json` | JSON Schema (draft-07) for the language. Source of truth for the format. |
| `tabota_reference_guide.md` | Human-readable language reference (v2 rewrite; includes tempo/currency/lenses and a migration table from v1.5). |
| `tabota-resolve.js` | **The shared interpreter** (ES module + `window.TabotaResolve`). `resolve(doc)` → `{nodes, frames, totalSec, datum, diagnostics}`. Both pages consume it. |
| `index.html` | Read-only **renderer** over the resolver. Draws a *wider* domain than the Roll (points, achronous/ordinal, bands, cycles annotated as "described, not placed"). Exports the **visual score (SVG)**. No MIDI. |
| `tabota_roll.html` | **TaboTa Roll** — the interactive realizer/editor. Contiguous multi-region canvas, MIDI export, Web Audio playback. The big file (~2.6k lines). |
| `cycla_builder.html` | Builder for cycla (subdivision-grammar meter) files. |
| `tabota_chart_model.md` | **CURRENT authoring contract** (supersedes `tabota_region_model.md`). The atlas: one clock, charts over it, per-point `hangsOn`, snapping≠hanging, tiling-as-mode. |
| `tabota_region_model.md` | Superseded contract; kept for the recoordinate/merge/offset mechanics it specifies (still honored). |

**Deployment**: GitHub Pages; local testing REQUIRES a server
(`python3 -m http.server`, browse `localhost:8000`) because the resolver is an ES
module and index.html `fetch`es the guide. `file://` will not work. Hard-refresh
(`Ctrl/Cmd-Shift-R`) after edits.

## 3. Architecture (three layers, one interpreter)

```
                tabota_schema_v2.json   (what is valid)
                        │
                tabota-resolve.js       (what it MEANS: one shared interpretation)
                   /            \
        index.html               tabota_roll.html
   (read-only renderer,         (editor/realizer: receptors filter
    draws the wide domain,       resolver nodes to the playable
    SVG export)                  subset; own reverse-projection
                                 pixels→Tabota for editing)
```

- **Receptor model**: both pages call the same `resolve()`; each keeps only what it
  can show. The Roll drops `point`, `ordinal`, `band`, `in-cycle`, `unplaced`
  (counted as "skipped"); index.html draws nearly everything and annotates the rest.
- The Roll's **import** is an adapter over `resolve()` (`_notesFromV2`), with a
  legacy v1.5 fallback. Its **export** (`expJson`) serializes the region model to
  v2 directly. Its **MIDI/playback** engine is its own and reads `notes[]`.
- Resolver node format: endpoints carry `sec` (the reconciliation layer) + plural
  `coords[]` (the second re-expressed in every chart touched) + `mode`
  (`measured|relational|ordinal|unplaced`); nodes carry `tags` that drive all
  receptors (`determinate, relational, indeterminate, ordinal, unpegged, in-cycle,
  dangling, point, open, tempo-ramp`). `diagnostics` never throws — a paradox is a
  valid object (`in-cycle` + info diagnostic), distinct from a `dangling` ref (error).

## 4. The Roll's data model (as of this handover)

```
regions[]   : [{ id:'rN', name, main:'m', systems:[{ id:'m',
                kind:'metered'|'chronological', bpm, sigNum, sigDen, a4,
                bars,            // METERED: bars; CHRONOLOGICAL: seconds
                offset, axis }] }]
activeRegionId : whose looks the controls show; clicking the canvas focuses
pitchRegions[] : [{ id:'pN', startSec, scaleId, regime:'scale'|'freq' }]
                 // NON-extent-defining y-axis charts; hang on absolute seconds;
                 // tile the clock; focused one drives activeScale/pitchRegime globals
notes[]     : ONE global array. {
                id, region,        // home chart (id)
                hangsOn,           // ='m' today (per-point hangs are the deferred granular mode)
                start, dur,        // in the HOME region's units (beats, or seconds if chronological)
                end: {region,beat} // OPTIONAL — hybrid: the END hangs on another region.
                                   //   The hang is AUTHORITATIVE; dur is DERIVED
                                   //   (normalizeHybrids in changed()), so all draw/hit/
                                   //   play/export code keeps reading start+dur.
                type:'hold'|'glide'|'free', pts:[{t,hz,curve?}], vel, voice, curve? }
```

**Coordinate stack** (the heart of the contiguous canvas):
`view.pxPerSec` is the stored zoom; `view.pxPerBeat` is a *getter* derived from the
active bpm. Primitives `secToX/xToSec`; tiling `regionSecLen/regionStartSec/
regionAtSec`; `beatToXin(b, region)` maps a region-local beat through its tempo to
the clock; `beatToX(b)` uses `_ctxRegion || activeRegion()` — **`_ctxRegion` is the
trick** that lets all pre-existing draw/hit code render each note through its own
region (set per-note in `drawNotes`/`noteAt`, reset to null after).

**Encoding invariant**: a note *stores* a beat; the canvas derives second→pixel at
render. Export reads the stored beat. Tempo is visible as width (slower = wider);
`pxPerSec` is constant under tempo changes.

## 5. Invariants currently encoded (do not break)

1. **Conservation law**: every region operation conserves *seconds* and only
   rewrites labels. Slice, boundary-merge, relabel, kind-switch, hang-rebase all
   capture absolute seconds first, mutate, then rebase.
2. **GOLDEN RULE** (`relabelActiveRegion`): the extent (seconds) changes ONLY
   explicitly — boundary drag or the bars input. bpm/sig edits are *relabelings*:
   span fixed, bars remap, notes (and hybrid hangs) freeze in seconds.
3. **Hybrid hang authority**: structural ops treat `n.end` as authoritative and
   derive `dur`; *geometry drags* re-derive the hang from the dragged shape
   (`updateHybridEnd` on pointerup / nudge / duplicate).
4. **Differential boundary snap**: at the A|B divider, the `◂|` end-flag snaps to
   the LEFT region's grid (clean ending for A); the start-tab zone snaps to the
   RIGHT region's units (B cannibalizes per its own grid). Piece-end `◂|` next to
   the double bar resizes the last region. Handle zones: 13px strips in the flag
   row (y ∈ GUT_T+1..+20) — known-small, candidates for enlargement.
5. **Free time is honestly free**: chronological regions draw ONLY a level-1 seconds
   grid (no subdivisions), snap to whole seconds, hide the bpm/sig/A4 ribbon
   (`#tempoGroup`), and show "free" flags. The `[meter|time]` toggle CONVERTS the
   active region's kind (seconds conserved, undoable); focusing reflects kind.
6. **Region creation only via slicing** (⌿ tool; target: time+pitch / time / pitch)
   — no "+" button. Slicing through a note creates a hybrid.
7. **Undo snapshots** include `{n:notes, r:regions, a:activeRegionId,
   p:pitchRegions, ap:activePitchRegionId}` (old plain-array snapshots still load).

## 6. ⚠ Known fragile pattern: the stale-controls clobber

`changed()` runs `syncRegionFromControls()` (DOM → active region) on every
mutation. **Any code path that mutates the region model without immediately calling
`applyRegionToControls()` gets clobbered by the next sync.** This bug shipped three
times (slice, moveBoundary, boot seed). All current mutation sites apply-first; any
NEW region operation must too. The durable fix (not yet done): make the model the
single source of truth and the controls a pure view.

Other gotchas:
- `bars` means seconds in chronological systems (overloaded field).
- `focusRegion` must not reset scroll (contiguous canvas).
- Multi-tempo flattening in the import adapter collapses by real seconds onto the
  Roll's grid; per-region import fidelity relies on resolver coords.
- index.html's y-axis mapping (log-Hz etc.) is computed locally; if the Roll ever
  wants identical *placement*, share that one helper — positional agreement
  matters, stylistic doesn't.

## 7. Verification methodology (keep doing this)

No browser automation here; the discipline that worked:
1. After every batch: **parse-check** every `<script>` in the HTML via `new
   vm.Script()` in Node.
2. **Extract functions by regex** from the HTML into a Node harness with minimal
   DOM stubs (use getter-based `settings` mirroring the real wiring — a static stub
   produced a false failure once), and assert the invariant (conservation,
   round-trip, geometry).
3. Schema changes: `jsonschema` accept/reject suites + re-validate all guide
   examples and index.html samples (backward compat).
4. Resolver: `/tmp/test.mjs`-style harness, 22 cases (determinate, relational→
   grounded resolution, cycles-as-valid, cross-chart time & pitch, achronous,
   offset/anacrusis, tempo ramp + lens).
5. The human (Xyh) feel-tests in the browser on localhost; logic-vs-feel split is
   explicit in every handoff.

## 8. Deferred work (prioritized, with the design already agreed)

**Near-term / unblocked:**
- **Horizontal & vertical scrollbars** (agreed good; pointer-first, no keys).
- **Transport upgrades**: pause/resume, scrub by clicking the ruler, loop-section
  (time-band → loop range), step; playhead as second selector → "split at playhead".
- **Multi-region playback & MIDI**: tempo map (Set-Tempo per region boundary;
  ramps integrate). Playback currently uses the ACTIVE region's tempo only.
- **Per-region cycla** (`.cyc` import per region) — sig is per-region but the
  cycle grammar/snap ladder is still global. Snap-as-order (depth into the cycla
  tree; pretty-named only when regular binary) is specced in both contracts.
- **Boundary-handle ergonomics**: bigger targets; full-height grab along dividers.

**The granular mode (chart model §§3–5, the big one):**
- **Per-point `hangsOn`** beyond the end-point (the attribute family with velocity,
  breath); explicit re-hang command; **lens-as-color** as the render rule (seed
  exists: the bruise ring on hybrid ends).
- **Lenses in the Roll**: non-extent tempo/pitch tabs per region, stacked above the
  span ("a row of browsers"); mirror-by-default; close-converts-to-seconds;
  decouple/re-pin ("resewing seams") for polytempo.
- **Pitch charts as full lenses**: pitch regions currently snap/UI only — making
  them hangable (notes pinned to a tuning span) and sliceable like notes
  (start in one region, end in another).
- **Offset UI**: origin drag (snapped, moves the ruler not the notes); lead-in /
  backward-extend of the piece start (contract says: offset on the first region or
  an inserted region — NOT touching the −∞ edge; a mirrored `|▸` start-flag was
  discussed, prototype after the end-flag feels right).
- **Merge prompt** (negative coordinates default vs renumber-from-last-whole-bar)
  — boundary drags currently always rebase; the offset-preserving variant awaits
  the offset UI.

**Language/resolver level:**
- `buildTempoMap` integrator: tempo ramps currently render + diagnose but do NOT
  warp child placement (base-bpm approximation, flagged).
- Conformance fixture suite (canonical .tab files + expected resolved output) —
  the artifact that makes Tabota portable beyond these two pages.
- First-class per-point hang in the language (today: endpoints via
  `extent.until {event, coord, lens}`; deeper allegiance rides in `payload`).

**Product/infra:**
- Desktop build (Tauri/Electron) someday — design stays pointer-first so keys
  arrive as accelerators, never requirements. Cross-device usability is a standing
  constraint.

## 9. Style & sensibility (preserve this)

Palette: paper `--abyss` greens, plum `--membrane`, dark-teal ink, with semantic
accents — teal `--tide` (structure/active), chartreuse `--algae` (points/holds),
pink `--membrane-pink` (glides), violet `--bruise` (cycles, hybrids, region
machinery), ember `--ember` (selection/warning). Fraunces italic display + IBM Plex
Mono. The owner likes that it reads as late-90s/early-2000s music software "done my
way, slightly twisted" — keep that quality; don't flatten it into a modern design
system. 田 is the logo motif.

## 10. How to work with the owner

Xyh thinks architecturally and philosophically first (poetry/composition
background); decisions emerge through dialogue, get named (the Conversion
Principle, the currency model, the golden rule, snapping≠hanging), then get encoded
as contracts BEFORE code. Honor that sequence: when a request hides a model
question, surface it, settle the contract, then build. Verify every layer in Node
before handing over; state plainly what was proven vs what needs browser feel.
Defer granular power honestly (named seams, flags present-but-collapsed) rather
than half-building it.
