"use client";

import { useEffect, useRef } from "react";
import type { SongLyricLine } from "@/types/song";

interface LyricsDisplayProps {
  lyrics: SongLyricLine[];
  currentTime: number;
  isPlaying: boolean;
}

export function LyricsDisplay({ lyrics, currentTime, isPlaying }: LyricsDisplayProps) {
  const activeLineRef = useRef<HTMLParagraphElement>(null);

  let activeIndex = -1;
  if (isPlaying) {
    for (let i = 0; i < lyrics.length; i++) {
      if (lyrics[i].startSeconds <= currentTime) activeIndex = i;
      else break;
    }
  }

  useEffect(() => {
    if (!isPlaying) return;
    activeLineRef.current?.scrollIntoView({ block: "center", behavior: "smooth" });
  }, [activeIndex, isPlaying]);

  if (lyrics.length === 0) return null;

  return (
    <div className="max-h-40 max-w-prose overflow-y-auto rounded-md bg-zinc-50 px-4 py-3 transition-all duration-700">
      {lyrics.map((line, i) => (
        <p
          key={i}
          ref={i === activeIndex ? activeLineRef : undefined}
          className={`py-1 text-sm transition-colors ${
            i === activeIndex ? "font-semibold text-zinc-800 bg-green-100 rounded-2xl px-2" : "text-zinc-500"
          }`}
        >
          {line.text}
        </p>
      ))}
    </div>
  );
}