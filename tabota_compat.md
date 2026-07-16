# Tabota Compatibility Contract

*The anti-brick contract. Two rules plus one conformance test that together let Roll
and the schema evolve without breaking or force-marching the apps that read `.tabota`.
Load-bearing companion to [tabota_workspace_20260715.md](tabota_workspace_20260715.md)
§4; consumers listed in [../DEPENDENCIES.md](../DEPENDENCIES.md).*

Status: **contract draft, 2026-07-15.** Normative words: **MUST / SHOULD / MAY** carry
their usual weight. An app "claims conformance" by passing §3.

---

## 0. Why this exists

Apps must not couple on Roll's *code* — only on the *file format*. If that holds, Roll
can be rewritten and no app notices. The format only earns that trust if it evolves
under two rules and every reader/writer is tested against them. That is this document.

## 1. Ownership — the vocabulary the rules need

- An app **owns** a facet if it reads it and MAY rewrite it. Ownership is declared as a
  set of **paths** (JSON-pointer prefixes) into an Event — e.g. CyberScotoma owns
  `/payload/cyberscotoma` and reads-only `/position` and `/value/pitch`.
- Everything an app does not own is **foreign** to it. Foreign is per-**facet**, not
  per-Event: an app may own an Event's `payload.cyberscotoma` while `value.pitch` on
  the *same* Event is foreign and must be preserved.
- **Unknown** = foreign *and* not in the app's schema version at all (a facet from a
  newer minor, or an `additionalProperties` payload key it has never heard of). Unknown
  is the strict subset of foreign that the two rules most protect.

## 2. The two rules

### Rule 1 — Additive-only schema evolution

Within a `languageVersion` **major**, the schema changes only by **addition**:

- **Additive (allowed):** a new optional facet; a new optional sub-key; a new enum
  member that older readers MAY ignore; a new `payload` namespace.
- **Breaking (forbidden within a major):** removing a field; renaming a field;
  repurposing a field's meaning; making an optional field required; narrowing a type
  or an enum; changing a default in a way that flips existing files' meaning.

Consequence: a reader at major *N* MUST accept any file at major *N.m* for every minor
*m* — reading what it knows, preserving the rest (Rule 2). A breaking change requires a
**major bump**, and a major bump is the *only* place an app MAY refuse a file.

### Rule 2 — Preserve-unknown on round-trip

When an app loads a `.tabota`, edits only what it owns, and saves, every **foreign**
facet MUST survive **semantically unchanged**.

- "Semantically unchanged" = **deep-equal** on the foreign subtree. Serialization
  cosmetics (key order, whitespace, number formatting `1.0` vs `1`) MAY differ. *(The
  workspace note said "byte-stable"; the precise contract is deep-equal on foreign
  subtrees. Byte-stability is a stricter, optional stretch goal — see §3.4.)*
- This holds through the app's whole pipeline. The failure mode to design against:
  parse → map into a lossy internal model → re-serialize, which silently drops
  everything the internal model didn't have a slot for. Two ways to avoid it:
  - **(a) Full-fidelity tree (preferred for readers that don't restructure).** Keep the
    parsed JSON; mutate only owned nodes in place; serialize the same tree.
  - **(b) Carry-bag.** On load, stash every unowned key of each Event into a side
    carry keyed by Event id/path; on save, merge the carry back over the app's emitted
    Events.
- Preservation is **recursive**: a foreign Event nested inside an owned container is
  still foreign and still preserved.

Rule 2 *is* "freeze the rest of the score." Freeze = preserve verbatim, not blank out.

## 3. The conformance test

One shared harness, run by every app that claims conformance. It proves both rules
mechanically.

### 3.1 The corpus (shared fixtures)

A directory of golden `.tabota` files, versioned with the schema, covering at minimum:

1. **notes only** — plain metered score, no exotic facets.
2. **charts / frames / lenses** — the chart-model shapes.
3. **a `value.curve`** — the automation primitive (once §2-step-2 of the workspace plan
   lands).
4. **a foreign app payload** — e.g. a `payload.cyberscotoma` gesture, for an app that is
   *not* CyberScotoma to preserve.
5. **a synthetic-future file** — same major, minor bumped, carrying one **unknown**
   optional facet (`payload.__future` and one unknown top-level Event key) to simulate
   a newer schema the app has never seen.

### 3.2 The round-trip assertion (Rule 2)

For each app under test, for each corpus file:

```
in      = parse(file)
out     = parse( app.save( app.edit( app.load(file) ) ) )   // edit = no-op OR a scripted owned edit
assert  deepEqual( foreignFacets(out), foreignFacets(in) )   // (a) foreign preserved
assert  ownedEdits applied                                    // (b) the app's own change took
assert  validate(out, schema)                                 // (c) still schema-valid
```

`foreignFacets(x)` masks out the app's declared owned paths and deep-compares the rest.

### 3.3 The additive / degradation checks (Rule 1)

- **Additive:** the app MUST `load` the synthetic-future file (3.1 #5) without error and
  preserve its unknown facets through 3.2. It MAY render nothing for them.
- **Degradation:** the app MUST NOT crash on a file whose `metadata.profile` (or payload
  namespaces) names event types it cannot edit. It MUST open them read-only / frozen, or
  warn — never silently drop or corrupt them.
- **Major refusal (allowed):** the app MAY refuse a file whose `languageVersion` major
  exceeds what it supports; refusal MUST be a clean message, not a corrupt save.

### 3.4 Optional stronger bar — byte-stability

An app MAY additionally assert its writer is **byte-stable** on foreign subtrees (stable
key order + canonical number formatting). Not required for conformance; useful for apps
whose files live in git, to keep diffs clean.

## 4. Reader / writer obligations (checklist)

A conforming **reader** MUST:

- [ ] accept any file of the same `languageVersion` major (Rule 1).
- [ ] preserve every foreign facet through a round-trip (Rule 2).
- [ ] treat unknown facets as foreign, never as an error.
- [ ] degrade (freeze / warn) rather than crash on event types it can't edit.

A conforming **writer** MUST:

- [ ] set `languageVersion` to the max it authored against, and never emit a
      required-new field into a file claiming an older major.
- [ ] merge foreign carry back on save (Rule 2).
- [ ] emit schema-valid output (§3.2c).

## 5. Version negotiation

- `languageVersion` is `MAJOR.MINOR`. **Same major ⇒ reader MUST accept** (the additive
  guarantee). Higher major ⇒ reader MAY refuse or best-effort.
- A reader SHOULD emit a **soft warning** when a file's minor is higher than it knows:
  "this file may contain facets I preserve but do not render."
- `metadata.profile` advertises the fragment/event-types a file uses. Readers SHOULD
  consult it *before* opening to announce, e.g., "this file has CyberScotoma events I
  can't edit — opening them frozen."
- Shared **library** modules (L1: `tabota-resolve.js`, `tabota-curve.js`) are pinned by
  **major version range**, not by content hash. Replace resolve's `CANON_SHA` chip with
  a `VERSION` check: warn on major mismatch, not on cosmetic edits.

## 6. Shared harness (to build — workspace §6 step 1)

Package the checks so no app reimplements them. Sketch:

```
tabota-compat.js   (candidate L1)
  carryLoad(json, ownedPaths) -> { model, carry }   // strategy (b), for apps that want it
  carrySave(model, carry)     -> json               // merge foreign carry back
  foreignFacets(json, ownedPaths) -> maskedTree     // for the assertion
  assertRoundTrip(app, corpusDir)                   // runs §3.2–3.3 over the corpus
```

An app claims conformance by wiring its `{load, edit, save, ownedPaths}` into
`assertRoundTrip` in its own test suite and passing against the shared corpus.

## 7. Change control

Editing this contract, the schema's compat semantics, or the shared corpus is a
shared-artifact change: update this file, the corpus, and
[../DEPENDENCIES.md](../DEPENDENCIES.md) in the same sitting, and re-run every
conforming app's round-trip suite.

---

*spine: additive schema + preserve-unknown, proven by one round-trip test — that is the
whole anti-brick guarantee.*
