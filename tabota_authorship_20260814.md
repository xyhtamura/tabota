# Tabota as an authored and interchanged format — verbosity, AI authorship, and the merge problem

*Design note, 2026-08-14. Records why Tabota suits composition by language models,
answers the terseness question that follows from it, and states — unresolved —
the multi-editor merge problem that the interchange ambition creates. Companion
to [tabota_reference_guide.md](tabota_reference_guide.md) (the describe/realize
split this rests on), [tabota_compat.md](tabota_compat.md) (Rules 1 and 2, which
constrain every proposal here), [tabota_chart_model.md](tabota_chart_model.md)
(the one-clock model that already supplies cross-format synchronization), and
[tabota_spacetime_20260721.md](tabota_spacetime_20260721.md) (the axis
generalization this assumes).*

*External claims in §6 and §8 are marked where they are unverified. The reading
that would settle them is specified in
[../learning/interchange/README.md](../learning/interchange/README.md).*

---

## 0. What this note answers

Three questions, in order of how settled they are: why a language model composing
in Tabota differs from one composing in MIDI (settled, §1–§2); whether Tabota
should acquire a terse surface syntax to reduce token cost (answered no, §3–§5);
and what happens when several people edit one score at once (open, §8).

## 1. The claim is about description, not about text

A weak version of the argument says Tabota suits language models because it is
text and MIDI is binary. That version does not hold. Models write MIDI
competently through `mido` and similar libraries, and text-shaped music formats —
ABC, MusicXML, Lilypond — are widespread without producing the advantage claimed
here.

The load-bearing difference is the one the reference guide states in its opening
paragraph: Tabota describes, and does not schedule. MIDI is a realization format,
and every value in a MIDI file is already committed — this note, this tick, this
velocity. A model authoring MIDI must therefore resolve every compositional
relation at the moment of encoding. The relations themselves — this gesture
answers that one, this entrance follows that resolution, this event sits anywhere
inside that window — have no field to occupy, so they are performed somewhere
unwritten and discarded. What lands in the file is the residue of a decision
whose reasons are gone.

Tabota keeps the relations as the artifact. `after`, `meets`, `equals`, a window
in place of a point, an event pinned in the web of other events and owning no
frame at all, a score that is under-determined or over-determined or paradoxical
and a realizer that reports what it cannot resolve. The rule the reference guide
derives — **numbers need a frame; relations don't** — is the whole of it. An
author working in Tabota may state structure without committing to values, and
the structure survives into the file.

This is also why the two-step workflow already in use (author in Tabota, compile
to MIDI) is not a detour to be optimized away. The first step is where the
composition happens; the second discards what the target cannot hold. Collapsing
them would mean composing directly in the representation that keeps least.

## 2. What the text encoding contributes, and what it costs

Text contributes three things that are real and separable from §1. Events carry
`id`s, so an agent can address one event and rewrite one facet without
regenerating the document. Changes produce readable diffs. And `payload` gives
intent somewhere to live, which MIDI has no field for.

The cost is that Tabota is a language of one. No model has learned it, and none
will until scores exist in quantity. Competence therefore comes from reading the
schema in context and following it, rather than from fluency in the weights.
That mechanism works — the schema is small enough to fit — but it is fragile in a
way fluency is not, and it carries a design obligation: the schema must stay
small, and the surface must stay regular. Every irregularity costs accuracy from
an author who has only the spec to go on.

Stating which mechanism is claimed matters, because the two have opposite
implications for growth. Fluency rewards a rich idiomatic surface. In-context
compliance rewards a spare and predictable one.

## 3. Verbosity, measured

A fully-articulated note event in current Tabota runs roughly 30–45 tokens:

```json
{ "value": { "pitch": { "note": "C4" } }, "position": { "at": 0 }, "extent": { "duration": 1 } }
```

Four hundred such events cost on the order of 14,000–18,000 tokens. That is not a
constraint worth designing around. The reason is structural: an event count
scales with how much was composed, not with the duration or the sample rate of
the result. A score is closer to a vector drawing than to a raster, and its size
is bounded by musical content.

One facet breaks this. `value.curve` can scale with **resolution** rather than
content, and a curve captured as a thousand sampled points is a raster inside a
vector format. It will dominate a document and defeat every other economy.

The rule that follows, and that belongs in the schema documentation: **curves
stay parametric — control points and easing, never stored samples.** Hold that
line and Tabota has no size problem at any score length.

The tool that makes the rule livable is a fit-on-release operation in the Roll:
the author draws freehand, and the stroke is reduced to a small set of control
points before it is stored. Least-squares Bézier fitting (Schneider's algorithm,
approximately what a vector editor's pencil tool performs) or Douglas–Peucker
simplification as a preliminary pass are the standard approaches. This belongs
with `draw·split` and the queued `draw·merge` as another drawing verb, rather
than in a compression layer.

Fitting is worth distinguishing from compression. It converts a sampled trace
into a gesture — an object with fewer parameters and more meaning, whose smaller
size is a consequence of the promotion rather than its purpose. Compression
trades information for size. Fitting discovers that the information was never in
the samples.

## 4. Abbreviated keys are the wrong economy

Shortening key names (`"position"` → `"p"`) reduces token count measurably,
perhaps twenty to thirty percent of the portion spent on keys, which is itself a
fraction of the document.

It is also the single compression that damages the audience it is meant to serve.
Per §2, a model authors Tabota by reading names and inferring meaning.
`"extent": {"duration": 1}` states what it is; `"e": {"d": 1}` requires holding a
decoder ring in working memory while composing, and raises the error rate on
exactly the task the change was meant to assist. The trade is a small saving
against a large accuracy loss, in exchange for nothing that human readers,
editors, or realizers want.

The economy that does work is already in the language. Inheritance is lexical
scope — CSS rather than Allen — so events that inherit their frame instead of
restating it are smaller **and** more correct, since a restated frame is a second
place for the value to drift. Semantic compression and Tabota's purpose point the
same direction here; syntactic compression does not.

## 5. If a terse surface is ever built

The reason will be authoring ergonomics rather than token cost. JSON is
unpleasant to type by hand, and that is a legitimate complaint — though the Roll
already answers it for anyone willing to open the editor, and language models are
better served by JSON than by a bespoke syntax, since JSON structure is deeply
represented in their training and a custom grammar is not.

If it happens, one constraint governs the design: **terse compiles in, JSON stays
canonical, and nothing round-trips back out through the terse form.**

The reason is Rule 2. The anti-brick guarantee requires that an application load
a document, edit what it owns, and preserve every foreign facet deep-equal —
including facets from a schema minor it has never seen. A canonical format must
therefore be able to carry data it does not understand. JSON does this
structurally, at no design cost. A terse notation earns its ergonomics precisely
by knowing what each field means, and that is the property that fails on an
unknown field. A terse form that could faithfully carry arbitrary unknown facets
would have re-derived JSON's generality and lost the terseness that motivated it.

One-way sugar avoids the problem entirely: the compat contract continues to
govern one representation, and the terse form becomes a typing convenience that
cannot brick anything. Making the terse form the default would invert this and
put the fragile representation where the guarantee has to hold.

## 6. Interchange, and why the expense is the point

Tabota is an interchange format. The verbosity is characteristic of the category
rather than a defect in this instance: an interchange format carries what each
native format would discard, so it is reliably larger than any of the formats it
mediates. The retained information *is* the size.

The argument that justifies the cost is the pairwise-converter argument. Without
a shared format, N tools that must exchange timed material need on the order of
N² converters, and each converter silently drops whatever its target cannot
express. With a shared format, each tool needs one realizer, and the shared
format holds what no individual pair could carry between them. This is the
precise form of the intuition that Tabota should let a video editor, a composer,
a lighting designer, and an instrumentalist work in one arena rather than
synchronizing four applications pairwise.

*(Verified: the comparison to USD, glTF, OpenEXR, AAF/OMF, and MusicXML was settled in [`../learning/interchange/01-interchange-formats.md`](../learning/interchange/01-interchange-formats.md). The $N^2 \to N$ pairwise-converter reduction is standard justification, and interchange formats fail at lossy round-tripping rather than single-direction export.)*

The synchronization half of this claim needs no new mechanism. It is already
built, at the model level, in the chart model: the score has one real clock, and
every coordinate system — metric, chronal, pitch, main, or lens — is a chart over
that clock, with the frame supplying the conversion. Video timecode, MIDI ticks,
beats-at-a-tempo, and sample frames are charts of exactly that kind. What is
missing is realizers for the formats that are not audio, rather than any addition
to the model.

## 7. Interchange without a master

The owner's constraint on all of the above: Tabota should be usable as a central
document without requiring that anyone treat it as one. That reads at first as a
contradiction with §6, and it is not, once two senses of "hub" are separated.

- **Hub as authority.** One privileged document is the truth. Every tool is a
  client of it, and no exchange is legitimate except through it.
- **Hub as vocabulary.** Tabota is the language tools speak when they need to
  address each other. Documents are the medium of exchange, and may be many,
  partial, and peer-to-peer. No instance is privileged by the design.

The interchange argument in §6 requires only the second. N² converters collapse
to N realizers because the tools share a *vocabulary*; nothing in that argument
needs a single blessed file.

Git is the standing existence proof, and it is the right analogy for the
worktree-shaped instinct behind the constraint. Git's object format is universal
and its authority is conventional: every clone is complete, and calling one remote
`origin` is a social agreement that nothing in the format requires. Interchange
without a master is achievable when the *format* is shared and the *authority* is
left to whoever is using it.

This reframes what Tabota still owes. A shared vocabulary it has. What git also
supplies, and Tabota does not, is merge semantics — a defined answer to what
happens when two holders of the vocabulary have both edited.

## 8. The merge problem (open)

The compat contract covers one application loading a document, editing what it
owns, and preserving the rest. It does not cover two applications having
independently edited the same score and needing reconciliation, which is what any
real intermedia workflow produces the moment two people work at once. Tabota's
implicit current answer is one editor at a time — the same rule the root
`AGENTS.md` applies to agents in a folder — and that answer does not survive the
scenario the format is being built for.

The contract already holds most of the vocabulary needed. `ownedPaths` declares
which JSON-pointer prefixes an application may rewrite, and Rule 2 defines
everything else as foreign and preserved. A merge model can be built from those
two facts. Three cases fall out, and they are not equally hard:

1. **Disjoint owned paths.** The composer rewrites `value.pitch` while the
   lighting designer rewrites `payload.lighting` on the same events. Both edits
   are local and non-overlapping, and a merge that applies each to its own
   subtree is well-defined and needs no negotiation. Rule 2 conformance is close
   to sufficient here already: an application that faithfully preserves foreign
   subtrees has, in effect, produced a document that differs from its input only
   inside its own paths.

2. **Same owned path.** Two editors changed the same facet of the same event.
   This is an ordinary conflict, and it wants an ordinary answer — surface both
   values and let a person choose. No new theory is required.

3. **Frame and extent edits, which are not local.** This is the hard case, and it
   is a consequence of Tabota's own inheritance rule. Because inheritance is
   lexical scope, a frame supplies the coordinate field that every descendant is
   read in. Changing a frame's tempo, units, or extent does not edit the
   descendants, and it silently changes what they mean — an event at
   `position.at: 4` lands somewhere else, and nothing in that event was touched.
   An editor who owns only their own facets can therefore have their work
   re-meant by someone whose edit never intersected their paths at all.

Case 3 is why the owner's instinct — that changing an extent might require asking
the other collaborators — is correct, and it now has a reason attached rather
than resting on intuition. Frames are the one class of edit whose effect is
non-local by design. The candidate responses are a lock on frame-carrying events,
an explicit request-and-consent step, or an announced rebase in which every
dependent editor is shown what their material now means. Which of these is right
is not decided here.

*(Verified: interchange formats fail in practice at lossy round-tripping, with AAF/OMF in post-production and MusicXML between notation editors as primary examples. Settled in [`../learning/interchange/01-interchange-formats.md`](../learning/interchange/01-interchange-formats.md) and [`02-structured-editing.md`](../learning/interchange/02-structured-editing.md). Standard JSON CRDTs solve Cases 1 & 2 but do not handle Case 3 non-local frame edits, making Case 3 a novel problem for Tabota.)*

## 9. The speculative case as a method

Case 3 was not found by examining what Tabota does now. It was found by
describing the most demanding use anyone could state — a video editor, a
composer, an instrumentalist, and a stage designer editing one score
simultaneously, in the manner of a shared document — and asking what breaks. The
frame-inheritance hazard is present in the language today and invisible at one
editor per document, so no amount of attention to current behavior would have
surfaced it.

Recorded as a working method, since it produced the most useful finding in this
note: state the maximal version of the use case, then read off the affordances
and the blocks it exposes. Reasoning from present capability describes the
present.

## 10. What this implies for sequencing

Every claim in §6 through §8 depends on one property that has not been
demonstrated: that two independent applications can round-trip each other's
facets without loss. The compat contract is still marked draft (2026-07-15), the
shared corpus in its §3.1 does not exist, and the harness sketched in its §6
(`tabota-compat.js`) is unbuilt. Antemelos emits v1.5 against a v2.1 canon.
Binlod's coupling to Tabota is a hand-copied CSS palette, with the resolver
import still aspirational.

So the interchange claim is sound in its architecture and untested in fact. The
constraint on becoming a substrate is the corpus and the round-trip harness,
rather than further language design. The terseness question, answered no above,
is language design and can wait indefinitely; the merge model in §8 is real work
but sits behind the harness, since a merge model is meaningless until
preserve-unknown is proven.

## 11. Open questions

- Should the parametric-curve rule (§3) be stated normatively in
  `tabota_compat.md` or the schema documentation, given that a sampled curve
  breaks no rule today and would pass conformance while making documents
  unusable?
- Does case 1 of §8 reduce exactly to Rule 2 conformance, so that a
  three-way merge over disjoint `ownedPaths` needs no new contract language, or
  is there a case where two Rule-2-conforming writers still produce an
  unmergeable pair?
- Is there a schema-level marker for "this facet's edit is non-local" — frames
  and extents today, possibly `ref` — so that a merge tool can identify case 3
  without hardcoding a list of facet names?
- If authority is conventional rather than structural (§7), what is the unit of
  exchange between two collaborators — a whole document, or a diff over Events
  addressed by `id`? The second requires that `id`s be stable across editors,
  which nothing currently guarantees.
- Do the non-audio realizers implied by §6 (video, lighting, robotics) need
  anything from the language, or is the chart model plus `frame.axes` from the
  spacetime note already sufficient, so that the entire remaining cost is per-target
  realizer work?

---

*spine: Tabota suits machine authorship because it records relations instead of
resolved values, and that same property makes its verbosity the retained
information rather than a cost to compress away — leaving the real unfinished
work at the seam where two editors meet, where inheritance makes a frame edit
change the meaning of material its author never touched.*
