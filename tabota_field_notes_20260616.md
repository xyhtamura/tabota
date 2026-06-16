# Tabota — Field Notes: Aesthetics, Ontology, Lineage

*Process notes, 2026-06-16. A record of a long design conversation tracing why Tabota
looks the way it looks, what it actually is underneath the look, which ancestors it
descends from and departs from, and what all of that demands of further development.
Not a spec. A set of convictions arrived at by talking, with the reasoning kept
attached so future decisions can be checked against it.*

---

## 0. How to read this

These notes move from **surface** (what the design recalls) down to **substrate**
(what the language is), because that was the actual order of discovery — the visual
choices turned out to be arguments about the ontology, not decoration on top of it.
Every aesthetic claim here is load-bearing. Where a design decision is downstream of
a conviction, the conviction is named so the decision can be revisited if the
conviction ever changes.

The single sentence the whole document defends:

> **Tabota describes events that *hold*; it does not schedule events that *fire*.**
> The surface, the language, the lineage, and the roadmap are all the same claim at
> different layers.

---

## 1. The aesthetic genealogy (corrected)

### 1.1 What it first seemed to recall
The palette and chrome read as **late-90s / early-2000s music software, "done my
way, slightly twisted."** Initial reach: the skinned jewel-tone lineage (Reason,
MetaSynth, KPT). That was wrong, or rather it was the *flood* downstream of the real
reference.

### 1.2 The narrower, truer reference: the pre-skin desk
The genuine memory is the **terminal native-widget era, ~1995–98** — the last stretch
when serious software wore the operating system's own gray chrome instead of drawing
its own costume. Windows 95/98 system silver (`#C0C0C0` button-face), chiseled 3D
bevels, **etched group boxes** (the sunken rectangle with the label notched into its
top border). Apps *arranged* standard controls rather than painting custom pixels, so
everything had a family resemblance. In music software: Cool Edit Pro, early Cakewalk,
Sound Forge — utilitarian, OS-deferential, no faceplate.

**The hinge:** Winamp 2 (1998) shipped skinning as a headline feature; apps then
ignored the OS and drew brushed metal, LCD readouts, alien faceplates. That is the
"proliferation" that came *after*. Tabota keeps the **panel grammar** of the pre-skin
era (grouped controls, etched dividers, region panels = group boxes pairing
structure-file with calibration) but does the one thing that era couldn't: **it
re-hues the gray.**

### 1.3 But the rounded, tinted neutrals place it later than that
Correction made mid-conversation: a *true* neutral gray is achromatic. Tabota's
"gray" tilts into **pastel lilac panels over a sage ground**, and the shapes are
**rounded**. That is a **skin-era** move, not native chrome. So Tabota is not pre-skin
— it stands at the **gentle end of the skinning era**: the *transitional skin* whose
job was not to frighten the people coming over from gray-chrome software.

Named references for that gentle end:
- **Windows XP Luna (2001)** — rounded corners, pill Start button, lozenge buttons,
  sitting on top of the same Win9x control grammar, with "Classic" mode kept for the
  scared. Shipped as Blue / Olive Green / Silver — the olive is close to the paddy
  register.
- **Mac OS X Aqua (2001)** — the glossy-lozenge pole everyone chased.
- **WindowBlinds / WinCustomize skin culture** — frosted, aqueous,
  desaturated-but-tinted neutrals; off-whites, icy greens and blues. Tabota's
  pastel-purple-and-pastel-green pairing lives in this family, hue knob turned
  somewhere nobody shipped.

**Why round buttons are correctly kept out (the technical gate):** the Win32 BUTTON
control was rectangular; a round button required owner-draw + `SetWindowRgn`
region-clipping — the *same machinery skins used*. Round buttons were **unlocked by**
skinning, and they belong to the **hardware-skeuomorphic** bucket (brushed metal,
knurled knobs, rack faceplates). Tabota's actual buttons split the difference: soft
rounded rectangles (~7–14px radius), neither the hard Win95 corner nor the full
circle. **Pre-skin structure, present-tense finish.**

### 1.4 Three skeuomorphisms, kept distinct
- **Win 3.1 — object skeuomorphism:** the UI imitates a *thing* (calculator,
  Rolodex). Not us.
- **Win 95/98 native gray — barely skeuomorphic:** bevels imitate a *pressable
  surface* abstractly. **Our bones.**
- **Skin era — hardware skeuomorphism:** brushed aluminum, studio-gear cosplay.
  **Refused.** The paddy is not a rack unit.

### 1.5 Two dialects inside the light tier
- **Light-cyan-on-white, low-contrast** = the **scientific/engineering instrument**
  look (oscilloscope, spectrum analyzer, Audacity's pale waveforms). The chrome
  recedes; the data is the figure. Tabota swaps cyan → **light green + light plum**:
  same instrument grammar (distinguish lines/areas by faint hue, not heavy borders),
  relocated from lab to garden.
- **Creams-over-gray, milky/warm** = the **paper / desktop-publishing** lineage. The
  "document" metaphor. This register lived in music software **only in the notation
  corner** (Finale/Sibelius putting noteheads on cream "paper"), *never* in the
  sequencer/DAW corner, which stayed gray-machine.

**The seam Tabota sits on:** it runs a **sequencer's** information density and panel
grammar (the Cakewalk bones) but renders it in the **notation world's paper
register**. It walks the sequencer's bones into the engraver's paper room. Cream =
page; gray = machine. Tabota chose page.

### 1.6 The true ancestor of the surface (the real correction)
The cream-page register is **not** nostalgia for half-remembered music software. Its
genuine lineage is the **image editor** — Photoshop / Illustrator — because that is
where the idea was born (see §5). The pen tool, the bezier, precise freehand on a
canvas that **is** the work rather than a transmission of it. The surface feels right
because it is **home**, not borrowed.

---

## 2. The ontology: inscription, not transmission

The deepest organizing axis is not light-vs-dark or old-vs-new. It is **what the
screen is *for*.** Two ontologies of the musical screen:

- **Transmission line** — the screen as a clocked signal path. Note-on/note-off,
  timestamps. The work *fires*. (MIDI, OSC, the player-piano roll.)
- **Inscription / page** — the screen as a surface of marks that *hold*. The work
  *persists* and is *read*. (The image editor, the engraved score, the desk
  document.)

Tabota is **inscription**. The whole aesthetic enforces the ontology:

> A line drawn on cream paper against faint sage/plum gridlines reads as **inscribed**
> — it is there, it persists, it means something whether or not anything is currently
> playing it. The surface's *stillness* is what lets a continuous line read as
> *described rather than scheduled.* Rendered on a dark Serum/OSC surface (neon,
> reactive, glowing) the same line would lie — it would scream "firing now."

There is a second, quieter thing the Y2K desk period does: it is the last cultural
moment when **the screen-as-document and the idea of a file you exchange were fused**
— software bought in a box, used to make a thing, saved, handed over. By dressing
Tabota in that period, the surface pre-loads the roadmap's real claim: **the `.tab`
file is a portable artifact, a page someone else can open — not a running process you
must be plugged into.** Cream-page present and conformance-fixture future are the same
conviction at two layers.

---

## 3. Ancestors: each splits what Tabota unifies

This is the spine of the whole position. Every realized ancestor *had* pieces of
Tabota and **factored apart** what Tabota refuses to factor. The novelty is not any
single capability — each existed somewhere — it is the **refusal to split them.**

| System | Has | Splits off / lacks | Register of its surface |
|---|---|---|---|
| **MIDI / dawn-of-MIDI** | timed events, ubiquity | continuity (impossible); relation | transmission line; player-piano roll |
| **OSC** | continuous *values* (32-bit float) | **grammar** (impl-defined per server); still time-tagged real-time firing | a *pipe*, no language; no desk |
| **Csound (Music-N)** | orchestra/score split = frame/events; open p-fields = open payload; **offline render** (not a wire) | continuity factored into the *orchestra* (linseg / GEN tables), not the event; **no inter-event relation**; score stays a flat list of absolute-time triggers | terminal / cold institutional Qt (CsoundQt, blue, Cabbage) — **never the cream page** |
| **MusicXML / MEI / Humdrum kern / Lilypond** | rich grammar; genuine notation | grammar **chained to traditional notation** (staff, clef, 12-TET, metered-time-as-master) | engraved-page, but locked to the staff's assumptions |
| **Kontakt (under-the-hood mapping)** | genuinely spatial *description*: region × condition → material; group logic ≈ conditional triggers | wears a **performance faceplate** (instrument cosplay); guts left as dark technical *configuration* | dark mapping grid = "you are patching," not "you are authoring" |

### 3.1 The key readings
- **OSC's real failure** is not "no desk *and* no shared decoders" — those are the
  *same lack*. **A desk is a shared decoder.** "Everyone ships their own decoder"
  (the cryptography analogy) is exactly what OSC *did*, and it is why it failed: the
  *vocabulary* was private, so there was no language — a billion private languages
  that can't read each other. Cryptography works because the **algorithm is public**
  and only the **key** is private. OSC made the whole vocabulary private. Tabota
  builds the **commons**: a public grammar two tools can mean the same thing by.
  *(Conformance fixtures = the public algorithm to OSC's private key.)*
- **A glide in OSC** is a dense burst of discrete timed samples — a staircase
  pretending to be a curve. **A glide in Tabota** (`{from, to}` over an extent) is a
  single continuous *object that exists*, resolved whenever/however a client likes.
  OSC *streams* the curve; Tabota *describes* it.
- **A glide in Csound** lives in the *orchestra* (a `linseg`, a GEN07 table), invoked
  by a timed score trigger. Csound has continuity but **factors it down into the
  synthesis layer**; the score stays a scheduler. Tabota puts the line **into the
  event description itself**, at the score level, as a thing that holds. The line is
  in the noun, not in the machine the noun triggers.
- **Csound is the cautionary ancestor.** It had the ontology — closer than anything
  else — and stayed a ghost because **it never got the desk.** Right guts, wrong skin
  (terminal / lab-grey = *configuration*, not *composition*). Tabota's wager: the same
  ontological freedom, dressed in the page register, crosses the line Csound never
  crossed.
- **Kontakt's guts are the structural cousin** — conditional spatial description, the
  paddy already half-buried in a sampler. The move: **take the guts, throw away the
  face.** Dressing the Kontakt-mapping heart in the paper-workbench surface makes the
  identical activity **read as composition rather than configuration.**

### 3.2 The thing Tabota unifies
Tabota collapses **value-continuity + temporal-extent + inter-event-relation** into
the single recursive Event. Allen's interval algebra arriving *after* the
time-linked region was the language announcing it held more than the drawing could
show.

---

## 4. The Rosetta-Stone thesis (the mission above the goals)

The many stated goals (xenharmony, polytemporality, drawn gesture, instruction-music)
are faces of **one** goal:

> **A high-fidelity master representation of events-and-relations that is more
> expressive than any existing notation and committed to none of them — a meta-notation
> the others project *down* into, losing only what they can't hold.**

Why it *had* to refuse to splinter: every prior system **is one of the languages on
the Rosetta Stone** (MIDI is a language, MusicXML is a language, OSC is a failed
language). **None of them can be the stone**, because the stone cannot be written in
one of the languages it translates — it must sit *above* all of them. That is the
deep reason for the recursive single-Event design, the optional-everything, the
relax-a-constraint-to-reach-a-new-regime architecture, and for 12-TET et al. being
**built-in convenience projections** rather than the substrate.

**Tabota is a flexible commons like OSC** (users may assign anything to events)
**with the extensive built-in systems OSC lacked** (12-TET, named scales, standard
meters as ready projections). Freedom *and* a shared grammar.

### 4.1 The achronous keystone
"If Tabota can do chronological, what stops it going sequential (Cage, Happenings,
instruction-based)?" **Nothing — and that non-obstruction is the proof.** A scheduler
*cannot* represent "perform in any order" / "begin when the performer decides"; firing
*is* its ontology. Tabota reaches the achronous **for free, by relaxing which
coordinate is mandatory** — not by adding a feature. MIDI could never *become* Cage;
Tabota becomes Cage by *removing a constraint*. Keep achronous **in the language even
while shelved from the Roll** — it is the load-bearing existence proof that the thing
is not a scheduler. The unpainted wall that holds the roof up.

### 4.2 The audio boundary (correctly refused)
Tabota stores time-frequency audio (spectrogram / STFT) *poorly*, and that is
**correct, not a gap.** A spectrogram is a **sampled measurement** of an *occurrence*
("how much energy here-and-now"); Tabota is a **description of intent and relation.**
Different *kinds* of object, not different resolutions of one. Absorbing the
spectrogram would smuggle the **fired signal** back in through the side door. The
clean move: **schedule a WAV as an event, hang metadata on it, let the specialized
tool own the samples.** Description *references* measurement; it does not *contain* it.

---

## 5. Birth-in-the-image-editor; the two-object split

The conceptual origin is **visual art** — Photoshop/Illustrator, splines, the pen
tool. The animating question:

> *Why can we do precise freehand and editable curves in vectors but not in music?
> Why is it so hard, when it's all the same software environment?*

The answer is the §2 axis: graphics inherited the **inscription** lineage (the
bezier is a described object that *exists*); music inherited the **transmission**
lineage (the pitch-bend is a stream of timed values that *occurs*). Tabota imports
the **ontology of graphics — the mark that persists — into the one domain that only
ever had the signal that fires.**

**Spline levers / pen-tool-for-sound** are therefore **not a someday-nicety** — they
are the thesis made literal. Put on the roadmap as the clearest statement of what
Tabota is.

**The two-object event:** "If you have a graphic editor, how is that going to be
encoded? — now I had two objects: the encoding (language) and the graphic editor."
That bifurcation is the **syntax/semantics (sense/expression) split.** The graphic is
*one* notation for a content; the JSON is *another* notation for the *same* content;
the content itself is neither. Consequences:

- **The Canvas Doctrine demotes itself, correctly.** The canvas is **primary for
  authoring**, but no longer **identical to the work.** The work is the abstract
  structure of events-and-relations; both picture and JSON are *projections* of it.
- **"Roll is one client" is a theorem, not modesty.** A graphic can only ever show a
  **grounded** state; the language can hold **ungrounded relation** (a relational
  position has no pixel location until resolved — it can't be *drawn*, only
  *described, then drawn*). The picture is one *resolution* of the language; the
  language has a **surplus** over every projection.

---

## 6. The autographic / allographic frame (Goodman → Gracyk)

Terms (Goodman):
- **Autographic** — original/forgery distinction is meaningful; the *history of
  production* and the physical inscription are constitutive. (Painting.)
- **Allographic** — the art has a **notation**; any correct **compliant** with the
  **character** (score) is a genuine instance; no forgery of a *performance*.
  (Classically: music, *because it has staff notation.*)
- **Gracyk (*Rhythm and Noise*)** — rock inverts this: identity lives in **the
  recording** (the take, the grain, the noise), not in any score. Rock is
  *autographic* in a domain supposed to be allographic.

### 6.1 The gesture machines are autographic gesture-capture
Seaboard ROLI, Haken Continuum, Imogen Heap's mimu gloves (and behind them the
theremin) are **autographic gesture machines**: a continuous performed trace whose
identity is the *specific* execution — this glide, this pressure curve, this
hand-tremor, captured as dense high-resolution data. Captured MPE/gesture = **rock
ontology applied to gesture**: the take is constitutive, noise and all. One "had to
own these" to get continuous lines into a piece **because continuity had no score** —
the instrument was the price of the curve.

### 6.2 What Tabota actually overturned
Tabota's continuous line is **allographic continuity.** `{from, to}` over an extent —
the spline drawn with pen-tool levers — is a **character in a notation**, not a
captured trace. No constitutive take; nothing it is a forgery of. Tabota took the
continuous expressive line, which had only ever existed **autographically** (required
a performing body + capture device), and **gave it a notation.** It made continuity
**writable** rather than only **recordable** — *the score continuity never had.*

### 6.3 The divide is relocated, not collapsed
- **Roll, in use → leans autographic.** Draw, warp, don't pre-know duration; the mark
  feels made under the hand. This is the image-editor inheritance and it *should* feel
  this way — composing-by-drawing is composing-by-inscribing. (Authoring phenomenology.)
- **Language → rigorously allographic.** It *is* a notation: a character-set, a
  definition of compliance. A `.tab` file is a score in the strict sense — any correct
  resolver producing a correct resolution is a genuine instance, no forgery possible.
  **This is the deepest reason "Roll is one client": clients are *compliants of the
  language-character.* The conformance fixtures are Goodman's compliance class made
  executable** — the formal definition of a correct reading, finally written down.

### 6.4 The contribution nobody built: the reverse bridge
History ran one way only: **allographic intention → autographic performance** (mean a
glide, perform it, the take becomes the thing). **Tabota runs it backwards.** A
captured mimu/Seaboard gesture — pure autographic noise, a specific take — can be
**best-fit, splined, smoothed, redrawn** into a `.tab` curve. That is
**autographic-to-allographic transcription of *continuity itself.*** Impossible before
because **there was no allographic notation for continuous gesture to transcribe
*into*** — staff notation can't hold the curve, MIDI can't, only a capture could.
Tabota built the **target** that makes the transcription possible: it lets a
performance become a **score** *without flattening its continuity into discrete notes.*

And it doesn't close the autographic door: the drawn-from-scratch line and the
transcribed-from-performance line are the **same kind of object**, indistinguishable
once written, both editable after the fact. The performer who wants the take *as a
take* keeps the high-noise recording; the one who wants it *as a score* redraws it.
**Same gesture, two ontologies, the user chooses which object it is.**

> **Canonical formulation to adopt:** *The Roll is the autographic face; the language
> is the allographic spine; Tabota's unbuilt-elsewhere contribution is the converter
> between them for continuous material — the first notation continuity can be
> transcribed into, which is what lets a performed gesture become an editable score
> without being amputated into notes.* The painter's freedom (free the mark from prior
> time-commitment) was the **means**; the composer's score (a writable character for
> the continuous line) was the **end**; the bridge, run in reverse, is what's new.

---

## 7. Why the audience feels small (and why that's not "niche")

The two groups who "don't feel the need" are defined by **opposite amputations**:
- **Timbre-forward producers** had **relation** trained out — one luminous voice and a
  grid, nothing left to chart.
- **Notation-bound composers** had **material gesture** trained out — the note as a
  symbol on a staff, not a shaped material thing. (Spectralists are closer — they hear
  pitch as acoustic material — but even they bent it back onto the staff.)

Tabota needs someone who feels **both** pulls at once; that intersection is small.
But the tools **manufactured** the absence of the need, in both directions. This is
not underserving a market — it is naming a gap the existing software made invisible.
Lonelier, and the only condition under which a thing like this is worth building: if
the need were obvious, it would already exist.

---

## 8. Style invariants to preserve (don't flatten these)

- **Re-hued neutrals, never achromatic gray.** Paper = green-cyan; ink = dark teal,
  not black; panels = low-chroma plum. The refusal of pure gray is a *thesis marker*,
  not a taste.
- **Cream/page, not chrome/metal.** Warm milky ground over cold silver. Page = the
  mark holds; metal = the rig performs.
- **Low-contrast hue-distinction** of lines vs areas (the instrument dialect,
  relocated): faint green/plum gridlines, not heavy borders.
- **Pre-skin bones, gentle-skin finish.** Group-box panels, etched dividers,
  structure-paired-with-calibration density; soft rounded rectangles (~7–14px), no
  full circles, no brushed-metal knobs.
- **Type as conscious anachronism.** Fraunces (wonky warm Windsor-revival display) over
  IBM Plex Mono (humanist technical mono): warmth on a technical substrate. The chrome
  remembers ~1997–2001; the **anti-aliased lettering refuses to.** Keep that seam
  visible.
- **Grain overlay** (~5% multiply) — anti-flatness; insists on paper and friction.
- **田** logo motif; ecological vocabulary (paper, algae, tide, ember, plum) — keeps
  the register *garden / page*, never *lab / rack*.
- **Engraving quotation kept with irony.** Double barline "as in notation," end-flag —
  borrow the engraved page's gravitas for a system designed to dethrone what the
  engraved page assumes. Quotation-with-irony, not nostalgia.

---

## 9. Development implications (what the convictions demand)

Roadmap items reframed as consequences of the above, so priority follows from
principle:

1. **Spline levers / pen-tool curve editing** — *promote from "nicety" to thesis
   statement* (§5). Editable bezier-style control over the continuous line, after the
   fact. This is the most direct expression of "graphics' inscription ontology, in
   sound."
2. **Conformance fixture suite** (canonical `.tab` + expected resolved output) —
   *this is the compliance class made executable* (§6.3) and *the public algorithm to
   OSC's private key* (§3.1). It is what converts Tabota from "my editor's behavior
   with a file extension" into a **portable allographic notation**. Highest-leverage
   single artifact; everything about the Rosetta-Stone mission depends on it.
3. **Gesture-import → transcription pipeline** — best-fit / spline / smooth a captured
   MPE/gesture stream into editable `.tab` curves (§6.4). The reverse bridge; nobody
   else has the target to transcribe *into*. Even a rough first pass demonstrates the
   contribution.
4. **Keep achronous (sequential / instruction / conditional-trigger) alive in the
   *language*** even while shelved from the Roll (§4.1) — the existence proof that
   Tabota is not a scheduler. Don't let Roll-pragmatism quietly delete it from the
   spec.
5. **WAV-as-event + metadata**, not internal audio storage (§4.2) — keep the audio a
   *referent the description points at*, never a thing the description contains.
6. **Adapters / translators out to OSC, SuperCollider, Max, MusicXML** — Tabota as the
   master the others *project down from* (§4). Each adapter is a lossy projection, by
   design; the `.tab` stays the high-fidelity master.
7. **Surface discipline:** every new control checks against §8. Before adding a
   visual, ask: does it read as *inscribed/page* or as *fired/rig*? If the latter,
   it's lying about the ontology.

---

## 10. The position in one breath

Tabota is **the description-language commons every prior system failed to become** —
MIDI too caged, OSC too private, Csound too terminal-bound, MusicXML too staff-bound —
built by a working composer who needs it daily, **born in the inscription register of
the image editor** rather than the transmission register of the sequencer,
**refusing to splinter** because the point is to be the **field where the splinters
meet.** The Rosetta Stone can't be one of the languages; it can only be the master
they all translate through. The Roll is where it's **proven**; the language is what
makes it **true** — *roll-first* (epistemic) and *language-first* (ontological) with
no contradiction between them. The aesthetics aren't decoration on that bet. **They
are the bet.**

---

*End of field notes. Revisit when a design decision feels arbitrary — odds are the
relevant conviction is in here, and the decision either follows from it or is quietly
fighting it.*
