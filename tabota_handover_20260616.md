# Tabota — Development Handover

*For future development sessions (human or LLM). Read this first; then the two
contracts. Last updated: June 2026, end of the **variable-tempo track** build
(curve engine + communication model + in-lane contextual editor).*

*Supersedes `tabota_handover_20260612.md`; §§1–3, 9–10 carry forward largely
unchanged. The new material is the tempo subsystem (§4.1, §5.8–5.13), the curve
vocabulary (§4.2), and the rewritten deferred list (§8).*

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

**New framing this build — the chart model made literal:** the score is **one event
over one global clock**, and *every* coordinate system — metric, chronological,
pitch, **and now tempo** — is a **chart over that clock**. A tempo chart and a pitch
chart are the *same kind of object*: a chart governing an axis across a span. This
is the seam the eventual unification rides on (§8, "B-layer").

## 2. The files

| File | Role |
|---|---|
| `tabota_schema.json` | JSON Schema (draft-07) for the language. Source of truth for the format. |
| `tabota_reference_guide.md` | Human-readable language reference (tempo/currency/lenses + migration notes). |
| `tabota-resolve.js` | **The shared interpreter** (ES module + `window.TabotaResolve`). `resolve(doc)` → `{nodes, frames, totalSec, datum, diagnostics}`. Both pages consume it. |
| `index.html` | Read-only **renderer** over the resolver. Draws a *wider* domain than the Roll. Exports the **visual score (SVG)**. No MIDI. |
| `tabota_roll.html` | **TaboTa Roll** — the interactive realizer/editor. Contiguous multi-region canvas, MIDI export, Web Audio playback, **variable-tempo track**. The big file (~3.7k lines). |
| `cycla_builder.html` | Builder for cycla (subdivision-grammar meter) files. |
| `tabota_chart_model.md` | **CURRENT authoring contract.** The atlas: one clock, charts over it, per-point `hangsOn`, snapping≠hanging, tiling-as-mode. |

**Deployment**: GitHub Pages; local testing REQUIRES a server
(`python3 -m http.server`, browse `localhost:8000`) because the resolver is an ES
module and index.html `fetch`es the guide. `file://` will not work. Hard-refresh
(`Ctrl/Cmd-Shift-R`) after edits.

## 3. Architecture (three layers, one interpreter)

```
                tabota_schema.json      (what is valid)
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
  can show. The Roll drops `point`, `ordinal`, `band`, `in-cycle`, `unplaced`;
  index.html draws nearly everything and annotates the rest.
- The Roll's **import** is an adapter over `resolve()` (`_notesFromV2`), legacy v1.5
  fallback. **Export** (`expJson`) serializes the region model to v2 directly. Its
  **MIDI/playback** engine is its own and reads `notes[]` — now fully seconds-based,
  so tempo curves are honoured automatically (§5.10).
- Resolver node format: endpoints carry `sec` + plural `coords[]` + `mode`; nodes
  carry `tags` that drive all receptors. `diagnostics` never throws — a paradox is a
  valid object, distinct from a `dangling` ref (error).

## 4. The Roll's data model

```
regions[]   : [{ id:'rN', name, main:'m', systems:[{ id:'m',
                kind:'metered'|'chronological', bpm, sigNum, sigDen, a4,
                bars,            // METERED: bars; CHRONOLOGICAL: seconds
                offset, axis,
                tempo:[ … ] }] }] // NEW — variable-tempo curve (§4.1)
activeRegionId : whose looks the controls show; clicking the canvas focuses
pitchRegions[] : [{ id:'pN', startSec, scaleId, regime:'scale'|'freq' }]
                 // NON-extent-defining y-axis charts; hang on a home time-region
                 // and RE-TIME with tempo now (§5.11); focused one drives globals
notes[]     : ONE global array. {
                id, region, hangsOn(='m'),
                start, dur,        // HOME region units (beats; seconds if chrono)
                end:{region,beat}, // OPTIONAL hybrid — hang AUTHORITATIVE, dur DERIVED
                type:'hold'|'glide'|'free', pts:[{t,hz,curve?}], vel, voice, curve? }
```

**Coordinate stack** (the heart of the contiguous canvas): `view.pxPerSec` is the
stored zoom. Primitives `secToX/xToSec`; tiling `regionSecLen/regionStartSec/
regionAtSec`; `beatToXin(b, region)` maps a region-local beat *through its tempo* to
the clock; `beatToX(b)` uses `_ctxRegion || activeRegion()` — `_ctxRegion` is the
trick that renders each note through its own region. **Seconds is the true axis;**
everything else is a chart over it. All cross-region operations work in **absolute
seconds**, with region-local coordinates as wrappers.

### 4.1 The tempo subsystem (NEW — the headline of this build)

A region's `m.tempo` is a region-local curve: `[{at, bpm, curve}]` where **`at` is in
QUARTERS** from the region start and **`curve` names the segment FROM this point TO
the next** (a point governs its *outgoing* line). Absent/empty ⇒ flat at the ribbon
`bpm`. The quarter is the **universal host clock**: 5/8 at ♩=120 is honest in seconds
(2.5 quarter-durations per bar); the denominator calibrates that clock, it does not
own duration (Cycla refuses to encode duration internally).

**The integrator** (`buildTempoMap` → `tmap`, cached, invalidated by
`tempoMapDirty()`): gathers maximal **metered runs** that share a quarter axis;
**chronological** regions break runs and are **frozen-duration opaque seconds
chunks** that slide in position but never stretch. Output is a piecewise timeline of
segments carrying `{sec0,sec1,q0,q1,bpm0,bpm1,curve,chrono}` that the renderer,
hit-testing, playback, MIDI export, and beat↔sec conversions all read.

**Two verbs** (keep these distinct — it's the whole grammar):
- The **♩= box / numeric entry RELABELS** a fixed span (the metric content is
  invariant; you're renaming the exchange rate).
- **Dragging a tempo point RE-TIMES**: the metric content is invariant, the curve
  re-maps quarters→seconds, the region's seconds-extent is *derived* and cascades
  downstream; chronological regions slide but don't stretch (proven).

**Communication / borrow**: a metered region with **no points of its own** BORROWS a
flat value from the nearest *pointed* metered region — **backward first** (taking its
exit), else **forward** (its entry). The scalar value **crosses chronological walls**;
slope never crosses (run endpoints are ±∞-flat). One pointed point can drive the
whole score. **Floor invariant** (`ensureTempoFloor`): if *all* metered regions are
empty, spawn one point at the first metered region using its ribbon bpm
(parity-preserving; fresh projects read 120).

**Geometry grammar** (point/line vocabulary): coincident-time points (≤, never cross)
= an instant **JUMP** (vertical segment; the integrator skips dq≈0); equal-value
points = a **HOLD** (horizontal segment); otherwise a **RAMP**. Legacy `'square'` and
any unknown curve degrade to a flat hold (`_isHold`). A region slice
(`splitTempo`) partitions the curve at the cut with an **interpolated seam value**, so
a cut through a mid-ramp stays continuous when the halves re-gather into one run.

**Deposit affect-mode** (`tempoAffect` ∈ neither|after|before|both): when a deposited
point **splits an existing line** A–B, which side adopts the deposit shape. Because a
point's curve governs its *outgoing* segment, this reduces to setting `A.curve`
(A→C side) and the new point's curve (C→B side). `after` is the natural default that
falls out for free; `neither` keeps both halves; `before`/`both` push the deposit
shape leftward. Wired to single-point deposits (hold/pen). The affect pill is parked
in the lane header for now but is a candidate to **promote** (it's relevant to note
drawing too).

### 4.2 Curve vocabulary — UNIFIED with note glides (a design change)

Tempo segments now share the **note-glide shape vocabulary** via the same `shapeK(k,
curve)` remap: **`linear` / `exp` (ease-in, k²) / `log` (ease-out, 1−(1−k)²) /
`smooth` (S-curve, k²(3−2k))**. Value interpolates by the shape:
`bpm(u)=b0+(b1−b0)·shapeK(u,curve)`.

The seconds map integrates `∫60/bpm`: **`linear` keeps an exact closed form**; the
eased shapes integrate **numerically** (Simpson N=32) with a **binary-search inverse**
for sec→quarter. This is general — adding a shape is just adding a `shapeK` case, no
new calculus. (Earlier the tempo `exp` was *geometric* `b0·r^u`; it was retired in
favour of the shared ease-in so the dropdown matches notes everywhere. Existing exp
ramps now read as the k² ease.) **Decision rationale:** consistency across the app's
two interpolating surfaces (pitch glides, tempo) outweighs the musical purity of the
geometric accelerando; this is the first concrete step of the B-layer unification.

### 4.3 The in-lane contextual editor (NEW)

The tempo lane header reshapes itself to the selection (the toolbar's far-away ♩=
felt disconnected):
- **one point** → `point · ←[curve before] · ♩=[bpm] · [curve after]→`. "before"
  edits the *previous* point's curve (it owns the incoming line); "after" edits this
  point's; bpm is editable inline. (The "before" dropdown is scoped to a point's
  *in-region* predecessor; cross-region "before" across a run-seam is deferred.)
- **a grabbed line** (`tempoSegSel` marks a segment grab vs a 2-point marquee) →
  `curve · [shape]`, editing that one segment.
- **several points** → `N points · ♩=[bpm] · [shape]`: **blank when mixed**, the
  value when uniform, **applies to all** on edit.

The toolbar's `♩=` mirror still works for a single point (note field repurposed; Hz
disabled — bpm isn't a frequency), mutually exclusive with note-point editing. The
deposit **shape** pill cycles all four curves; the **affect** pill is unchanged.

## 5. Invariants currently encoded (do not break)

1. **Conservation law**: every region operation conserves *seconds* and only
   rewrites labels. Slice, boundary-merge, relabel, kind-switch, hang-rebase,
   **tempo splitTempo** all capture absolute seconds first, mutate, then rebase.
2. **GOLDEN RULE** (`relabelActiveRegion`): the extent (seconds) changes ONLY
   explicitly. bpm/sig edits are *relabelings*: span fixed, bars remap, notes (and
   hybrid hangs) freeze in seconds.
3. **Hybrid hang authority**: structural ops treat `n.end` as authoritative and
   derive `dur`; geometry drags re-derive the hang from the dragged shape.
4. **Differential boundary snap**: at A|B, the `◂|` end-flag snaps to the LEFT
   region's grid; the start-tab zone snaps to the RIGHT region's units. Piece-end
   `◂|` resizes the last region.
5. **Free time is honestly free**: chronological regions draw ONLY a seconds grid,
   snap to whole seconds, hide the bpm/sig/A4 ribbon and the **tempo curve** (the
   lane shows them hatched, not gridded — no tempo there to author).
6. **Region creation only via slicing** (⌿ tool) — no "+" button. Slicing through a
   note creates a hybrid; slicing through a tempo ramp interpolates a seam.
7. **Undo snapshots** include `{notes, regions, activeRegionId, pitchRegions,
   activePitchRegionId}`; tempo curves and pitch hangs ride inside regions, so they
   travel through undo for free.
8. **Tempo is region-local in quarters** (`m.tempo[].at`); the quarter is the host
   clock; **bpm anchors to the quarter note** regardless of denominator.
9. **Two verbs are never conflated**: relabel (♩= box / numeric field) keeps span,
   re-time (point drag) derives span. (§4.1.)
10. **Playback & MIDI are seconds-driven**: `startPlayFrom` is fully seconds-based →
    curve-correct automatically; MIDI export builds a piecewise tempo timeline from
    region tiling (ramps stepped via `TEMPO_RAMP_STEPS`), chronological regions
    export as tempo 60 / 1-4. **MIDI's power-of-2 vocabulary never bends Tabota's
    internal representation** — MIDI is a permitted approximation.
11. **Pitch markers re-time with tempo**: pitch regions store a hang `{region,at}` on
    a home time-region and re-derive `startSec` each `changed()` (metered home
    re-times at the same beat; chrono home slides at the same sec-offset; opener
    pinned to 0). They are single hanging points; the next marker ends the span.
12. **Snapping ≠ hanging**: a lens extended into a span is a ruler to aim with; it
    does not change allegiance. `hangsOn` is a per-point attribute defaulting to null
    (home chart).
13. **Curve allegiance**: a tempo segment's shape is the *originating* point's
    `curve`; the boundary-split and seam-interpolation honour it (`_bpmAt` via
    `shapeK`).

## 6. ⚠ Known fragile pattern: the stale-controls clobber

`changed()` runs `syncRegionFromControls()` (DOM → active region) on every mutation.
**Any path that mutates the region model without immediately calling
`applyRegionToControls()` gets clobbered by the next sync.** All current mutation
sites apply-first; any NEW region operation must too. Durable fix (not yet done):
model as single source of truth, controls a pure view.

Other gotchas:
- `bars` means seconds in chronological systems (overloaded field).
- `focusRegion` must not reset scroll (contiguous canvas).
- **`_ctxRegion` must be reset to null** after per-region draw/measure loops (the
  tempo grid sets it per region too).
- **Tempo-map cache**: mutate the curve → call `tempoMapDirty()` before reading
  `tmap()`. In Node harnesses, `let _tmap` does NOT leak across the eval boundary —
  clear via the eval'd `tempoMapDirty()`, never a local `_tmap=null`.

## 7. Verification methodology (keep doing this)

No browser automation; the discipline that holds:
1. After every batch: **parse-check** every `<script>` in the HTML via Node
   `--check` (split the file on `<script>` tags first).
2. **Extract functions by regex** into Node harnesses (`/home/.../tt/`) with minimal
   stubs (getter-based `settings`; a static stub produced a false failure once), and
   assert the invariant. `extract_live.py` pulls the live integrator into
   `live_core.js` (now prepended with `shapeK`, which the curve engine depends on).
3. **Current tempo-track suite — 180 assertions, all green:**
   `verify_live` 29 (integrator/coords), `verify_slice` 18 (region+tempo slice),
   `verify_comm` 22 (communication/borrow), `verify_geom` 34 (jump/hold/ramp
   geometry), `verify_edit` 13 (group-move/clamps), `verify_pitch` 12 (pitch hang
   re-time), `verify_affect` 11 (deposit affect-mode mapping), `verify_curves` 41
   (linear-exact + exp/log/smooth vs independent numeric integration, partial/inverse
   roundtrips, legacy `square`=hold, flat-for-all-shapes).
4. Schema/resolver suites as before (accept/reject; resolver harness).
5. Xyh feel-tests in the browser on localhost; **the logic-proven vs needs-feel split
   is stated explicitly in every handoff.** Curve math, communication, geometry,
   affect mapping = proven; canvas gestures and header layout = need feel.

## 8. Deferred work (prioritized; design already agreed where noted)

**✅ Done this build (was "near-term" / "language level" last handover):**
- Multi-region playback & MIDI tempo map — **done**, curve-aware, seconds-driven.
- `buildTempoMap` integrator for metered runs — **done** (curve-correct child
  placement; the old base-bpm approximation is gone).
- Variable-tempo authoring — **done**: deposit tools (hold/glide/pen/free),
  select/erase, marquee with bands, slice, cross-region rigid move, communication,
  geometry grammar, affect-mode, the four curve shapes, the in-lane contextual editor.
- Pitch-marker hang re-times with tempo — **done** (§5.11).
- Lane snap grid extended down from the roll; end-of-piece bar softened to teal.

**Near-term / unblocked (carried forward):**
- **Horizontal & vertical scrollbars** (pointer-first, no keys).
- **Transport upgrades**: pause/resume, scrub by clicking the ruler, loop-section,
  step; playhead as a second selector → "split at playhead".
- **`buildTempoMap` full chronological tempo** — chronological regions are currently
  frozen opaque seconds chunks (no *internal* tempo curve). The curve evaluator is in
  place; a `buildTempoMap` integrator pass over chrono spans is the remaining piece if
  intra-chrono tempo is ever wanted (likely it shouldn't be — "free time is free").
- **Per-region cycla** (`.cyc` import per region); snap-as-order ladder.
- **Boundary-handle ergonomics**: bigger targets; full-height grab along dividers.

**The B-layer — the unification (the big one, now clearly seen):**
The cleaner seam than the tool layer is the **hang-and-edit layer shared across note,
tempo, and pitch**: all three "hang on a region and re-time," all three interpolate by
`shapeK`, all three want the same affect-mode and curve dropdowns. This build made the
curve vocabulary shared and proved the three hang models are the same shape.
*Decision: A now (native per-surface), B later* — do not half-build it. Concretely:
- **Promote affect-mode + curve dropdowns** to a surface-agnostic control (relevant to
  note drawing, not just tempo).
- **Per-point `hangsOn`** beyond end-points; explicit re-hang; lens-as-color.
- **Pitch charts as full lenses**: hangable (notes pinned to a tuning span), sliceable
  like notes; stacked tabs ("a row of browsers"); decouple/re-pin for polytempo.
- **Lazy margin region** (parked, design agreed): drawing past the end-stop as a
  composer's scratch-pad — lazy/implicit (materializes when notes drag past the
  end-stop, evaporates when dragged back), non-extent-defining, never exported to
  MIDI, immune to tempo, margin-crossing notes clip at the end-stop. NOT built.
- **Offset UI**: origin drag; lead-in/backward-extend (mirrored `|▸` start-flag,
  prototype after the end-flag feels right). **Merge prompt** awaits it.

**Language/resolver level:**
- **Conformance fixture suite** (canonical `.tab` files + expected resolved output) —
  the artifact that makes Tabota portable beyond these pages. **Identified as the key
  next step toward genuine portability.** Not yet built.
- First-class per-point hang in the language (today endpoints via
  `extent.until {event, coord, lens}`; deeper allegiance rides in `payload`).

**Product/infra:**
- **Open-sourcing** (copyleft) — analysis leaned *for*: a solo maintainer is the
  highest bus-factor risk; publishing the schema + conformance fixtures makes the
  format survivable beyond any one person; open source's inspectability is an argument
  *for* publishing (the xz-backdoor risk profile doesn't transfer — Tabota isn't a
  transitive dependency in critical systems). Set expectations at README level early;
  expect others to build entirely different interfaces (incl. 3D) — Tabota Roll is one
  client, not the canonical one.
- **Desktop build** (Tauri/Electron) someday — design stays pointer-first so keys
  arrive as accelerators, never requirements.

## 9. Style & sensibility (preserve this)

Shared palette with semantic roles: paper ground, plum panels, dark-teal **ink**,
accents — teal `--tide` (structure/active), chartreuse `--algae` (points/holds/tempo
curve), pink (glides), violet `--bruise` (cycles, hybrids, seams), ember `--ember`
(selection/playhead/warning). Fraunces display + IBM Plex Mono. The owner likes that
it reads as late-90s/early-2000s music software "done my way, slightly twisted" — keep
that quality; don't flatten it into a modern design system. 田 is the logo motif.

## 10. How to work with the owner

Xyh thinks architecturally and philosophically first (poetry/composition background);
decisions emerge through dialogue, get **named** (the Conversion Principle, the
currency model, the golden rule, snapping≠hanging, the two verbs, communication/borrow,
the geometry grammar), then get encoded as contracts BEFORE code. Honor that sequence:
when a request hides a model question, surface it, settle the contract, then build.
**Development-by-development**: build on verified lower layers before adding visible
features. Verify every layer in Node before handing over; state plainly what was
proven vs what needs browser feel. Defer granular power honestly (named seams, flags
present-but-collapsed) rather than half-building it. Pointer-first, cross-device — no
keyboard-modifier-required interactions.
