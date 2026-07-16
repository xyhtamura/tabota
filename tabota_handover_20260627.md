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
| `roll/index.html` | **TaboTa Roll** — the interactive realizer/editor. Contiguous multi-region canvas, MIDI export, Web Audio playback, **variable-tempo track**. The big file (~3.7k lines). |
| `cycla/builder/index.html` | Builder for cycla (subdivision-grammar meter) files. |
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
        index.html               roll/index.html
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

**The B-layer — the unification (the big one; seam now cut into stages):**
The cleaner seam than the tool layer is the **hang-and-edit layer shared across note,
tempo, and pitch**: all three "hang on a region and re-time," all three interpolate by
`shapeK`, all three want the same affect/curve controls. The curve vocabulary is already
shared; what remains is duplicated *above* the math — note and tempo each hand-implement
the same six tools (`hold/glide/pen/free/select/erase`) and fork the controls three ways
(`curveSel` vs `tempoCurveBtn`+`teBefore/teAfter`; affect is tempo-only). *Decision:
in-place unification (NOT ES-module extraction yet — Binlod isn't being integrated soon),
done in two cuts so nothing half-builds.*

**THE COMMENSURABILITY RULE** (new law, sibling to Conservation): *an edit applies
simultaneously across exactly the objects that share the numéraire being edited.* Seconds
(time) and curve-shape (unitless `shapeK`) are universally shared → they co-edit the whole
selection. A value-axis is shared only among objects under the **same lens**: two Hz notes
co-move in pitch; an Hz note and a bpm tempo point do not (no exchange rate — the model's
job is that the question is never asked). The dragged object's lens names the value-numéraire
in play. Today this collapses to "same panel" (one lens per panel); it generalizes when
CC/f(x) lenses arrive. *Open future Q (parked):* do CC/f(x) values merit their own
instantiated panels, keeping one-lens-per-panel true?

**Selection vs. active surface** (two distinct things; conflating them was the confusion):
*Selection* is global, heterogeneous, spans surfaces, built by the existing
include/exclude/replace mode (pointer-first, no new gesture), and persists — multiple curves
across panels is a *feature* because it's explicit. *Active surface* = the surface owning the
value-axis right now (the grabbed object's lens). "Go back" = touching an
already-selected-but-inactive object on a surface re-activates that surface without rebuilding
its selection (per-surface: touching the tempo selection makes tempo active; the note
selection stays selected-but-inactive).

- **Cut 1 — DONE (2026-06-27):** depositCurve+depositAffect unified; one write
  path (applyCurveToSelection) over the cross-surface union; tempo-select honors
  selMode (replace clears both, include/exclude preserve other); applyAffect
  generalized → note inserts gain affect-on-insert. Kernel proven in Node (25/25
  + 5 affect). Browser feel-test pending. Next: Cut 2.
- **Cut 2 — synced move / hang (NEXT, value+time):** time-drag co-moves the whole selection in
  seconds; value-drag moves only the same-lens subset (commensurability rule); active-surface
  Y-ownership + touch-to-reacquire. Delivers "the music speeds up exactly when this note fires."
  NOT built this cut.
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


**Backlog / deferred (captured 2026-06-27, post-Cut-1):**
- [Cut-2-adjacent] Selection legibility: a selected tempo line segment needs a
  select aura (notes have one). Generalizes: a focused / active-surface element
  must read as visibly distinct from a merely-selected one — the rendering that
  keeps cross-surface confusion from returning.
- [drawing-tools] Split the overloaded `select` tool into three actions:
  (a) select + move + delete only; (b) create new note/event/curve; (c) add/
  subtract points on an existing curve. Today (c) lives inside select, so points
  get moved by accident because select also moves. Resolves in the drawing-tools
  consolidation; sharpens after Cut 2 (which amplifies the accidental-move cost).
- [done in Cut-1, re-homes later] Note affect-on-insert is already wired; it
  belongs conceptually to tool (c) above and migrates there when (c) is built.
- [independent] Hover scope: live x/y readout under the cursor (time / pitch|bpm),
  likely top-right; frees that corner from bend.
- [format] Export-settings bar: bend range, base channel, program, etc. are MIDI-
  EXPORT settings, not Tabota notation. Group as saved export settings, surfaced
  before export, written into `.tabota` — making `.tabota` double as a Tabota Roll
  project file. Multi-program merge of the master file = real but future (field notes).
- [tech-debt] Snap: accrued debt from grid/tempo mechanics changes. Underlies
  deposit + move precision, so Cut 2's time-drag rides on it — characterize before
  leaning hard on snapped time.
  
  **Region removal (drawing-tools / region-tool phase, captured 2026-06-27):**
Two mechanisms, and a clean distinction between them:

1. Eclipse by overlap (destructive): drag a region fully over another → the
   eclipsed region is deleted. BUT eclipse by the score-end mark is NON-destructive:
   if the end-of-score mark is dragged over a region, or a region marker exceeds the
   score mark, that marker stops rendering but continues to exist (clipped, preserved
   — distinct from deletion).

2. Delete action (eventually folded into a global split/join/delete tool that also
   works on notes). Semantics:
   - Delete = a merge that keeps only ONE coordinate system: the deleted span adopts
     the NEIGHBOR's system (pitch if pitch, temporal if temporal) and drops its own.
   - Default = swallow by the region behind (predecessor). A,B,C  delete B → A,(A),C.
   - Selecting the FRONT region's flag instead = swallow by successor: A,(C),C.
   - No region behind → take the region in front. A,B  delete A → (B),B.
   - Only one region in the score → undeletable.
   - Contrast with MERGE/join: same gesture family, but merge RETAINS BOTH coordinate
     systems (the heterogeneous paddy). Delete collapses to one; merge keeps both.

OPEN Q: does the swallowed span "(A)" remain a distinct re-pinnable region slot
borrowing the neighbor's system, or does it truly fuse (neighbor simply grows over
the span)? The parenthetical notation implies distinct-but-borrowing. Decide at build.

A: It is a true fusion. The parenthesis is just there to indicate length, to be very certain. This is to disambiguate:
with A, B, C, : delete B → A, C. can look like region B & its contents are both deleted. Here, with delete B → A,(A),C. 
region B as a coordinate system is deleted, but its contents are not: they are rehung or rehomed into region A.

WARNING: region-model mutation must obey the stale-controls rule —
applyRegionToControls BEFORE syncRegionFromControls, or the next sync clobbers it.

**Cut 2 (cross-surface synced move w/ tempo) — DEFERRED 2026-06-27.**
Decision: disable note↔tempo synced move for now. Tempo manipulates time, so it
can't ride a synced move without picking a re-timing model. Current behavior is the
intended one: notes/events move together (existing group move); tempo moves alone;
user does the two separately. NOT a bug — expected. (Note: cross-surface SELECTION
from Cut 1 still works; only the synced MOVE is excluded.)
When revisited, the unresolved fork is the time numéraire:
 (a) musical-time-as-temporary-numéraire — move in quarters (note+tempo welded in
     beat-space, "speeds up when this note fires"), recompute seconds afterward; or
 (b) tempo-change-as-event-in-seconds — the change "starts at time X"; a move takes
     it to "X−m", seconds-locked, coincidence not preserved under re-time.
Lean was (a). Within-region only; cross-region needs the score-aware clock first.

**Roadmap re-sequence (2026-06-27):**
- B-layer Cut 1 — DONE.
- Cut 2 (tempo-coupled move) — DEFERRED (above).
- NEXT TIER (reprioritized above Cut 2):
  1. Snap overhaul — snap to grid under new tempo/region mechanics; handle custom
     rhythms beyond quarter/eighth (Cycla grammar into the snap layer). Foundational:
     drawing + region + move all snap. Absorbs the snap tech-debt item.
  2. Drawing-tools consolidation — tool-taxonomy split (select=move/delete only;
     create; add/subtract points); pen/splines; note affect migrates to add/subtract
     tool. ABSORBS region management (deletion spec already captured).
- Snap looks like the natural first (unblocks the other two).

---

## SNAP OVERHAUL — contract (settled 2026-07-03, before code)

Diagnosis (owner + code read): the snap layer is **split-brain** — carries tech debt
from the variable-tempo + region builds, which added curve-aware coordinates and a
per-region renderer but never updated snap to match.

**Confirmed live defects (not merely latent):**
1. **Flat back-conversion** — `snapSecToChart` snaps in curve-aware beat space then
   converts back to seconds FLAT (`s0+snapped/unitsPerSec`), so the snapped second ≠
   the drawn (curve-aware) gridline under any tempo ramp. Every consumer inherits it:
   note `move`/`segMove`/`ptMove`, `moveBoundary`, pen/tempo deposits, seek.
2. **`drawTimeGrid` is DEAD CODE** — the only cycla-phase renderer; nothing calls it
   (only `drawAllGrids` runs, and it draws a flat lattice via `gridStepUnits`). So a
   non-even cycla loaded on the active region **snaps to indispensability phases while
   the screen draws a plain lattice** — snap≠grid today. The dead fn is the fossil of
   the region-build swap that dropped cycla rendering.
3. **Cycla is a GLOBAL** (`activeCycle`/`view.timeRegime`), not per-region; only the
   active region can show/snap cycla. Blocks per-region cycla.

**Decisions (owner):**
1. **Leader-snap** for group move: the grabbed object snaps to grid; the rest follow
   rigidly in SECONDS (the shared numéraire — Commensurability-consistent).
2. **Frozen ruler** for tempo drag: snap reads the PRE-DRAG tempo map; the visible
   ruler may shift as the drag re-times, but the pre-move ruler is the de-facto snap
   target until release. Release/re-grab re-reads. **Double-tab region system SHELVED**
   (elegant but unnecessary here); a **double-arrow beside the tempo point** is parked
   as a possible future re-read affordance.
3. **Cycla is the SOLE snap grammar.** Even note-values (♪/♩) are just specialized
   indispensability orders (1st/2nd-order); the flat lattice becomes a *trivial cycla*.
   `snapBeat` is parameterized by region; cycla promoted to per-region storage.
4. **Chronological snaps to WHOLE SECONDS** everywhere ("free time is honestly free").
5. **New invariant (sibling to Conservation/Commensurability) — THE GRID LAW:** *snap
   targets are exactly the drawn gridlines.* Renderer and snapper consume ONE source.
   Sole exception: during a frozen-ruler tempo drag (#2), which resets to true on
   release/re-grab. This is the acceptance test for the whole overhaul.

**Build order: Stage 1 → Stage 2 (owner-confirmed).** Backup at `tabota_roll - b.html`.
- **Stage 1 — curve-aware plumbing.** Fix `snapSecToChart` flat return; audit + fix
  the flat math in `move`, `segMove`, `ptMove` (→ leader-snap), `moveBoundary` (bars
  derived via curve-aware inverse, not `width/regUnitSec`). New Node suite `verify_snap`:
  snapped-sec == gridline-sec under linear + eased ramps, across boundaries, chrono
  islands, group-move leader alignment. Fixes the curve-distortion class against the
  CURRENT lattice/cycla split.
- **Stage 2 — one grid, one grammar.** Delete dead `drawTimeGrid`; promote cycla to
  per-region; re-express even lattice as trivial cycla; single `regionGrid(region)`
  feeds BOTH renderer (`drawAllGrids`, `drawTempoGrid`) and snapper (`snapBeat`) —
  makes THE GRID LAW structural (one source can't diverge). The pre-existing cycla-render
  bug falls out fixed for free; cuts the per-region-cycla seam.
- Stage 3 (gestures) / Stage 4 (browser feel) as scoped.

### Stage 2 — DONE (2026-07-03), one grid one grammar; core Node-proven + browser smoke
THE GRID LAW is now **structural**: `regionBarGrid(r)` is the SINGLE per-bar source
(phases in [0,1) + render levels) consumed by BOTH the renderer and the snapper, so a
drawn line IS a snap target by construction — they can't diverge. Edits in
`roll/index.html`:
1. `snapSecToChart` collapsed to `beatToSecIn(snapBeat(secToBeatIn(sec,r),r),r)` — one
   path, **no active/non-active asymmetry** (that structural debt is gone).
2. `regionCycle(r)`/`regionCycDepth(r)`/`regionBarGrid(r)` added; `snapBeat(b,r)` is now
   region-parameterized (reads the region's OWN cycla; chrono → whole seconds).
3. Even lattice re-expressed as a **trivial cycla** (isochronous phases at `gridStepUnits`).
4. `drawAllGrids` metered branch + `drawTempoGrid` both draw from `regionBarGrid` per bar,
   level-weighted. **Dead `drawTimeGrid` DELETED** (the orphaned cycla renderer / the fossil).
5. Cycla promoted to **per-region storage** (`m.cycleId`, `m.cycDepth`): `makeRegion`,
   `syncRegionFromControls` (writes them), `applyRegionToControls` (restores them on tab
   switch/import). `setActiveCycle` needs no change — it sets the globals then `changed()`
   runs the updated sync. Old regions without `cycleId` default to `even` (back-compat).

**Proven (Node, 1877 assertions):** `verify_grid` 1230 — GRID LAW (snap lands on a
rendered line) for even/tresillo/son32 × flat/ramp × 5-8; per-region grammar (region A
even + B tresillo each snap to their own grid); **active/non-active symmetry** (snap in a
region identical regardless of which is active); even parity (== old round-to-step) +
odd-meter (5/8) parity. `verify_snap` 430 + `verify_consumers` 217 still green. All 4
`<script>` blocks parse-check. (Harness `snap_core.js` mirrors the live functions.)

**Browser smoke (localhost:8127):** page loads with NO console errors; grid renders across
metered 4/4 + chronological + 5/8 regions; switching the active region's cycle to Tresillo
updates header + region-time pill and redraws cleanly through the new per-region render path.

**Needs your feel (xyh):** indispensability phase *spacing* legibility; snap-to-phase feel;
per-region grid reading when adjacent regions carry different cyclas.

**DEFERRED (follow-ups, documented):**
- **Cycla doesn't round-trip through export yet.** `expJson` serializes an explicit `frame`
  and omits `cycleId`/`cycDepth` — consistent with cycle/scale being *rulers* (snap≠hang),
  but it means per-region grids are in-session only. Should ride in `payload` (like `tempo`
  does) so a Roll *project* file restores its per-region grids. Ties into the
  export-settings / .tabota-as-project-file item (field note 20260627). Owner's format call.
- Time-label strip (`draw`, ~L1735) still uses global `settings`/`timeRegime` for bar
  numbers — active-region-relative labels, pre-existing simplification, out of Stage-2 scope.

**Stage 3 addendum — tempo-point horizontal nudge (settled 2026-07-03):**
Decision #2 "frozen ruler" is NOT built — the snap is done in quarter-space (the
invariant host clock), so the ruler doesn't truly move under re-timing; feel is fine.
Kept a collapsed seam; double-tab stays shelved. The real item is accidental *vertical*
(bpm) drift when the user wants horizontal-only. Build in Stage 3:
- **← → horizontal-only nudge** in the contextual lane header when tempo point(s)
  selected; moves `at` only, bpm untouched. **Distinct controls** from the existing
  `←[curve before]`/`[curve after]→` (which pick a segment's curve — do NOT overload).
- snap ON → step to adjacent grid cell; snap OFF → step by a **user-definable time
  increment** (new small field in the lane header).
- multi-point selection → **follow the leader** (leftmost or rightmost point), rigid in
  quarter-space (same leader-snap logic as Stage 1 ptMove).
- point creation via nudge NOT here — handled later by the split tool (drawing-tools).

### Stage 1 — DONE (2026-07-03), logic-proven in Node
Fixed the flat-back-conversion class. Five edits in `roll/index.html`:
1. `snapSecToChart` return → `beatToSecIn(snapped, r)` (curve-aware; THE GRID LAW root).
2. `move` (single note) → start-in-seconds + drag, snap, `secToBeatIn` back; metric
   content (dur beats) invariant; content clamp in beats. Start is the leader.
3. `segMove` → seconds delta (was flat `pxPerBeatIn`); each endpoint snaps in seconds.
4. `ptMove` (group) → **leader-snap**: `startGroupMove` captures the selected point
   nearest the grab as `leadSec`; the handler snaps the leader to a gridline and moves
   the whole selection by that one **seconds** delta (Commensurability-consistent).
   Neighbor/content clamps re-expressed in seconds (guard min-step left flat — invisible).
5. `moveBoundary` → bars derived as the metric content each new second-span holds under
   the region's OWN curve (`secToBeatIn`), not `width/regUnitSec`.

**Proven (Node, 727 assertions):** `verify_snap` 510 — snapped-sec == drawn-gridline
under linear/exp/log/smooth ramps, active + non-active regions, odd meter (5/8), chrono
whole-seconds; harness self-checks by reproducing the bug under a FLAG-OFF build first
(364 live fails) then eliminating it. `verify_consumers` 217 — move/segMove land on grid;
ptMove leader on grid AND seconds-rigid (incl. the ramp sanity: beat-deltas DIFFER while
seconds-deltas are equal — proves it's seconds-rigid, not beat-rigid); moveBoundary
lands the boundary where dragged and conserves every note's absolute seconds across
flat|flat, ramp(L)|flat, flat|borrow, flat|chrono. All 4 `<script>` blocks parse-check.

**Needs browser feel (xyh):** the drag gestures themselves — does leader-snap feel right
when grabbing a group mid-ramp; boundary drag under a ramp.

**DEFERRED out of Stage 1 (documented at the code site):** `moveBoundary` does NOT
re-anchor the RIGHT region's tempo curve when its start moves (tempo stays anchored at
region start). A right region with a *leading interior ramp* shrunk/grown from the left
is underspecified — same seam as `splitTempo`; belongs to the region-tool phase. Flat,
borrowed, and trailing-ramp cases are exact. (`regUnitSec` is now unused — left in place;
remove when convenient.)

---

## DRAWING-TOOLS CONSOLIDATION — contract (settled 2026-07-11, before code)

Next roadmap item after snap. Splits the overloaded `select` tool. Owner call:
**maximum separation** — the graphic-software two-arrow model (Illustrator black/white
arrow), not aliquoto's lighter select/move/place (aliquoto is a flat single-point
partial domain; Roll notes are multi-point curves + segments + endpoints — richer,
graphic-software kinship).

**The two arrows + create:**

- **▣ select — black arrow. WHOLE-NOTE (object) level ONLY.** Click note → select+move
  (rigid, all points). Click an end-handle → **time-only resize** (dur/start; pitch
  FROZEN — owner fork (i), 2026-07-11). Marquee selects whole notes. Delete = whole
  notes. **Never selects or moves a lone point/segment.** This is what kills
  accidental-move by construction.
- **⋯ point — white arrow [NEW]. Sub-object, on an existing curve.** Disambiguate by
  WHAT IS HIT (vector-pen convention), NOT by repurposing the +/− chips:
  - hit a **point** → select + move (full time+pitch; the old `resize`/`ptMove` logic;
    setops via shift/alt as today).
  - hit a **segment/body** (not a point) → **ghost-add** (see mechanic below).
  - **double-click a point** → delete (migrated from select's dblclick, gated to point).
  - empty space → marquee (point selection).
  - `applyAffect` (affect-on-insert) lives here now — it's a point-insert property.
- **create (b)** — hold/glide/pen/free UNCHANGED this cut. (Pen already builds a curve
  point-by-point → conceptual overlap with point-add; park "pen = point-tool on a fresh
  curve" as a future merge, not now.)

**SELMODE unchanged:** replace/+/− stay meaning selection SET-OPS in *both* tools (no
per-tool reinterpretation — that was rejected as confusing). Add/delete ride on
hit-kind + dblclick instead.

**Named mechanic — "tentative point / ghost-drop" (owner, 2026-07-11):** adding a point
does not commit on click. Press on a curve body inserts the point AND the same held
drag repositions it live (reuse the existing `resize` interior-point branch); the point
renders **translucent/ghost** until **release commits** (undoable). Release-without-move
= plain add at the click spot. Lets the user feel the added point's effect before
committing. **Cross-project:** port the same tentative-add to aliquoto's `place` tool;
log in DEPENDENCIES.md as a hand-synced interaction pattern (like `rnd()`), no shared
runtime file.

**Dropped / deferred this cut:**
- **`segMove` (drag a whole segment)** — dropped in the point tool; click-segment now
  ADDS a point (the more useful vector action). segMove was niche; revive under a
  modifier later if missed.
- **Region delete-as-merge** (swallow-by-neighbor; spec ll.406–432) — follow-up cut;
  eclipse-by-overlap already shipped (2026-07-10). Not this cut ("select more important").

**Scope this cut:** select→object-only + the new point tool + ghost-add. Nothing else.

**Verify (owner method):** tool→hit ROUTING is pure dispatch → Node-provable (which tool
claims which hit; select never returns a point/segment target; ghost-commit path ==
direct-insert path; point tool reproduces the old reshape numerics). Reshaping *feel*,
ghost-drag legibility, the frozen-pitch resize ergonomics = browser feel-test. State the
proven/feel split in the handoff, as always.

### Stage 1 — DONE (2026-07-11), logic-proven + browser smoke
Select→object-only (end-handle = time-only resize, pitch frozen; marquee = whole notes);
new `⋯ point` tool (key A): point=select+move, body=ghost-add (tentative, release
commits, `--algae` translucent render), dblclick point=delete via `removePoints`; SELMODE
untouched. `segMove` dropped (body-click = add). `resize` drag gains `freezePitch`.
Proven: all script blocks parse; page loads clean, no console errors, tool switch
verified via DOM; Node harness `verify_pointtool.js` 12/12 (freezePitch guard, ghost
insert-index interior). NOTE: app is IIFE-wrapped (`'use strict'`) → injected-script
automation can't reach internals; gesture feel remains a hand test, by design.
**Needs feel (xyh):** select/point separation in the hand, ghost legibility, frozen-pitch
end-resize, dblclick delete. Aliquoto ghost-add port = its own aliquoto session (owner).

### Cut 2 Stage 1 — TYPE-KILL — DONE (2026-07-14), logic-proven + browser smoke
Settled with owner before code (selection-as-scope zoom-in): draw modes stay **explicit**
chips (hold/glide/pen/free) — no gesture inference, mobile-first. `type:'hold'` **killed
outright** — it never reached the format anyway (schema has no note types; export already
keyed on shape, import synthesized hold from flat pitch). Three forks settled: (1) **min-2
points** — a note is always a ≥2-point curve; `removePoints` deleting to 1 now removes the
note (was `collapseToHold`). (2) **No flat differentiation** — notes were already colored by
VOICE not type, so nothing to change; the `━ hold` chartreuse visual was type-fiction. (3)
**No legacy** — no old Roll scores exist, so `type` is deleted, not migrated.

The move: **the 1-point degenerate ceases to exist.** A flat note is now 2 points at equal
hz; every `type==='hold'` special-case (hit-test, selectHit, marquee, resize, render, point
editor) was there to handle the 1-point geometry and simply **deletes** — the general
2-point path subsumes it. `pitchAt` now **always** applies `shapeK` (linear = identity), so
glide-vs-free collapses: a note bends where a segment carries a `curve`, stays linear where
it doesn't. Export reads shape from points (2 equal → `{pitch:{hz}}` compression kept; 2 →
from/to; >2 → contour). Both Tabota readers + MIDI import make flats 2-point. Dead `holdEdge`
removed. `hold` tool now deposits a flat 2-point note (drag sets length, pitch level);
point-tool body-add on a flat note bends it → **hold→glide is gestural** (contract's free win).

Proven: both `<script>` blocks parse clean; `parity.cjs` 35/35 against the REAL exported
`pitchAt`/`buildMidi` (flat==old-hold constant; curve always-applies == old glide & ==
linear for free; multi-point per-seg curves; flat MIDI = no bend motion) + mirrored
`removePoints` (delete-to-1 → remove), export shape, and export→import→export round-trip.
Browser smoke (localhost:8131): boots with the 13-note seed, **zero console errors**, notes
render (voice-colored contours); synthetic hold deposit → note reads **`flat`** (13→14);
point-tool body-add into a flat note commits with no spurious note + no errors. Canvas is
0-width until a post-load resize fires (offscreen flex timing) — a preview-harness quirk,
not the page; screenshot tool hangs on it, so smoke used pixel-sampling + status/DOM reads.
IIFE `'use strict'` still walls injected automation from internals; gesture feel = hand test.

**Format note:** `.tabota` OUTPUT is unchanged for flats (still `{pitch:{hz}}`) → **no
DEPENDENCIES.md contract touched** (schema/resolver/CSS all untouched). Only tidy: a
multipoint note with explicitly-linear segments no longer emits `curve:'linear'` (omitted =
linear by default; round-trip stable). No legacy files to break.

**Needs feel (xyh):** hold deposit (level-lock during length drag); the flat→bent gesture
(body-add legibility on a flat line); point-delete down to 2 then the removal at 1; that
notes with no more type read/behave the same in the hand.

**NEXT (Cut 2 continued):** the verb re-cut — select (scope-binder) / move / draw
(scoped-by-selection HARD LAW + target pill + auto-select toggle default OFF) / erase (kept
as-is for now, owner: revisit "quite further down the line after draw + regions"). Point
tool dissolves into move+draw; machinery (`freezePitch`, ghost-add, `ptMove`, `removePoints`)
survives underneath. Then band axis-lock (xy/x/y). `type:'hold'` in schema/export = moot now.

### Cut 2 Stage 2 — THE VERB RE-CUT — DONE (2026-07-14), logic-proven + browser smoke
Selection-as-scope is BUILT. Two forks settled with owner before code: **free-onto-existing
= REPLACE the swept span** (aliquoto OVR/bake prior art; merge rejected — a scribble means
redraw); **pen-onto-existing = per-tap commit** (each tap its own undo step; no finalize —
the curve already exists).

**Toolbar now:** `▣ select · ✥ move · ✎ draw [━╱✎∿ mode chips] · ⌫ erase · ⌿ slice · ✋ pan`
plus `⊘ deselect · ⊞ select-all` (pointer-first), the **TARGET PILL**, and `◎ auto`.
Keys: V/M/D tools, H/G/P/F jump-to-draw+mode, S slice, **Esc = deselect**; Ctrl-D stays
duplicate (contract wanted Ctrl-D deselect — occupied, Esc + ⊘ serve instead). Point tool
DELETED from the layer; its machinery survives (ghost-add → draw, point-move → move,
dblclick-point-delete → move, `freezePitch` → both).

- **select** = pure binder, never moves. Click point→granular, body/aura→whole, marquee→
  points with full-coverage promotion (`mergeSel`, unchanged). Set-op chips live here only
  (they DIM under other verbs). **Selection persists across tool switches** — `setTool` no
  longer clears it; that clearing was the anti-scope fossil.
- **move** = translate the scope. Drag anywhere moves it (leader-snap seconds-rigid `ptMove`).
  **Scope decides an end-handle:** whole-note selected → time-only resize (pitch frozen);
  granular → full point move. Empty scope + auto OFF → refusal flash.
- **draw** = deposit, scoped. HARD LAW enforced: scope present ⇒ deposit INTO it, never a
  new note; click outside the scope's extent ⇒ refusal flash naming ⊘. Per-mode onto-existing:
  hold = ghost point GLUED to the curve's pitch (drag repositions time only — the level
  arity); glide = Stage-1 ghost-add (free reposition, release commits); pen = per-tap commit;
  free = sweep, release REPLACES the swept span (extent invariant, outside curves preserved,
  ember-dash ghost preview during the sweep). New-note deposits (empty scope) unchanged.
- **auto-select (◎, global, default OFF)**: ON ⇒ cursor proximity is authoritative for BOTH
  move and draw; it rebinds the scope to what it grabs; no curve beneath ⇒ draw makes NEW.
- **TARGET PILL** states the consequence: `draw → NEW` / `draw → note N` / `draw → sel (k)`;
  `move → …`; `scope: …` under select. Live hover readout in auto mode.

**One real bug found & fixed during smoke:** `depositTargetAt` first tested extent in
TIME-space (`xToBeatIn` vs `n.start`), which diverges from the renderer for notes extrapolated
past their home region's end — deposits into such notes were wrongly refused. Fix: containment
tests **rendered px** (`beatToX` under the note's own chart) — the target is exactly what is
drawn, sibling of THE GRID LAW.

**Proven (Node, `verify_verbs.cjs` 30/30 — extracts the LIVE functions from the HTML):**
hard-law target resolution (selected-only, topmost-wins, outside→null/refuse, ptSel-only
scope binds); hold-glued deposit (cursor pitch ignored, freezePitch drag, ghost set); glide
vs pen same insert geometry (pen committed via pushHistory, no drag session); extent
confinement (t clamped strictly interior, extent unchanged); free-onto replace-span (inside
points die, outside survive with their curves, sampled land, t monotonic in [0,1], extent
invariant); bare-tap/zero-span no-ops. Plus `parity.cjs` 35/35 still green; both script
blocks parse-clean. **Browser smoke (localhost:8131, zero console errors):** boot state
(draw/hold active, pill `draw → NEW`, chips dimmed); draw-new → pill tracks; hard-law
refusal outside extent (no note created); glide-into (ghost hz live in the point editor,
flat→curve); pen-into two taps; free-onto sweep; select binds (whole + granular `+1pt`);
move translates with `move` cursor; Esc deselects; empty-scope move refusal; auto-select ON
grabs the note under cursor. NOTE: smoke coordinates must respect SNAPPED note starts and
region spans — two "failures" during testing were bad probe coords, not bugs (hover-scan
the rendered span first).

**Needs feel (xyh):** the whole verb hand — bind-then-verb rhythm vs the old modal tools;
hard-law tax (deselect before new) in real composing; pill legibility/placement; hold-glued
vs glide-free deposit distinction; free-sweep replace vs expectations; auto-select ON as a
working mode. Dormant machinery kept intentionally: `mode:'move'` + `segMove` drag handlers
and `ptSelHas` are currently unreachable (named seams — revive or cull later).

**NEXT:** band axis-lock (xy/x/y renames + move DOF filter — small, scoped). Then regions
(delete-as-merge spec is settled, ll.406–432). Erase's fate stays parked by owner call.

---

## THE TOOL MATRIX — open design note (2026-07-11, thinking, NOT settled)

Owner insight, post-Stage-1. **Do not build from this yet** — it reframes the create
consolidation and needs contracts settled first. Captured so the thinking survives.

**Two orthogonal axes, currently welded together in the tool buttons:**
- **Gesture axis** — *how does my gesture deposit?* hold/glide/pen/free are not four
  tools; they are **arities**: 1-tap, 2-drag, N-tap, sampled. Universal grammars.
- **Target axis** — *what does my gesture affect?* new event / existing event / region
  / (tempo, pitch — the B-layer surfaces). Point-vs-draw are TARGET answers, not
  gesture answers.

Today's tools = frozen cells of the matrix: hold/glide/pen/free = (arity, target=NEW);
the point tool = (1-tap, target=EXISTING points). The unfrozen cells are real wants:
free-draw new points ONTO an existing curve; draw endpoints that GUIDE an existing
event. The matrix predicts they should exist; no tool exposes them today.

**Illustrator re-examined — NOT actually explicit.** Pen morphs by *hover proximity*:
over segment → add-anchor, over anchor → delete-anchor, over endpoint → continue path,
elsewhere → new path. Implicit modality — the same accidental-action disease Stage 1
killed in select. Illus is precedent for the gesture GRAMMARS, not for target-binding.
The matrix is more explicit than illus.

**Settled fragment (owner):** hold-like notes ARE glide notes that snap horizontally
during placement (ghost applies); after placement they are manipulated as regular
glides. So `type:'hold'` tends to dissolve from a note-TYPE into a placement
CONSTRAINT. Format/schema/export back-compat question parked but real.

**SELMODE leak (same disease, noted):** replace/+/− are selection set-ops in
select/point, but deposit polarity in aliquoto's place (+ = add point, − = delete
point). Two concepts wearing one chip row. Matrix candidate resolution: mode = gesture
polarity against the target. OR they are genuinely two axes. Not settled.

**Select's role mutates:** if target=existing, WHICH existing? Selection is the natural
binder — the gesture affects the selected event(s). Select stops being just a mover and
becomes the **target-binder**. Ties directly into Cut-1 cross-surface selection and the
Commensurability rule (selection already global + heterogeneous; the dragged lens names
the numéraire — same shape).

**B-layer connection:** the tempo lane already hand-duplicates hold/glide/pen/free. If
gesture grammars are universal over targets, the six-tool duplication collapses — the
matrix is the TOOL-LAYER FACE of the B-layer unification the roadmap already names.
Regions too: slice/merge/delete may be gesture grammars against target=region.

**Open questions (settle before any build):**
1. How is target bound — a toolbar MODE (new/existing), by current selection, or by
   explicit pick? (Selection-as-binder is the current lean; not settled.)
2. Do arities stay separate buttons, or collapse to anchored-create + free with arity
   read from the gesture? (Earlier 4→2 proposal is now downstream of this question.)
3. What does SAMPLED-onto-existing mean — replace the span? merge points? (aliquoto
   OVR/bake is prior art.)
4. Regions in the matrix: which gesture grammars apply, and does the region delete/merge
   spec (ll.406–432) re-express as matrix cells?
5. Mode chips: selection set-ops vs deposit polarity — one concept or two?
6. Does `type:'hold'` survive in the format, or become placement-constraint only?
   (schema + export + legacy import back-compat.)

Status: current Stage-1 build is stable; no code from this note yet.

### Development 2 (2026-07-11, later same day) — selection-as-scope (the Photoshop model)

Owner, post-commit: aliquoto's move/place distinction + Photoshop's "affect only
selected" generalize the matrix cleanly. **Selection is SCOPE, tools are VERBS.**

- **select** — the scope-binder. Granular (points) or object (notes); marquee bands.
  replace/+/− chips live HERE and only here. **Resolves the SELMODE leak**: set-ops are
  select's chips; deposit polarity is draw/erase's own axis. Two chip-meanings were two
  tools' properties all along. Needs **universal deselect + select-all** (pointer-first,
  always visible — Photoshop Ctrl-D/A as accelerators only).
- **move** — verb: translate the selection (spline points, endpoints, whole notes —
  whatever is selected). Leader-snap seconds-rigid machinery (`ptMove`) already exists.
- **draw** — verb: deposit points, **scoped by selection**. Empty selection → NEW note.
  Non-empty → deposit into the selected curve(s), never spawning a note. The
  hold/glide/pen/free arities become draw's MODES (or gesture-inferred — still open).
  Ghost-tentative applies to every deposit.
- **erase** — draw's − polarity (or its own verb). Selection scopes: selected → only
  those curves' points; empty → anything.

**The point tool dissolves** — its two halves redistribute: point-move → move (with
points selected), point-add → draw (with a curve selected). Stage-1's black/white-arrow
split becomes a CANDIDATE FOR SUPERSESSION; machinery survives (freezePitch, ghost-add,
hit routing, `removePoints`), the tool layer above gets re-cut. Do not rip out until
this contract settles.

**Free wins:**
1. **hold→glide conversion is gestural**: select the hold, draw a point onto it —
   1pt→2pt, it's a glide. No convert command. (Answers the earlier open question.)
2. The whole onto-existing matrix column unlocks at once: free-scribble onto a selected
   curve; glide-endpoints guiding an existing event — one rule, every arity.
3. **Multi-selection deposit target** already answered by Cut-1 vocabulary: the
   **ACTIVE SURFACE / active object** takes the deposit (selection is global; active
   owns the axis).

**SETTLED decisions (owner, 2026-07-11 Dev-2 continued):**
1. **HARD LAW (careful mode) — no new note while a selection exists.** When any selection
   is present, `draw` is LOCKED to depositing into that selection; it will NEVER spawn a
   new note. To make a new note the user must consciously **deselect** first. The accepted
   tax that guarantees zero accidental stray notes. **Sole exception: auto-select ON**
   (decision #3) — then cursor proximity governs and the law relaxes by the user's own
   choice. "At all costs" means: with auto-select OFF, there is no other escape hatch.
2. **Scope must be visible — the TARGET PILL.** A persistent, always-visible pill reads
   the *consequence* of the next deposit: `draw → note 7` (scoped) vs `draw → NEW`
   (empty selection). Chosen over "light up the select button" because it states the
   outcome, not just the state, and can't be missed when the aura is offscreen. In
   auto-select mode it reads the hover target live. Canvas ember aura stays as the
   *where*; the pill is the *what-next*. Needs cheap universal **deselect + select-all**
   (pointer-first; Ctrl-D/A accelerators only).
3. **Auto-select is a global toggle (Photoshop prior art), applies to BOTH move AND
   draw** — trades safety for convenience, user's explicit choice:
   - **OFF (careful, default):** selection is authoritative. Selection present → deposit
     into it / move it, never new (law #1). Empty → draw makes new; move no-op.
   - **ON (convenient):** CURSOR PROXIMITY is authoritative, selection ignored for
     targeting. Curve under cursor → target only that curve. No curve beneath → draw
     makes new / move no-op. Ambiguity returns, but by the user's choice.
   (Earlier asymmetric idea — auto-select objects but not points — SUPERSEDED by the
   single global toggle.)
4. **Deposit is confined to the selected note's existing time-extent — NO
   auto-extension.** Drawing past `[start,end]` does nothing. To extend, the user moves
   an endpoint with `move` FIRST, then draws from there. Keeps Conservation simple and
   stays out of the lazy-margin question entirely.

**Still open:**
5. Where do slice/pan/erase sit? **DEFERRED — leave them be until the drawing
   consolidation build reaches them; their fate gets clearer with code in hand** (owner).
   (erase likely = draw's − polarity, same scoping law; slice/pan probably orthogonal.)
6. Arities (1/2/N/sampled) as explicit draw-modes vs gesture-inferred — downstream of
   the above, still to settle.
7. `type:'hold'` survival in schema/export (from Dev-1 note) — unchanged, still parked.

**The BAND becomes a universal AXIS-LOCK (owner, 2026-07-11, exploratory):** today
`selBand` (box/vertical/horizontal/region) only shapes the marquee sweep + picks the
slice axis. Proposal: **rename region/time/pitch → xy / x / y** (default xy) and let the
band govern MOVE's degrees of freedom too:
- **x** selected → move constrained to the x (time) axis only.
- **y** selected → move constrained to the y (pitch) axis only.
- **xy** (region, default) → move freely in both.

Same shape as select-is-scope: ONE persistent selector, many verbs read it (marquee
sweep axis, slice axis, now move DOF). Pointer-first axis-lock — replaces the
Shift-to-constrain modifier other apps use, honoring the no-keyboard-required law.
`box` vs `region` (free-rect vs region-snapped) stay distinct for marquee/slice but both
read as "xy / both axes" for move. Not settled; affects both `move` and `slice`.
