# Assumptions & Design Decisions

The task spec leaves a number of details open to interpretation. Rather than
guess silently, every judgment call made while building this app is logged
here, in the order it came up.

## 1. Likes is displayed despite not being in the "Generated Data" list
The spec's "Generated Data" section lists index, title, artist, album, and
genre as the required fields per row/card, but a separate "Likes per Song"
section defines an elaborate generation rule for a likes count. Since the
toolbar explicitly lets the user control average likes, that control would
have no visible effect if likes were never shown. **Decision:** display likes
as an additional field on both the Table row and Gallery card.

## 2. 64-bit seed representation
JavaScript's `number` type only safely represents integers up to 2^53,
short of the full 64-bit range the spec asks for. **Decision:** the seed is
carried as a numeric string (`SeedValue = string`) through the UI and API,
and only parsed into a `BigInt` inside the RNG engine where the arithmetic
actually happens.

## 3. Two independent RNG streams per record (content vs. likes)
The spec requires that changing the likes parameter never changes titles,
artists, albums, genres, or covers, while changing seed/region changes all
of those — and that everything stays reproducible from the seed alone.
**Decision:** each record derives two separate RNG streams from
`(seed, page, index)`, using different salts so they never correlate: one
feeds all content/cover generation, the other feeds only the likes draw.
The likes stream's underlying random draw depends only on
`(seed, page, index)` — *not* on `likesAvg` — so the raw draw itself is
stable. `likesAvg` is only used afterwards, as the threshold that turns
that stable draw into a 0/1 "bonus like." A nice side effect: a given
record's likes count changes smoothly and predictably as the slider moves
across an integer boundary, rather than jumping unpredictably.

## 4. Fractional likes above 1
The spec gives worked examples only for averages of 0, 0.5, and 10.
**Decision:** for an average like 3.7, every song gets `floor(3.7) = 3`
likes guaranteed, plus a 70% chance (the fractional part) of one additional
like. This generalizes the spec's 0.5 example and hits the target average
exactly.

## 5. Table pagination has no fixed upper bound
"No hardcoded limit" plus server-side-only generation means there's no
natural "last page" to compute or display. **Decision:** Table pagination
uses Previous/Next-style controls (with a jump-to-page-number input) rather
than numbered page buttons that imply a known total.

## 6. What "the correct title" on the cover means
The spec says the cover must render "the correct title" and "the correct
artist name," without saying whether "title" means the song title or the
album title. **Decision:** mirroring real album art conventions, the cover
shows the album title when one exists, and the song title when the record
is a "Single."

## 7. "Single" stays in English across all locales
The spec specifies the album field's non-album value as "the literal string
'Single'" rather than describing it as translatable content. **Decision:**
this literal stays as the English word "Single" regardless of the selected
locale, since the spec frames it as a fixed marker, not generated content.

## 8. Audio is locale-independent
The "Localization Rules" section explicitly scopes the localization
requirement to title, artist, album, and genre. **Decision:** the generated
music itself (notes, tempo, instrumentation) depends only on the seed and
record index, not on the selected locale — only the textual fields and the
genre label change with locale.

## 9. Review text (and lyrics, if built) are localized anyway
Not explicitly required by the localization rule, but for a consistent user
experience, review text and any lyrics are generated in the selected
locale's language rather than always in English.

## 10. Export ZIP scope (optional feature)
If the optional export feature is built, it exports only the
currently-loaded page/batch of songs, not an arbitrary user-specified count,
since the spec doesn't define a scope for it.

## 11. Cover art is generated only for the expanded Table row, not Gallery cards
The spec's detailed cover-art requirements (rendered title/artist, randomized
background) appear specifically under the "Table View" section, describing
the expanded row's detail panel. The "Generated Data" section that applies
to both Table rows and Gallery cards only requires index/title/artist/
album/genre. **Decision:** Gallery cards keep a placeholder cover box rather
than generating full cover art for every card — doing so for potentially
hundreds of cards loaded via infinite scroll would be far heavier server
load than the spec's lazy, click-to-expand Table design implies.

## 12. Cover rendering uses server-side Canvas, not AI image generation
Cover art uses Node's `canvas` package (a server-side implementation of the
HTML5 Canvas API) to draw gradients, soft glow effects, grain texture, and
icon silhouettes — all computed directly from the seeded RNG stream. No
external images, stock photography, or AI image-generation services are
used. This keeps cover generation free, near-instant, and perfectly
reproducible from the seed alone, at the cost of true photographic or
illustrated realism, which only an actual trained image model could
produce.

## 13. Covers vary by composition template, not only by color
Early versions of the cover generator varied palette and icon choice but
kept one fixed layout, which made every cover feel like the same design
recolored. **Decision:** the generator now picks from several structurally
different templates (glow badge, wallpaper print, diagonal block, sunburst
badge, big typography, rings + sticker tag), each with its own background
structure, icon treatment, and text placement, so variety comes from layout
as well as color.

## 14. Cover backgrounds use a free, no-signup AI image API; text is drawn separately
Cover art now fetches AI-generated background imagery from Pollinations.ai's
free, unauthenticated image endpoint, then composites our own crisp
title/artist text on top (AI image models are unreliable at rendering
accurate text, so the model is explicitly told not to attempt it).
**Trade-off accepted knowingly:** because this depends on an external,
evolving free service, the spec's "same seed produces identical data
forever, on any device" guarantee becomes best-effort for cover art
specifically (it still holds exactly for titles/artists/albums/genres/
likes, which never touch the network). If the AI request fails or is
rate-limited (anonymous tier allows ~1 request/15s), generation falls back
to a simple procedural gradient so a row never breaks. The mood/style
vocabulary used to build the prompt is generic English art-direction
language, not user-facing localized content, so it isn't subject to the
"no hardcoded locale data" rule.

## 15. Audio uses its own independent RNG stream
Earlier phases used contentRng for a placeholder audio stub, but that meant
audio's position in the RNG sequence depended on how many draws locale-
specific text generation happened to consume — silently breaking the
"audio is locale-independent" decision from #8. **Decision:** audio now
derives from a third, fully independent stream (audioRng), salted
separately from content and likes, depending only on (seed, page, index).

## 16. Song structure and instrumentation choices
Each generated song uses a verse/chorus/verse/chorus form built from two
different 4-chord diatonic progressions (drawn from pools of common major
or natural-minor progressions, triads only — no diminished chords, to keep
harmony consistently consonant). Three tracks per song: a sustained bass
note on the chord root, a sustained pad playing the full chord, and a
melody voice that favors chord tones (70%) with occasional scale passing
tones (30%) and occasional rests, aiming for "coherent melody" over random
pitches per the spec's grading note. Each track gets its own randomly
chosen oscillator waveform for timbral variety. Playback uses a per-row
synth + reverb + delay chain via Tone.js, scheduled directly against
Tone.now() rather than the shared global Transport — this keeps multiple
rows' audio from interfering with each other and keeps cleanup self-
contained per row.

## 17. Music varies by style template, not just key/tempo/chords
Early versions varied key, tempo, and chord progression but used one fixed
structure throughout (sustained bass, sustained pad, quarter-note melody),
making every song feel structurally identical despite harmonic variety.
**Decision:** generateSongAudio now first picks one of several style
templates (ballad, pop-rock, electronic, ambient, acoustic-folk,
funk-groove), each defining its own bass rhythm, pad behavior, melody
density/subdivision, optional percussion pattern, timbre pool, and ADSR
envelope shapes. Key, tempo, and chord progression are still chosen
independently within whichever template gets picked, so variety compounds
across both "what genre" and "what notes."

## 18. Review text templates live in locale config, not in code
Sentence scaffolding (connector words, grammar, word order) is inherently
language-specific, so hardcoding English templates and only swapping in
locale-correct nouns/adjectives wouldn't produce genuine German or
Ukrainian sentences — it would produce English grammar wearing foreign
vocabulary. **Decision:** each locale config file defines its own
`reviewTemplates` array with placeholder tokens, filled in by that locale's
faker word generators plus the song's own title/artist/genre. Known
limitation: individual faker-generated words don't always inflect with
correct grammatical agreement (case/gender) once dropped into a template,
particularly for German and Ukrainian — accepted as within the spec's
explicit tolerance for "nonsensical but realistic-looking" content.

## 19. Lyrics are timed to song structure, worded independently
Lyric cue times come from audioRng (one line per verse/chorus pass through
the chord progression), while the words themselves come from contentRng via
locale-specific templates — same separation of "timing" from "words" used
elsewhere. Lyrics have no real semantic connection to the instrumental
audio; they're decorative text synced to playback timing only.

## 20. Export renders audio client-side, skips cover art and Reverb
The Export feature fetches only text + audio data (via a dedicated
lightweight endpoint that skips cover-art generation entirely, avoiding the
rate-limited AI image service for a batch of 20 songs at once). Each song's
audio is rendered to a real MP3 in-browser via Tone.Offline, reusing the
same synth/effects code as the live "Play preview" button, then zipped with
JSZip. One deliberate difference from the live preview: exported audio
skips the Reverb effect (keeping only delay/echo) to avoid generating an
expensive impulse response for every song in a batch — judged a reasonable
tradeoff for export speed on an optional feature.

## 21. Title/album/review/lyric words use our own word banks, not faker's `word` module
Testing revealed faker's `word` module (adjective/noun/verb/adverb) has
incomplete data for some locales — Ukrainian silently fell back to English
for these specific calls, while person names and our own genre lists
stayed correctly localized, since those don't route through that module.
**Decision:** title, album, review-template, and lyric-template words now
draw from a curated `wordBank` defined per locale in that locale's config
file — the same externalized-data pattern already used for genres and
templates — rather than faker.word.*. faker is now used only for
`person.fullName()`, where locale coverage is broad and reliable.

## 22. Cover-art vocabulary mined from a creative brief, genre-aware via genre index
A detailed cover-art style brief was distilled into vocabulary pools
(visual style, composition, subject, color mood, aging effects) used in two
places: building richer, genre-aware AI image prompts, and biasing the
procedural fallback's composition/palette choices when the AI request
fails, times out, or is rate-limited. Genre-awareness keys off the genre's
*index* within its locale's genre array (positionally aligned across all
locale config files), not the localized display string, so it works
correctly regardless of selected language.

## 23. Fallback randomness is pre-planned to keep RNG draw-count network-independent
Earlier, the procedural fallback only consumed extra random draws when the
AI request actually failed — meaning contentRng's draw count (and therefore
everything generated afterward, like review text and lyrics) silently
depended on network luck, breaking reproducibility whenever Pollinations'
success/failure was inconsistent across runs. **Decision:** all randomness
for both the AI prompt and the procedural fallback (composition, palette,
subject motif, textures, text placement) is now decided upfront via
`planFallback`/`planTextPlacement`, fully consumed before the network call
happens. Drawing functions only consume pre-stored seed numbers (each spun
into its own local, throwaway RNG), never the outer stream directly — so
the outer stream's draw count is fixed regardless of which branch ends up
actually drawing.

## 24. Music engine: real structure, motif, voice-leading, dynamics, humanization
Following a detailed composition brief, the music generator now builds:
independent intro/verse/chorus/bridge/outro sections (chosen from a few
randomized structure templates) each with its own chord progression; a
short motif generated once per song and replayed with variation
(transposition/rhythm change/truncation) at the start of every chorus; bass
notes chosen via simplified voice-leading (smallest pitch-class movement
from the previous chord, not full SATB theory); per-section dynamics
(intro/outro thin out, bridge drops bass+drums, chorus is full energy);
small humanization jitter on every note's time/duration/velocity; swing on
applicable styles; drum fills before transitions into chorus/bridge; a
wider, weighted scale palette (8 scales); and a Chorus effect alongside
Reverb/Delay. Deliberately not implemented: a literal Markov-chain melody
engine and a full two-voice call-and-response system — both are
research-grade composition features whose complexity-to-audible-benefit
ratio is poor at this project's "short preview clip" scale. Chord harmony
uses simplified major/minor-family progressions even for exotic scales
(Dorian, Phrygian, etc.), since tonal's roman-numeral builder only
understands major/minor diatonic quality — melody still draws its actual
notes from the true selected scale.

## 25. Cover text rendering requires bundled fonts, not system fonts
node-canvas has no fonts of its own — locally it was silently using
whatever fonts the OS had installed (Arial/Helvetica Neue on Windows),
which don't exist on Vercel's serverless containers, causing blank
title/artist text in production. **Decision:** bundle Noto Sans (Regular +
Bold, static instances extracted from Google's variable font — variable
fonts have inconsistent weight-axis support in node-canvas) directly in the
repo at `src/assets/fonts/`, register them explicitly via `registerFont()`,
and use `outputFileTracingIncludes` in `next.config.ts` so Vercel's bundler
actually ships the font files with the serverless function. Noto Sans was
chosen specifically for its Cyrillic + Latin Extended coverage, needed for
the Ukrainian and German locales.
---
This file is updated as new ambiguities are resolved in later phases.