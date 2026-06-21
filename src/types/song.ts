/**
 * Core domain types for a single generated "song" record.
 *
 * These mirror the fields required by the spec's "Generated Data" section,
 * plus `likes` (see ASSUMPTIONS.md — the spec defines how likes are
 * generated but never formally lists it under "must contain", we display it
 * anyway since the toolbar control would otherwise have no visible effect).
 */

/** Literal value used for the album field when a song is not part of an album. */
export const SINGLE_LABEL = "Single" as const;

/**
 * The fields shown in every Table row and every Gallery card.
 * This is intentionally flat and serializable — it's exactly what the
 * songs API returns per record.
 */
export interface SongSummary {
  /** 1-based sequence index, unique within a given seed (see ASSUMPTIONS.md). */
  index: number;

  title: string;
  artist: string;

  /** Either a generated album name, or the literal string "Single". */
  album: string;

  genre: string;

  /** Probabilistically generated count, independent of seed-driven content fields. */
  likes: number;
}

/** True when a record's album field is the literal "Single" marker, not a real album name. */
export function isSingle(song: Pick<SongSummary, "album">): boolean {
  return song.album === SINGLE_LABEL;
}

/**
 * Extra fields only fetched when a Table row is expanded.
 * Built out across Phases 8–10 (cover, audio, review text).
 */
export interface SongDetail extends SongSummary {
  /** Data URL or API path to the generated cover image. Phase 8. */
  coverImageUrl: string;

  /** Description of the generated piece, consumed by the client-side audio engine. Phase 9. */
  audio: SongAudio;

  /** Locale-aware generated review blurb. Phase 10. */
  reviewText: string;

  /** Optional — only present if the lyrics stretch goal (Phase 11) is implemented. */
  lyrics?: SongLyricLine[];
}

/**
 * Placeholder shape for the generated-music descriptor consumed by the
 * client-side player. Will be fleshed out in Phase 9 once the music-theory
 * library and note/track representation are chosen.
 */
export type OscillatorWave = "sine" | "triangle" | "square" | "sawtooth";

export interface NoteEvent {
  note: string;       // e.g. "C4"
  time: number;       // seconds from song start
  duration: number;   // seconds
  velocity: number;   // 0–1
}

export interface ChordEvent {
  notes: string[];    // e.g. ["C4", "E4", "G4"]
  time: number;
  duration: number;
  velocity: number;
}

export interface EnvelopeSettings {
  attack: number;
  decay: number;
  sustain: number;
  release: number;
}

export interface HitEvent {
  time: number;
  duration: number;
  velocity: number;
}

export interface SongAudio {
  tempoBpm: number;
  key: string;
  scaleName: string;        // e.g. "major", "dorian", "harmonic minor" — the real scale used for melody
  mode: "major" | "minor";  // simplified harmonic family, used for chord progressions + display
  durationSeconds: number;
  lyricCueTimes: number[];
  effects: {
    reverbWet: number;
    delayTime: number;
    delayFeedback: number;
    chorusWet: number;
    chorusFrequency: number;
  };
  tracks: {
    bass: { wave: OscillatorWave; envelope: EnvelopeSettings; notes: NoteEvent[] };
    pad: { wave: OscillatorWave; envelope: EnvelopeSettings; chords: ChordEvent[] };
    melody: { wave: OscillatorWave; envelope: EnvelopeSettings; notes: NoteEvent[] };
    percussion?: { kick: HitEvent[]; hat: HitEvent[]; snare: HitEvent[] };
  };
}
/** One timed line of lyrics, for the synced-scrolling stretch goal (Phase 11). */
export interface SongLyricLine {
  text: string;
  startSeconds: number;
}