import type { SongAudio } from "@/types/song";

type ToneModule = typeof import("tone");
let tonePromise: Promise<ToneModule> | null = null;
function loadTone(): Promise<ToneModule> {
  if (!tonePromise) tonePromise = import("tone");
  return tonePromise;
}

export function sanitizeFilename(input: string): string {
  const cleaned = input.replace(/[\\/:*?"<>|]/g, "").replace(/\s+/g, " ").trim();
  return cleaned.length > 0 ? cleaned.slice(0, 60) : "track";
}



/**
 * Renders a SongAudio score to a real MP3 Blob, entirely in the browser.
 * Uses Tone.Offline to run the same synth graph as the live preview (minus
 * Reverb — see file comment) much faster than real-time, then encodes the
 * resulting PCM with lamejs.
 */
export async function renderSongToMp3(audio: SongAudio): Promise<Blob> {
  const Tone = await loadTone();
  const sampleRate = 44100;

  const buffer = await Tone.Offline(() => {
  const chorus = new Tone.Chorus(audio.effects.chorusFrequency, 2.5, 0.7).start();
  chorus.wet.value = audio.effects.chorusWet;
  const compressor = new Tone.Compressor({ threshold: audio.effects.compressorThreshold, ratio: audio.effects.compressorRatio });
const eq3 = new Tone.EQ3({ low: audio.effects.eqLow, mid: audio.effects.eqMid, high: audio.effects.eqHigh });
compressor.connect(eq3);
eq3.toDestination();

const delay = new Tone.FeedbackDelay(audio.effects.delayTime, audio.effects.delayFeedback);
delay.connect(compressor);
chorus.connect(delay);

  const bassSynth = new Tone.Synth({ oscillator: { type: audio.tracks.bass.wave }, envelope: audio.tracks.bass.envelope }).connect(delay);
  const padSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: audio.tracks.pad.wave }, envelope: audio.tracks.pad.envelope }).connect(chorus);
  const melodySynth = new Tone.Synth({ oscillator: { type: audio.tracks.melody.wave }, envelope: audio.tracks.melody.envelope }).connect(chorus);

    let kickSynth: InstanceType<ToneModule["MembraneSynth"]> | null = null;
    let hatSynth: InstanceType<ToneModule["NoiseSynth"]> | null = null;
    if (audio.tracks.percussion) {
      kickSynth = new Tone.MembraneSynth({ pitchDecay: 0.05, octaves: 4, envelope: { attack: 0.001, decay: 0.3, sustain: 0 } }).connect(delay);
      hatSynth = new Tone.NoiseSynth({ noise: { type: "white" }, envelope: { attack: 0.001, decay: 0.05, sustain: 0 } }).connect(delay);
    }
    let countermelodySynth: InstanceType<ToneModule["Synth"]> | null = null;
if (audio.tracks.countermelody) {
  countermelodySynth = new Tone.Synth({ oscillator: { type: "triangle" }, envelope: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.4 } }).connect(chorus);
}
let atmosphereSynth: InstanceType<ToneModule["PolySynth"]> | null = null;
if (audio.tracks.atmosphere) {
  atmosphereSynth = new Tone.PolySynth(Tone.Synth, { oscillator: { type: "sine" }, envelope: { attack: 2, decay: 1, sustain: 0.8, release: 3 } }).connect(delay);
}

    audio.tracks.bass.notes.forEach((n) => bassSynth.triggerAttackRelease(n.note, n.duration, n.time, n.velocity));
    audio.tracks.pad.chords.forEach((c) => padSynth.triggerAttackRelease(c.notes, c.duration, c.time, c.velocity));
    audio.tracks.melody.notes.forEach((n) => melodySynth.triggerAttackRelease(n.note, n.duration, n.time, n.velocity));
    audio.tracks.percussion?.kick.forEach((hit) => kickSynth!.triggerAttackRelease("C2", hit.duration, hit.time, hit.velocity));

const noiseHits = [...(audio.tracks.percussion?.hat ?? []), ...(audio.tracks.percussion?.snare ?? [])].sort((a, b) => a.time - b.time);
noiseHits.forEach((hit) => hatSynth!.triggerAttackRelease(hit.duration, hit.time, hit.velocity));
audio.tracks.countermelody?.notes.forEach((n) => countermelodySynth!.triggerAttackRelease(n.note, n.duration, n.time, n.velocity));
audio.tracks.atmosphere?.chords.forEach((c) => atmosphereSynth!.triggerAttackRelease(c.notes, c.duration, c.time, c.velocity));
  }, audio.durationSeconds + 0.5);

  const channelData = buffer.toArray(0) as Float32Array;

  const int16 = new Int16Array(channelData.length);
  for (let i = 0; i < channelData.length; i++) {
    const s = Math.max(-1, Math.min(1, channelData[i]));
    int16[i] = s < 0 ? s * 32768 : s * 32767;
  }

  // Defensive import handling — lamejs's module shape varies slightly
  // depending on bundler interop.
const { Mp3Encoder } = await import("@breezystack/lamejs");
const encoder = new Mp3Encoder(1, sampleRate, 128);

const blockSize = 1152;
const mp3Chunks: Uint8Array[] = [];
for (let i = 0; i < int16.length; i += blockSize) {
  const chunk = int16.subarray(i, i + blockSize);
  const encoded = encoder.encodeBuffer(chunk);
  if (encoded.length > 0) mp3Chunks.push(encoded);
}
const final = encoder.flush();
if (final.length > 0) mp3Chunks.push(final);

return new Blob(mp3Chunks as BlobPart[], { type: "audio/mp3" });
}