"use client";

import { useEffect, useRef, useState } from "react";
import type { SongAudio } from "@/types/song";

type ToneModule = typeof import("tone");

export function useSongPlayback(audio: SongAudio | null) {
  const [isPlaying, setIsPlaying] = useState(false);
  const [loading, setLoading] = useState(false);
  const [currentTime, setCurrentTime] = useState(0);

  const nodesRef = useRef<{ dispose: () => void } | null>(null);
  const stopTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const rafRef = useRef<number | null>(null);
  const toneRef = useRef<ToneModule | null>(null);
  const playbackStartRef = useRef(0);

  function clearTimers() {
    if (stopTimeoutRef.current) {
      clearTimeout(stopTimeoutRef.current);
      stopTimeoutRef.current = null;
    }
    if (rafRef.current !== null) {
      cancelAnimationFrame(rafRef.current);
      rafRef.current = null;
    }
  }

  function stop() {
    clearTimers();
    nodesRef.current?.dispose();
    nodesRef.current = null;
    setIsPlaying(false);
    setCurrentTime(0);
  }

  useEffect(() => {
    return () => {
      clearTimers();
      nodesRef.current?.dispose();
    };
  }, []);

  function tick() {
    const Tone = toneRef.current;
    if (!Tone) return;
    setCurrentTime(Math.max(0, Tone.now() - playbackStartRef.current));
    rafRef.current = requestAnimationFrame(tick);
  }

  async function toggle() {
  if (!audio) return;
  if (isPlaying) {
    stop();
    return;
  }

  setLoading(true);
  let createdNodes: { dispose: () => void } | null = null;
  try {
    if (!toneRef.current) toneRef.current = await import("tone");
    const Tone = toneRef.current;
    await Tone.start();

    const compressor = new Tone.Compressor({ threshold: audio.effects.compressorThreshold, ratio: audio.effects.compressorRatio });
const eq3 = new Tone.EQ3({ low: audio.effects.eqLow, mid: audio.effects.eqMid, high: audio.effects.eqHigh });
compressor.connect(eq3);
eq3.toDestination();

const chorus = new Tone.Chorus(audio.effects.chorusFrequency, 2.5, 0.7).start();
chorus.wet.value = audio.effects.chorusWet;

const delay = new Tone.FeedbackDelay(audio.effects.delayTime, audio.effects.delayFeedback);
const reverb = new Tone.Reverb({ decay: 2.2, wet: audio.effects.reverbWet });
await reverb.ready;
chorus.connect(delay);
delay.connect(reverb);
reverb.connect(compressor);

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
  countermelodySynth = new Tone.Synth({
    oscillator: { type: "triangle" },
    envelope: { attack: 0.02, decay: 0.3, sustain: 0.3, release: 0.4 },
  }).connect(chorus);
}

let atmosphereSynth: InstanceType<ToneModule["PolySynth"]> | null = null;
if (audio.tracks.atmosphere) {
  atmosphereSynth = new Tone.PolySynth(Tone.Synth, {
    oscillator: { type: "sine" },
    envelope: { attack: 2, decay: 1, sustain: 0.8, release: 3 },
  }).connect(reverb);
}
    // Tracked BEFORE scheduling any notes — so a scheduling error below
    // can never leave these nodes orphaned and untracked.
    createdNodes = {
      dispose: () => {
    bassSynth.dispose();
    padSynth.dispose();
    melodySynth.dispose();
    kickSynth?.dispose();
    hatSynth?.dispose();
    countermelodySynth?.dispose();
    atmosphereSynth?.dispose();
    chorus.dispose();
    delay.dispose();
    reverb.dispose();
    compressor.dispose();
    eq3.dispose();
      },
    };

    const startTime = Tone.now() + 0.1;
    playbackStartRef.current = startTime;

    audio.tracks.bass.notes.forEach((n) => bassSynth.triggerAttackRelease(n.note, n.duration, startTime + n.time, n.velocity));
    audio.tracks.pad.chords.forEach((c) => padSynth.triggerAttackRelease(c.notes, c.duration, startTime + c.time, c.velocity));
    audio.tracks.melody.notes.forEach((n) => melodySynth.triggerAttackRelease(n.note, n.duration, startTime + n.time, n.velocity));
    audio.tracks.percussion?.kick.forEach((hit) => kickSynth!.triggerAttackRelease("C2", hit.duration, startTime + hit.time, hit.velocity));
    audio.tracks.countermelody?.notes.forEach((n) => countermelodySynth!.triggerAttackRelease(n.note, n.duration, startTime + n.time, n.velocity));
    audio.tracks.atmosphere?.chords.forEach((c) => atmosphereSynth!.triggerAttackRelease(c.notes, c.duration, startTime + c.time, c.velocity));
// hat and snare share one synth, so the combined sequence sent to it must
// be chronological — sorting each array separately isn't enough.
const noiseHits = [...(audio.tracks.percussion?.hat ?? []), ...(audio.tracks.percussion?.snare ?? [])].sort((a, b) => a.time - b.time);
noiseHits.forEach((hit) => hatSynth!.triggerAttackRelease(hit.duration, startTime + hit.time, hit.velocity));

    nodesRef.current = createdNodes;
    setIsPlaying(true);
    rafRef.current = requestAnimationFrame(tick);
    stopTimeoutRef.current = setTimeout(stop, (audio.durationSeconds + 0.5) * 1000);
  } catch (err) {
    console.error("Playback failed:", err);
    createdNodes?.dispose(); // tear down anything already created/scheduled
    setIsPlaying(false);
  } finally {
    setLoading(false);
  }
}

  return { isPlaying, loading, currentTime, toggle };
}