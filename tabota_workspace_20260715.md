# Tabota as Workspace — multi-app time substrate + dependency architecture

*Design journal, 2026-07-15. Captures the vision for Tabota hosting the many
time-based apps (CyberScotoma, Proteus, and kin) and — the load-bearing half —
the coupling architecture that lets Roll evolve without bricking or force-marching
every app. Companion to [tabota_chart_model.md](tabota_chart_model.md) (the clock/chart
model this builds on) and [../DEPENDENCIES.md](../DEPENDENCIES.md) (the edge list this
plan is trying to keep small).*

---

## 0. The vision

Tabota stops being only a note editor. It becomes the **shared time substrate** for
the time-based apps. Each app (CyberScotoma, Proteus, …) owns some **event types**;
the rest of the score it **freezes** (preserves untouched) and reads as **sync
anchors** — the music the effect automation rides against.

Concretely:

- A group of events can *be* a CyberScotoma gesture. Every CyberScotoma setting
  (donorOffset, cells, drag, …) becomes an **automation curve expressed in Tabota
  language** — a "bloom curve" that is a `value.curve`, not a private point-editor.
- Effects don't play back notes. They only need each note's **second** on the clock
  to line up their gestures to the music. So foreign events cost ~nothing to carry:
  they're just `{t, hz}` positions, never decoded for pitch/tuning.
- A Tabota **workspace** view can show the whole score (losing deep Roll editing is
  fine); a per-app view exposes the app's own event-defining frames as editable and
  freezes everything else.

## 1. Most of this is already latent in v2 (reuse, don't rebuild)

- **v2 is already "a universal description language for time-based events."** An Event
  is a bag of optional facets — a CyberScotoma gesture is already a legal Event.
- **One clock, charts over it** (chart model §0). Every app reads the same
  seconds-from-`z`. That *is* the sync spine — an effect places a bloom against a
  downbeat by reading the note's second. No new mechanism.
- **`resolve.js`** already maps beats↔seconds and is already vendored across apps.
  An effect imports it to know where the music sits in seconds. Reuse.
- **`payload` is `additionalProperties: true`** — the "summon an event type from
  nowhere" escape hatch exists *today*, zero schema change.
- **`imports[]` + `metadata.profile`** are stubs for "this file carries foreign event
  defs / uses only a fragment."

## 2. The one genuinely new primitive: first-class Curve

Both effects already grew this **privately, twice**:

- Proteus: the morph curve (add/drag/double-remove points, ends pinned).
- CyberScotoma: the drawn bloom (bell / ramp / pulses, per-cell threshold catch).

The schema only has curves as *special cases*: pitch glide (`from/to/interpolation`),
tempo ramp (`TempoValue`), and the Roll's multi-point contour (which admits it rides
in `payload`, chart model §12). There is **no generic automation envelope**. That gap
is the center of the idea: a `value.curve` — xy points + interpolation over the clock —
so every effect setting becomes one automatable lane in Tabota language, and both
effects stop hand-rolling point editors.

Rough shape (additive, so safe — see §4 Rule 1):

```
value.curve: { points: [ { t, v, curve? } ], domain?, range? }
```

`t` already lives on the clock and conserves seconds like everything else.

## 3. Custom event types: two roads

**Road A (now, cheap): namespaced payload.**

```json
{ "role": "instruction",
  "payload": { "cyberscotoma": { "gesture": "aura",
    "params": { "donorOffset": "<curveId>", "cells": "<curveId>", "drag": "<curveId>" } } } }
```

Legal today. The app reads its namespace, ignores the rest. No schema edit, no
validation/discovery.

**Road B (later, first-class): an event-type registry** — declare a
`cyberscotoma-gesture` type and its automatable params, embed the declaration in the
file ("embed the event type within the encoding itself"). Breaks the
`additionalProperties: false` discipline on Event/Value and ripples to every realizer
plus antemelos (already drifting v1.5). Real cost.

**Decision: Road A now; Road B only when ≥2 apps prove the same shape** — the same
discipline that kept `hangsOn` cheap.

---

## 4. The coupling architecture (the load-bearing half)

The fear — *update Roll → brick every app* — comes from coupling on **code**. Fix:
apps couple on the **file format**, not on Roll's guts.

> **`.tabota` schema is the only mandatory interface. Code modules are optional
> convenience. An app survives a Roll update iff it depended on the *format*, never
> on Roll's *code*.**

### The two rules that give near-automatic backcompat

1. **Additive-only.** Never remove or repurpose a field. Every new facet is optional,
   never required. Old app reading a new file ignores what it doesn't know; new app
   reading an old file fills defaults.
2. **Preserve-unknown on round-trip.** When an app loads `.tabota`, edits its own
   events, and saves, it must pass through **untouched** every facet it doesn't
   understand. This *is* "freeze the rest" — freeze = preserve verbatim.

Rule 2 is the one people forget. Enforce it with **one golden-file test per app**
(load → save → assert byte-stable on foreign facets). That single test is the
anti-brick guarantee.

### Three coupling tiers — chosen per app, not globally

| tier | how the app relates to Tabota | coupling | who |
|---|---|---|---|
| **0 · native** | the app's own storage *is* Tabota events; export = identity | schema only | the "upscaling" apps — cheapest, toughest |
| **1 · primitive import** | own editor, but imports one *small stable* module (curve, resolve) | schema + pinned tiny lib | effects that want the shared curve widget |
| **2 · wholesale Roll** | embeds the full Roll editor | schema + big churny lib | **only full authoring surfaces**, never effects |

"Export only on export" = tier 0/1. "Import roll.js wholesale" = tier 2 — and tier 2
is exactly the coupling to fear, so it's reserved for apps that *are* Roll-like.
Effects stay tier 0–1.

The **upscaling** point precisely: an app that *natively encodes Tabota event-notes*
has **no translation layer to break** on export — zero code coupling. That's the
robust floor; push apps toward it.

### Layered modules — share the small+stable, not the big+churny

```
L0  tabota_schema.json     DATA CONTRACT. semver, additive-only. everyone depends here.
L1  tabota-resolve.js      pure fn beats<->seconds, no UI. tiny, stable. safe wholesale.
    tabota-curve.js        the curve primitive: model + headless point-editor. tiny. safe wholesale.
L2  tabota-roll.js         the full editor, imports L1. big, churns. effects DON'T import.
```

Dependency rule: **an app may depend on L0 always, L1 optionally (pinned major), L2
rarely.** Backcompat lives at L0. Because effects touch L0 (and maybe L1), a full Roll
(L2) rewrite touches them not at all.

Extract the **curve widget into L1 first** — the piece Proteus and CyberScotoma both
re-coded, small enough to share safely. Do **not** extract full Roll into something
effects must embed; that recreates the lockstep.

### Versioning policy (so updates never force-march)

- **Semver the modules.** A breaking L1/L2 change is a new major at a **new path**
  (`tabota-curve.js` stays; breaking = `tabota-curve-2.js` or `/v2/`). Old path is
  never deleted. Apps migrate on their own clock.
- **Pin majors, not commits.** Replace resolve.js's **hash-nag** (`CANON_SHA` chip)
  with a **version-range check** against a `VERSION` field — warn on major mismatch,
  not on every cosmetic byte. Hash-check false-alarms on formatting; version-range
  doesn't.
- **Schema `languageVersion` major = compat boundary.** Same major = additive,
  guaranteed readable; bump major only on a removal (should be ~never). `metadata.profile`
  advertises which fragment a file uses — an app reads it, then knows whether it can
  fully handle the file or must degrade-and-preserve.

---

## 5. What this fixes in today's DEPENDENCIES.md

- **resolve.js hash-nag → version-range check.** Kills false alarms on formatting.
- **binlod / kíkik silent CSS copies → an `@import`-ed custom-props file**, or accept
  the drift explicitly. Silent drift is the worst tier.
- **antemelos v1.5 drift stops being scary** once Rules 1+2 hold: a v2 reader must
  accept a v1.5 file (additive), and antemelos output round-trips because readers
  preserve-unknown. Verify once, then it's structural, not a recurring chore.
- **DEPENDENCIES.md shrinks.** Code edges drop to L0 (data) + L1 (two tiny libs). The
  big blast-radius rows (Roll CSS copies, whole-Roll import) never appear, because
  nobody is forced to embed L2.

## 6. Build order (cheap → dear)

1. **`tabota_compat.md`** — write the two rules + one shared conformance test
   (round-trip preserve-unknown). Cheapest; unblocks everything.
2. **Add `value.curve`** to the schema (additive — safe by Rule 1). Proteus +
   CyberScotoma emit it.
3. **Extract `tabota-curve.js` (L1)**, versioned, new path. Effects adopt at tier 1
   when they choose.
4. **Swap resolve's hash-nag → version-range check.**
5. **Full-Roll (L2) extraction deferred** — only if/when a real second *authoring*
   surface needs it.

Net: Roll can be rewritten tomorrow and nothing bricks, because the only things
effects trust are the file plus two frozen tiny libs.

## 7. Open questions

- `value.curve` exact shape — is `v` a scalar lane only, or can a curve address a
  vector param? Domain/range normalization convention.
- Namespaced-payload key policy — one key per app (`payload.cyberscotoma`) vs a shared
  `payload.tabotaApps.<name>` envelope for discovery.
- Where the workspace view lives — a Roll mode, or a separate thin host that imports
  L1 and renders read-only note anchors under whatever app is focused.
- Whether `metadata.profile` should enumerate the app-owned event types present, so a
  reader can announce "this file has CyberScotoma events I can't edit" before opening.

## 8. Progress log

**2026-07-15**

- **Step 1 done** — [tabota_compat.md](tabota_compat.md) drafted: the two rules
  (additive-only, preserve-unknown) + the round-trip conformance test + shared-harness
  sketch. One refinement vs §4 here: the round-trip bar is **deep-equal on foreign
  subtrees**, not byte-stable (byte-stability is an optional stretch goal). Treat
  compat.md as authoritative on that point.
- **Step 2 (schema) done** — `value.curve` added to `tabota_schema.json` as
  `CurveValue` + `CurvePoint` (`points[] {t, v, interpolation}`, optional `in` to quote
  `t` chronally/metrically, optional advisory `range`). Additive, so the schema minor
  bumped **v2.0 → v2.1** ($id updated). JSON re-validated. DEPENDENCIES.md updated
  (schema row, antemelos drift note, known-issue #1, + a dated migration note). No
  consumer forced to update — that is the compat contract working as intended.
- **Step 2 (effect wiring) deferred, on purpose** — CyberScotoma and Proteus have **no
  `.tabota` export path today** (they emit WebM / WAV). "Emit `value.curve`" has nothing
  to attach to yet, so retrofitting their private curve editors is premature. It waits
  until either (a) an effect grows a `.tabota` export, or (b) step 3 extracts
  `tabota-curve.js` and an effect adopts it at tier 1.

**Remaining (from §6):** step 3 `tabota-curve.js` (L1) extraction · step 4 resolve
hash-nag → version-range · step 5 full-Roll (L2), deferred. Open design questions still
live in §7 (curve `v` scalar-vs-vector, payload key policy, workspace host location,
profile enumerating owned event types).

---

*spine: couple apps on the file, not on Roll's code — then Roll is free to change.*
