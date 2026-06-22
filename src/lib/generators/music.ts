import { Chord, Note, Progression, Scale } from "tonal";
import type {
  SongAudio,
  OscillatorWave,
  NoteEvent,
  ChordEvent,
  HitEvent,
  EnvelopeSettings,
} from "@/types/song";

type Rng = {
  next(): number;
  nextInt(max: number): number;
  nextIntRange(min: number, max: number): number;
  pick<T>(arr: T[]): T;
};

function rngBetween(rng: Rng, min: number, max: number): number {
  return min + rng.next() * (max - min);
}
function rngInt(rng: Rng, min: number, max: number): number {
  return Math.floor(rngBetween(rng, min, max + 1));
}
function sortByTime<T extends { time: number }>(arr: T[]): T[] {
  return [...arr].sort((a, b) => a.time - b.time);
}

const ROOTS = ["C", "C#", "D", "D#", "E", "F", "F#", "G", "G#", "A", "A#", "B"];

// ============================================================
// Scale palette — weighted toward Major/Minor/Dorian/Mixolydian.
// `family` decides which roman-numeral chord pool gets used (tonal's
// roman-numeral builder only understands major/minor quality rules) —
// melody still draws its actual notes from the true, exotic scale.
// ============================================================

interface ScaleOption { name: string; family: "major" | "minor"; weight: number }
const SCALE_OPTIONS: ScaleOption[] = [
  { name: "major", family: "major", weight: 3 },
  { name: "minor", family: "minor", weight: 3 },
  { name: "dorian", family: "minor", weight: 2 },
  { name: "mixolydian", family: "major", weight: 2 },
  { name: "harmonic minor", family: "minor", weight: 1 },
  { name: "melodic minor", family: "minor", weight: 1 },
  { name: "phrygian", family: "minor", weight: 1 },
  { name: "lydian", family: "major", weight: 1 },
];
function pickWeightedScale(rng: Rng): ScaleOption {
  const total = SCALE_OPTIONS.reduce((s, o) => s + o.weight, 0);
  let roll = rng.next() * total;
  for (const opt of SCALE_OPTIONS) {
    if (roll < opt.weight) return opt;
    roll -= opt.weight;
  }
  return SCALE_OPTIONS[0];
}

const MAJOR_PROGRESSIONS: string[][] = [
  ["I", "IV", "V", "I"], ["I", "V", "vi", "IV"], ["vi", "IV", "I", "V"],
  ["I", "vi", "IV", "V"], ["ii", "V", "I", "vi"], ["I", "iii", "IV", "V"],
];
const MINOR_PROGRESSIONS: string[][] = [
  ["i", "iv", "v", "i"], ["i", "VI", "III", "VII"], ["i", "iv", "VII", "III"],
  ["i", "VII", "VI", "VII"], ["i", "v", "iv", "i"], ["VI", "VII", "i", "i"],
];
function buildProgression(rng: Rng, tonic: string, family: "major" | "minor"): string[] {
  const pool = family === "major" ? MAJOR_PROGRESSIONS : MINOR_PROGRESSIONS;
  return Progression.fromRomanNumerals(tonic, rng.pick(pool));
}

// ============================================================
// Song structure
// ============================================================

type SectionType = "intro" | "verse" | "chorus" | "bridge" | "outro";
const STRUCTURES: SectionType[][] = [
  ["intro", "verse", "chorus", "verse", "chorus", "bridge", "chorus", "outro"],
  ["intro", "verse", "verse", "chorus", "verse", "chorus", "outro"],
  ["intro", "verse", "chorus", "verse", "chorus", "outro"],
  ["intro", "verse", "chorus", "bridge", "chorus", "outro"],
];

interface SectionMask { bass: boolean; pad: boolean; melody: boolean; percussion: boolean; velocityMul: number }
const SECTION_MASKS: Record<SectionType, SectionMask> = {
  intro: { bass: true, pad: true, melody: false, percussion: false, velocityMul: 0.7 },
  verse: { bass: true, pad: true, melody: true, percussion: true, velocityMul: 0.85 },
  chorus: { bass: true, pad: true, melody: true, percussion: true, velocityMul: 1.0 },
  bridge: { bass: false, pad: true, melody: true, percussion: false, velocityMul: 0.75 },
  outro: { bass: true, pad: true, melody: false, percussion: false, velocityMul: 0.6 },
};

// ============================================================
// Style templates — 11 total: the 9 named in the brief (Pop, Rock, Indie,
// Electronic, Ambient, Lo-Fi, Cinematic, Jazz, Synthwave) plus Ballad and
// Funk-Groove as bonus extra variety. EQ/compressor values are fixed,
// genre-appropriate production choices per style (a mixing decision, not
// something that should vary song-to-song within one genre).
// ============================================================

type BassPattern = "sustained" | "pulse" | "walking" | "arpeggio" | "syncopated";
type PadMode = "sustained" | "stab" | "arpeggio" | "swell" | "none";
type PercussionPattern = "none" | "four-on-floor" | "backbeat" | "syncopated";

interface StyleTemplate {
  name: string;
  tempoRange: [number, number];
  bassPattern: BassPattern;
  padMode: PadMode;
  melodySubdivision: number;
  restChance: number;
  percussion: PercussionPattern;
  swing: boolean;
  hasAtmosphere: boolean;
  hasCountermelody: boolean;
  waves: { bass: OscillatorWave[]; pad: OscillatorWave[]; melody: OscillatorWave[] };
  envelopes: { bass: EnvelopeSettings; pad: EnvelopeSettings; melody: EnvelopeSettings };
  reverbRange: [number, number];
  delayFeedbackRange: [number, number];
  delayTimePool: number[];
  eq: { low: number; mid: number; high: number };
  compressor: { threshold: number; ratio: number };
}

const STYLE_TEMPLATES: StyleTemplate[] = [
  {
    name: "ballad", tempoRange: [60, 84], bassPattern: "sustained", padMode: "sustained",
    melodySubdivision: 1, restChance: 0.35, percussion: "none", swing: false,
    hasAtmosphere: true, hasCountermelody: false,
    waves: { bass: ["sine", "triangle"], pad: ["sine", "triangle"], melody: ["sine", "triangle"] },
    envelopes: {
      bass: { attack: 0.05, decay: 0.3, sustain: 0.6, release: 0.8 },
      pad: { attack: 1.2, decay: 0.5, sustain: 0.8, release: 2.5 },
      melody: { attack: 0.03, decay: 0.2, sustain: 0.3, release: 0.4 },
    },
    reverbRange: [0.3, 0.55], delayFeedbackRange: [0.05, 0.15], delayTimePool: [0.25, 0.375],
    eq: { low: 0, mid: 1, high: -1 }, compressor: { threshold: -20, ratio: 2.5 },
  },
  {
    name: "pop", tempoRange: [95, 130], bassPattern: "pulse", padMode: "stab",
    melodySubdivision: 0.5, restChance: 0.2, percussion: "backbeat", swing: false,
    hasAtmosphere: false, hasCountermelody: true,
    waves: { bass: ["triangle", "sine"], pad: ["triangle", "square"], melody: ["triangle", "square", "sine"] },
    envelopes: {
      bass: { attack: 0.01, decay: 0.15, sustain: 0.3, release: 0.18 },
      pad: { attack: 0.01, decay: 0.1, sustain: 0.2, release: 0.18 },
      melody: { attack: 0.005, decay: 0.08, sustain: 0.18, release: 0.12 },
    },
    reverbRange: [0.15, 0.3], delayFeedbackRange: [0.1, 0.2], delayTimePool: [0.125, 0.1875],
    eq: { low: 1, mid: 2, high: 2 }, compressor: { threshold: -18, ratio: 4 },
  },
  {
    name: "rock", tempoRange: [105, 145], bassPattern: "pulse", padMode: "stab",
    melodySubdivision: 0.5, restChance: 0.15, percussion: "backbeat", swing: false,
    hasAtmosphere: false, hasCountermelody: true,
    waves: { bass: ["sawtooth", "triangle"], pad: ["sawtooth", "square"], melody: ["sawtooth", "square"] },
    envelopes: {
      bass: { attack: 0.005, decay: 0.12, sustain: 0.3, release: 0.12 },
      pad: { attack: 0.005, decay: 0.08, sustain: 0.18, release: 0.12 },
      melody: { attack: 0.005, decay: 0.06, sustain: 0.15, release: 0.1 },
    },
    reverbRange: [0.08, 0.2], delayFeedbackRange: [0.08, 0.18], delayTimePool: [0.125, 0.1875],
    eq: { low: 2, mid: 1, high: 3 }, compressor: { threshold: -16, ratio: 5 },
  },
  {
    name: "indie", tempoRange: [85, 115], bassPattern: "walking", padMode: "arpeggio",
    melodySubdivision: 1, restChance: 0.25, percussion: "none", swing: false,
    hasAtmosphere: false, hasCountermelody: false,
    waves: { bass: ["triangle", "sine"], pad: ["triangle", "sine"], melody: ["triangle", "sine"] },
    envelopes: {
      bass: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.4 },
      pad: { attack: 0.01, decay: 0.4, sustain: 0.1, release: 0.5 },
      melody: { attack: 0.01, decay: 0.25, sustain: 0.2, release: 0.3 },
    },
    reverbRange: [0.1, 0.2], delayFeedbackRange: [0.05, 0.1], delayTimePool: [0.1875, 0.25],
    eq: { low: 0, mid: 1, high: 1 }, compressor: { threshold: -20, ratio: 3 },
  },
  {
    name: "electronic", tempoRange: [124, 160], bassPattern: "arpeggio", padMode: "arpeggio",
    melodySubdivision: 0.5, restChance: 0.1, percussion: "four-on-floor", swing: false,
    hasAtmosphere: true, hasCountermelody: false,
    waves: { bass: ["sawtooth", "square"], pad: ["sawtooth", "square"], melody: ["square", "sawtooth"] },
    envelopes: {
      bass: { attack: 0.005, decay: 0.1, sustain: 0.1, release: 0.08 },
      pad: { attack: 0.005, decay: 0.08, sustain: 0.1, release: 0.08 },
      melody: { attack: 0.005, decay: 0.06, sustain: 0.1, release: 0.08 },
    },
    reverbRange: [0.15, 0.3], delayFeedbackRange: [0.25, 0.4], delayTimePool: [0.125, 0.1875],
    eq: { low: 4, mid: 0, high: 2 }, compressor: { threshold: -14, ratio: 6 },
  },
  {
    name: "ambient", tempoRange: [50, 70], bassPattern: "sustained", padMode: "swell",
    melodySubdivision: 1, restChance: 0.55, percussion: "none", swing: false,
    hasAtmosphere: true, hasCountermelody: false,
    waves: { bass: ["sine"], pad: ["sine", "triangle"], melody: ["sine", "triangle"] },
    envelopes: {
      bass: { attack: 0.6, decay: 0.5, sustain: 0.8, release: 1.5 },
      pad: { attack: 2, decay: 1, sustain: 0.9, release: 3.5 },
      melody: { attack: 0.3, decay: 0.4, sustain: 0.5, release: 1.2 },
    },
    reverbRange: [0.5, 0.7], delayFeedbackRange: [0.2, 0.35], delayTimePool: [0.375],
    eq: { low: 0, mid: -1, high: -2 }, compressor: { threshold: -24, ratio: 1.5 },
  },
  {
    name: "funk-groove", tempoRange: [95, 118], bassPattern: "syncopated", padMode: "stab",
    melodySubdivision: 0.5, restChance: 0.25, percussion: "syncopated", swing: true,
    hasAtmosphere: false, hasCountermelody: false,
    waves: { bass: ["triangle", "square"], pad: ["square", "triangle"], melody: ["triangle", "square", "sawtooth"] },
    envelopes: {
      bass: { attack: 0.005, decay: 0.12, sustain: 0.2, release: 0.1 },
      pad: { attack: 0.005, decay: 0.08, sustain: 0.1, release: 0.1 },
      melody: { attack: 0.005, decay: 0.1, sustain: 0.15, release: 0.12 },
    },
    reverbRange: [0.15, 0.3], delayFeedbackRange: [0.15, 0.25], delayTimePool: [0.1875, 0.25],
    eq: { low: 2, mid: 2, high: 1 }, compressor: { threshold: -16, ratio: 5 },
  },
  {
    name: "lofi", tempoRange: [60, 90], bassPattern: "sustained", padMode: "sustained",
    melodySubdivision: 0.5, restChance: 0.5, percussion: "syncopated", swing: true,
    hasAtmosphere: true, hasCountermelody: false,
    waves: { bass: ["sine", "triangle"], pad: ["sine", "triangle"], melody: ["sine", "triangle"] },
    envelopes: {
      bass: { attack: 0.05, decay: 0.3, sustain: 0.5, release: 0.6 },
      pad: { attack: 1.5, decay: 0.6, sustain: 0.7, release: 2 },
      melody: { attack: 0.05, decay: 0.3, sustain: 0.3, release: 0.5 },
    },
    reverbRange: [0.25, 0.45], delayFeedbackRange: [0.15, 0.3], delayTimePool: [0.25, 0.375],
    eq: { low: 1, mid: -1, high: -4 }, compressor: { threshold: -22, ratio: 2 },
  },
  {
    name: "cinematic", tempoRange: [60, 90], bassPattern: "sustained", padMode: "swell",
    melodySubdivision: 1, restChance: 0.4, percussion: "none", swing: false,
    hasAtmosphere: true, hasCountermelody: true,
    waves: { bass: ["sine", "triangle"], pad: ["sine", "triangle"], melody: ["sine", "triangle"] },
    envelopes: {
      bass: { attack: 0.3, decay: 0.4, sustain: 0.7, release: 1.2 },
      pad: { attack: 2.5, decay: 1, sustain: 0.85, release: 4 },
      melody: { attack: 0.2, decay: 0.3, sustain: 0.5, release: 1 },
    },
    reverbRange: [0.4, 0.6], delayFeedbackRange: [0.1, 0.2], delayTimePool: [0.375],
    eq: { low: 1, mid: 0, high: 0 }, compressor: { threshold: -22, ratio: 2 },
  },
  {
    name: "jazz", tempoRange: [90, 140], bassPattern: "walking", padMode: "stab",
    melodySubdivision: 0.5, restChance: 0.3, percussion: "syncopated", swing: true,
    hasAtmosphere: false, hasCountermelody: true,
    waves: { bass: ["triangle", "sine"], pad: ["triangle", "sine"], melody: ["triangle", "sine"] },
    envelopes: {
      bass: { attack: 0.02, decay: 0.4, sustain: 0.2, release: 0.3 },
      pad: { attack: 0.01, decay: 0.3, sustain: 0.15, release: 0.4 },
      melody: { attack: 0.01, decay: 0.2, sustain: 0.25, release: 0.3 },
    },
    reverbRange: [0.2, 0.4], delayFeedbackRange: [0.05, 0.15], delayTimePool: [0.1875, 0.25],
    eq: { low: 0, mid: 1, high: 0 }, compressor: { threshold: -24, ratio: 1.8 },
  },
  {
    name: "synthwave", tempoRange: [85, 118], bassPattern: "pulse", padMode: "swell",
    melodySubdivision: 0.5, restChance: 0.2, percussion: "backbeat", swing: false,
    hasAtmosphere: true, hasCountermelody: true,
    waves: { bass: ["sawtooth", "square"], pad: ["sawtooth", "square"], melody: ["sawtooth", "square"] },
    envelopes: {
      bass: { attack: 0.01, decay: 0.15, sustain: 0.4, release: 0.2 },
      pad: { attack: 0.8, decay: 0.5, sustain: 0.7, release: 1.5 },
      melody: { attack: 0.02, decay: 0.15, sustain: 0.3, release: 0.25 },
    },
    reverbRange: [0.3, 0.5], delayFeedbackRange: [0.2, 0.35], delayTimePool: [0.25, 0.375],
    eq: { low: 3, mid: -1, high: 3 }, compressor: { threshold: -16, ratio: 4.5 },
  },
];

// ============================================================
// Voice leading — simplified: choose whichever chord tone has the
// smallest pitch-class distance to the previous chosen bass tone, at a
// fixed octave.
// ============================================================

function chromaDistance(a: number, b: number): number {
  const diff = Math.abs(a - b) % 12;
  return Math.min(diff, 12 - diff);
}
function orderByVoiceLeading(chordTones: string[], prevPc: string | null): string[] {
  if (!prevPc) return chordTones;
  const prevChroma = Note.chroma(prevPc) ?? 0;
  return [...chordTones].sort(
    (a, b) => chromaDistance(Note.chroma(a) ?? 0, prevChroma) - chromaDistance(Note.chroma(b) ?? 0, prevChroma)
  );
}

// ============================================================
// Motif system — one short motif per song, played at the start of every
// chorus, varied per occurrence: transposition, rhythm change,
// truncation, or melodic inversion (reflected around the motif's first
// note, in scale-degree space — a simplified stand-in for true interval
// inversion, but a real, recognizable transform, not just a relabeling).
// ============================================================

interface MotifNote { degree: number; beats: number }

function generateMotif(rng: Rng): MotifNote[] {
  const length = 3 + rngInt(rng, 0, 2);
  const strongDegrees = [0, 2, 4];
  const beatPool = [0.5, 1, 1, 1.5];
  return Array.from({ length }, () => ({
    degree: rng.next() < 0.7 ? rng.pick(strongDegrees) : rngInt(rng, 0, 6),
    beats: rng.pick(beatPool),
  }));
}
function varyMotif(rng: Rng, motif: MotifNote[], occurrence: number): MotifNote[] {
  if (occurrence === 0) return motif;
  const transform = rngInt(rng, 0, 4);
  if (transform === 0) return motif;
  if (transform === 1) return motif.map((n) => ({ ...n, degree: n.degree + (rng.next() < 0.5 ? 2 : -2) }));
  if (transform === 2) return motif.map((n) => ({ ...n, beats: n.beats * (rng.next() < 0.5 ? 2 : 0.5) }));
  if (transform === 3) return motif.slice(0, Math.max(2, motif.length - 1));
  const pivot = motif[0].degree;
  return motif.map((n) => ({ ...n, degree: 2 * pivot - n.degree }));
}
function renderMotif(
  motif: MotifNote[], scaleNotes: string[], startTime: number,
  secondsPerBeat: number, velocityMul: number, maxBeats: number
): NoteEvent[] {
  const totalBeats = motif.reduce((sum, n) => sum + n.beats, 0);
  const scale = totalBeats > maxBeats ? maxBeats / totalBeats : 1;
  let t = startTime;
  return motif.map(({ degree, beats }) => {
    const scaledBeats = beats * scale;
    const len = scaleNotes.length;
    const wrapped = ((degree % len) + len) % len;
    const note: NoteEvent = {
      note: `${scaleNotes[wrapped]}5`, time: t, duration: scaledBeats * secondsPerBeat * 0.9, velocity: 0.75 * velocityMul,
    };
    t += scaledBeats * secondsPerBeat;
    return note;
  });
}

// ============================================================
// Per-chord generators
// ============================================================

function generateBassForChord(
  rng: Rng, pattern: BassPattern, chordTones: string[], t: number,
  chordDuration: number, beatsPerChord: number, secondsPerBeat: number, velocityMul: number
): NoteEvent[] {
  const root = chordTones[0];
  const fifth = chordTones[2] ?? root;
  if (pattern === "sustained") return [{ note: `${root}2`, time: t, duration: chordDuration * 0.95, velocity: 0.9 * velocityMul }];
  if (pattern === "pulse") {
    return Array.from({ length: beatsPerChord }, (_, b) => ({
      note: `${root}2`, time: t + b * secondsPerBeat, duration: secondsPerBeat * 0.85, velocity: 0.85 * velocityMul,
    }));
  }
  if (pattern === "walking") {
    return Array.from({ length: beatsPerChord }, (_, b) => ({
      note: `${b % 2 === 0 ? root : fifth}2`, time: t + b * secondsPerBeat, duration: secondsPerBeat * 0.9, velocity: 0.8 * velocityMul,
    }));
  }
  if (pattern === "arpeggio") {
    const subdiv = secondsPerBeat / 2;
    const steps = beatsPerChord * 2;
    return Array.from({ length: steps }, (_, i) => ({
      note: `${i % 2 === 0 ? root : fifth}2`, time: t + i * subdiv, duration: subdiv * 0.85, velocity: 0.75 * velocityMul,
    }));
  }
  const notes: NoteEvent[] = [];
  for (let b = 0; b < beatsPerChord; b++) {
    if (rng.next() < 0.6) notes.push({ note: `${root}2`, time: t + b * secondsPerBeat, duration: secondsPerBeat * 0.6, velocity: 0.8 * velocityMul });
    if (rng.next() < 0.3) notes.push({ note: `${root}2`, time: t + b * secondsPerBeat + secondsPerBeat * 0.5, duration: secondsPerBeat * 0.3, velocity: 0.6 * velocityMul });
  }
  return notes;
}

function generatePadForChord(
  mode: PadMode, chordTones: string[], t: number, chordDuration: number,
  beatsPerChord: number, secondsPerBeat: number, velocityMul: number
): ChordEvent[] {
  const notesAtOctave = chordTones.map((pc) => `${pc}4`);
  if (mode === "none") return [];
  if (mode === "sustained") return [{ notes: notesAtOctave, time: t, duration: chordDuration * 0.95, velocity: 0.5 * velocityMul }];
  if (mode === "swell") return [{ notes: notesAtOctave, time: t, duration: chordDuration * 1.3, velocity: 0.45 * velocityMul }];
  if (mode === "stab") {
    const events: ChordEvent[] = [];
    for (let b = 0; b < beatsPerChord; b += 2) {
      events.push({ notes: notesAtOctave, time: t + b * secondsPerBeat, duration: secondsPerBeat * 0.3, velocity: 0.6 * velocityMul });
    }
    return events;
  }
  const subdiv = secondsPerBeat / 2;
  const steps = beatsPerChord * 2;
  return Array.from({ length: steps }, (_, i) => ({
    notes: [notesAtOctave[i % notesAtOctave.length]], time: t + i * subdiv, duration: subdiv * 0.85, velocity: 0.5 * velocityMul,
  }));
}

/**
 * Melody: strong preference for chord tones; when not a chord tone, the
 * note is a genuine NEIGHBOR TONE — the scale step directly adjacent to a
 * chord tone — most of the time, with an occasional fully-free scale pick
 * for variety. This is the actual distinction between "neighbor tone" and
 * "arbitrary passing tone."
 */
function generateMelodyForChord(
  rng: Rng, chordTones: string[], scaleNotes: string[], t: number, beatsPerChord: number,
  secondsPerBeat: number, subdivision: number, restChance: number, swing: boolean, velocityMul: number
): NoteEvent[] {
  const stepDuration = secondsPerBeat * subdivision;
  const totalSteps = Math.round(beatsPerChord / subdivision);
  const notes: NoteEvent[] = [];

  for (let i = 0; i < totalSteps; i++) {
    if (rng.next() < restChance) continue;
    let pc: string;
    if (rng.next() < 0.7) {
      pc = rng.pick(chordTones);
    } else {
      const anchor = rng.pick(chordTones);
      const anchorIdx = scaleNotes.indexOf(anchor);
      if (anchorIdx === -1 || rng.next() < 0.3) {
        pc = rng.pick(scaleNotes);
      } else {
        const len = scaleNotes.length;
        const dir = rng.next() < 0.5 ? 1 : -1;
        pc = scaleNotes[((anchorIdx + dir) % len + len) % len];
      }
    }
    let time = t + i * stepDuration;
    if (swing && subdivision === 0.5 && i % 2 === 1) time += stepDuration * 0.15;
    notes.push({ note: `${pc}5`, time, duration: stepDuration * 0.9, velocity: (0.7 + rng.next() * 0.2) * velocityMul });
  }
  return notes;
}

/** Sparse secondary voice, mostly rests, sitting in its own register (octave 3) between bass and pad. */
function generateCountermelodyForChord(rng: Rng, chordTones: string[], t: number, beatsPerChord: number, secondsPerBeat: number, velocityMul: number): NoteEvent[] {
  const notes: NoteEvent[] = [];
  for (let i = 0; i < beatsPerChord; i++) {
    if (rng.next() < 0.7) continue;
    notes.push({ note: `${rng.pick(chordTones)}3`, time: t + i * secondsPerBeat, duration: secondsPerBeat * 0.8, velocity: 0.45 * velocityMul });
  }
  return notes;
}

/** One long swelling wash per section, using that section's first chord — a slow-moving textural backdrop, not meant to track harmony precisely. */
function generateAtmosphereForSection(chordTones: string[], sectionStartTime: number, sectionDuration: number, velocityMul: number): ChordEvent[] {
  return [{ notes: chordTones.map((pc) => `${pc}6`), time: sectionStartTime, duration: sectionDuration, velocity: 0.2 * velocityMul }];
}

// ============================================================
// Percussion
// ============================================================

function generatePercussionForRange(
  rng: Rng, startBeat: number, beatCount: number, secondsPerBeat: number,
  pattern: PercussionPattern, swing: boolean, velocityMul: number
): { kick: HitEvent[]; hat: HitEvent[]; snare: HitEvent[] } {
  const kick: HitEvent[] = [];
  const hat: HitEvent[] = [];
  const snare: HitEvent[] = [];

  for (let i = 0; i < beatCount; i++) {
    const beat = startBeat + i;
    const time = beat * secondsPerBeat;
    const beatInBar = beat % 4;

    if (pattern === "four-on-floor") {
      kick.push({ time, duration: secondsPerBeat * 0.4, velocity: 0.8 * velocityMul });
      let hatTime = time + secondsPerBeat / 2;
      if (swing) hatTime += secondsPerBeat * 0.15;
      hat.push({ time: hatTime, duration: 0.05, velocity: 0.4 * velocityMul });
    } else if (pattern === "backbeat") {
      if (beatInBar === 0) kick.push({ time, duration: secondsPerBeat * 0.4, velocity: 0.85 * velocityMul });
      if (beatInBar === 2) snare.push({ time, duration: secondsPerBeat * 0.3, velocity: 0.85 * velocityMul });
      hat.push({ time, duration: 0.05, velocity: 0.3 * velocityMul });
      let offTime = time + secondsPerBeat / 2;
      if (swing) offTime += secondsPerBeat * 0.15;
      hat.push({ time: offTime, duration: 0.05, velocity: 0.22 * velocityMul });
    } else if (pattern === "syncopated") {
      if (rng.next() < 0.35) kick.push({ time, duration: secondsPerBeat * 0.3, velocity: 0.75 * velocityMul });
      if (rng.next() < 0.5) {
        const offset = rng.next() < 0.5 ? 0.5 : 0.75;
        let hatTime = time + secondsPerBeat * offset;
        if (swing) hatTime += secondsPerBeat * 0.15;
        hat.push({ time: hatTime, duration: 0.05, velocity: 0.3 * velocityMul });
      }
    }
  }
  return { kick, hat, snare };
}

function generateFill(rng: Rng, fillStartTime: number, secondsPerBeat: number): HitEvent[] {
  const hits = 3 + rngInt(rng, 0, 1);
  const slot = secondsPerBeat / hits;
  return Array.from({ length: hits }, (_, i) => ({
    time: fillStartTime + i * slot, duration: slot * 0.8, velocity: 0.5 + (i / hits) * 0.4,
  }));
}

// ============================================================
// Humanization
// ============================================================

function humanizeNotes(rng: Rng, notes: NoteEvent[]): NoteEvent[] {
  return notes.map((n) => ({
    ...n,
    time: Math.max(0, n.time + rngBetween(rng, -0.012, 0.012)),
    duration: Math.max(0.02, n.duration * rngBetween(rng, 0.92, 1.05)),
    velocity: Math.min(1, Math.max(0.05, n.velocity * rngBetween(rng, 0.9, 1.05))),
  }));
}
function humanizeChords(rng: Rng, chords: ChordEvent[]): ChordEvent[] {
  return chords.map((c) => ({
    ...c,
    time: Math.max(0, c.time + rngBetween(rng, -0.012, 0.012)),
    duration: Math.max(0.02, c.duration * rngBetween(rng, 0.92, 1.05)),
    velocity: Math.min(1, Math.max(0.05, c.velocity * rngBetween(rng, 0.9, 1.05))),
  }));
}
function humanizeHits(rng: Rng, hits: HitEvent[]): HitEvent[] {
  return hits.map((h) => ({
    ...h,
    time: Math.max(0, h.time + rngBetween(rng, -0.008, 0.008)),
    velocity: Math.min(1, Math.max(0.05, h.velocity * rngBetween(rng, 0.92, 1.05))),
  }));
}

// ============================================================
// Main entry point
// ============================================================

export function generateSongAudio(rng: Rng): SongAudio {
  const template = rng.pick(STYLE_TEMPLATES);
  const tonic = rng.pick(ROOTS);
  const scaleOption = pickWeightedScale(rng);
  const tempoBpm = rng.nextIntRange(template.tempoRange[0], template.tempoRange[1]);
  const scaleNotes = Scale.get(`${tonic} ${scaleOption.name}`).notes;

  const verseChords = buildProgression(rng, tonic, scaleOption.family);
  const chorusChords = buildProgression(rng, tonic, scaleOption.family);
  const bridgeChords = buildProgression(rng, tonic, scaleOption.family);
  const introChords = verseChords.slice(0, 2);
  const outroChords = chorusChords.slice(-2);

  const sectionChords: Record<SectionType, string[]> = {
    intro: introChords, verse: verseChords, chorus: chorusChords, bridge: bridgeChords, outro: outroChords,
  };

  const structure = rng.pick(STRUCTURES);
  const motif = generateMotif(rng);
  let chorusOccurrence = 0;

  const secondsPerBeat = 60 / tempoBpm;
  const beatsPerChord = 4;
  const chordDuration = beatsPerChord * secondsPerBeat;

  const bassNotes: NoteEvent[] = [];
  const padChords: ChordEvent[] = [];
  const melodyNotes: NoteEvent[] = [];
  const countermelodyNotes: NoteEvent[] = [];
  const atmosphereChords: ChordEvent[] = [];
  const percussionRanges: { start: number; end: number }[] = [];
  const kickHits: HitEvent[] = [];
  const hatHits: HitEvent[] = [];
  const snareHits: HitEvent[] = [];
  const lyricCueTimes: number[] = [];

  let t = 0;
  let prevBassPc: string | null = null;

  structure.forEach((sectionType, sectionIdx) => {
    const mask = SECTION_MASKS[sectionType];
    const chords = sectionChords[sectionType];
    const sectionStartTime = t;
    lyricCueTimes.push(t);

    if (mask.percussion && template.percussion !== "none") {
      percussionRanges.push({ start: t, end: t + chords.length * chordDuration });
    }

    chords.forEach((chordSymbol, chordIdx) => {
      const chordInfo = Chord.get(chordSymbol);
      const rawTones = chordInfo.notes.length > 0 ? chordInfo.notes : [tonic];
      const chordTones = orderByVoiceLeading(rawTones, prevBassPc);
      prevBassPc = chordTones[0];

      if (mask.bass) bassNotes.push(...generateBassForChord(rng, template.bassPattern, chordTones, t, chordDuration, beatsPerChord, secondsPerBeat, mask.velocityMul));
      if (mask.pad) padChords.push(...generatePadForChord(template.padMode, chordTones, t, chordDuration, beatsPerChord, secondsPerBeat, mask.velocityMul));

      if (mask.melody) {
        const isFirstChordOfChorus = sectionType === "chorus" && chordIdx === 0;
        if (isFirstChordOfChorus) {
          const variedMotif = varyMotif(rng, motif, chorusOccurrence);
          melodyNotes.push(...renderMotif(variedMotif, scaleNotes, t, secondsPerBeat, mask.velocityMul, beatsPerChord));
          chorusOccurrence++;
        } else {
          melodyNotes.push(...generateMelodyForChord(rng, chordTones, scaleNotes, t, beatsPerChord, secondsPerBeat, template.melodySubdivision, template.restChance, template.swing, mask.velocityMul));
        }
        if (template.hasCountermelody) {
          countermelodyNotes.push(...generateCountermelodyForChord(rng, chordTones, t, beatsPerChord, secondsPerBeat, mask.velocityMul));
        }
      }

      t += chordDuration;
    });

    if (template.hasAtmosphere) {
      const firstChordInfo = Chord.get(chords[0]);
      const firstChordTones = firstChordInfo.notes.length > 0 ? firstChordInfo.notes : [tonic];
      atmosphereChords.push(...generateAtmosphereForSection(firstChordTones, sectionStartTime, chords.length * chordDuration, mask.velocityMul));
    }

    const next = structure[sectionIdx + 1];
    if ((next === "chorus" || next === "bridge") && template.percussion !== "none") {
      snareHits.push(...generateFill(rng, t - secondsPerBeat, secondsPerBeat));
    }
  });

  if (template.percussion !== "none") {
    for (const range of percussionRanges) {
      const startBeat = Math.round(range.start / secondsPerBeat);
      const beatCount = Math.round((range.end - range.start) / secondsPerBeat);
      const generated = generatePercussionForRange(rng, startBeat, beatCount, secondsPerBeat, template.percussion, template.swing, 1);
      kickHits.push(...generated.kick);
      hatHits.push(...generated.hat);
      snareHits.push(...generated.snare);
    }
  }

  return {
    tempoBpm,
    key: tonic,
    scaleName: scaleOption.name,
    mode: scaleOption.family,
    durationSeconds: t,
    lyricCueTimes,
    effects: {
      reverbWet: rngBetween(rng, template.reverbRange[0], template.reverbRange[1]),
      delayTime: rng.pick(template.delayTimePool),
      delayFeedback: rngBetween(rng, template.delayFeedbackRange[0], template.delayFeedbackRange[1]),
      chorusWet: rngBetween(rng, 0, 0.4),
      chorusFrequency: rngBetween(rng, 0.5, 3),
      eqLow: template.eq.low,
      eqMid: template.eq.mid,
      eqHigh: template.eq.high,
      compressorThreshold: template.compressor.threshold,
      compressorRatio: template.compressor.ratio,
    },
    tracks: {
      bass: { wave: rng.pick(template.waves.bass), envelope: template.envelopes.bass, notes: sortByTime(humanizeNotes(rng, bassNotes)) },
      pad: { wave: rng.pick(template.waves.pad), envelope: template.envelopes.pad, chords: sortByTime(humanizeChords(rng, padChords)) },
      melody: { wave: rng.pick(template.waves.melody), envelope: template.envelopes.melody, notes: sortByTime(humanizeNotes(rng, melodyNotes)) },
      ...(template.percussion !== "none"
        ? { percussion: { kick: sortByTime(humanizeHits(rng, kickHits)), hat: sortByTime(humanizeHits(rng, hatHits)), snare: sortByTime(humanizeHits(rng, snareHits)) } }
        : {}),
      ...(template.hasCountermelody ? { countermelody: { notes: sortByTime(humanizeNotes(rng, countermelodyNotes)) } } : {}),
      ...(template.hasAtmosphere ? { atmosphere: { chords: sortByTime(humanizeChords(rng, atmosphereChords)) } } : {}),
    },
  };
}