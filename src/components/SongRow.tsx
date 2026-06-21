"use client";

import { useEffect, useState } from "react";
import type { SongSummary, SongDetail } from "@/types/song";
import { isSingle } from "@/types/song";
import { PAGE_SIZE } from "@/lib/constants";
import { PlayButton } from "./PlayButton";
import { useSongPlayback } from "@/hooks/useSongPlayback";
import { LyricsDisplay } from "./LyricsDisplay";

interface SongRowProps {
  song: SongSummary;
  page: number;
  locale: string;
  seed: string;
  likesAvg: number;
}

export function SongRow({ song, page, locale, seed, likesAvg }: SongRowProps) {
  const [expanded, setExpanded] = useState(false);
  const [detail, setDetail] = useState<SongDetail | null>(null);
  const { isPlaying, loading: playbackLoading, currentTime, toggle } = useSongPlayback(detail?.audio ?? null);
  const [loadingDetail, setLoadingDetail] = useState(false);

  const indexInPage = song.index - 1 - (page - 1) * PAGE_SIZE;

  useEffect(() => {
  if (!expanded || detail) return;

  let cancelled = false;

  const timeoutId = setTimeout(async () => {
    setLoadingDetail(true); // moved inside the deferred callback
    try {
      const url = `/api/songs/detail?locale=${locale}&seed=${seed}&page=${page}&indexInPage=${indexInPage}&likesAvg=${likesAvg}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: SongDetail = await res.json();
      if (!cancelled) setDetail(data);
    } catch {
      // Non-fatal — row stays expanded with placeholder content below.
    } finally {
      if (!cancelled) setLoadingDetail(false);
    }
  }, 0);

  return () => {
    cancelled = true;
    clearTimeout(timeoutId);
  };
}, [expanded, detail, locale, seed, page, indexInPage, likesAvg]);

  return (
    <>
      <tr
        onClick={() => setExpanded((prev) => !prev)}
        className="cursor-pointer border-b border-zinc-100 hover:bg-green-600 duration-500 transition-colors"
      >
        <td className="px-4 py-3 text-sm font-semibold tabular-nums text-zinc-100">{song.index}</td>
        <td className="px-4 py-3 text-sm font-bold text-zinc-100">{song.title}</td>
        <td className="px-4 py-3 text-sm font-semibold text-zinc-100">{song.artist}</td>
        <td className="px-4 py-3 text-sm text-zinc-100">
          {isSingle(song) ? (
            <span className="rounded-full font-semibold bg-green-100 px-2 py-0.5 text-xs text-zinc-800">Single</span>
          ) : (
            <span className="font-semibold">{song.album}</span>
          )}
        </td>
        <td className="px-4 py-3 text-sm font-semibold text-zinc-100">{song.genre}</td>
        <td className="px-4 py-3 text-sm tabular-nums font-semibold text-zinc-100">{"♥ " + song.likes}</td>
        <td className="px-4 py-3 text-sm font-semibold text-zinc-200">{expanded ? "▲" : "▼"}</td>
      </tr>

      {expanded && (
        <tr className="border-b border-zinc-200 bg-green-50">
          <td colSpan={7} className="px-6 py-5">
            <div className="flex gap-6">
              {loadingDetail || !detail ? (
                <div className="flex h-32 w-32 shrink-0 items-center justify-center rounded-lg bg-zinc-200 text-xs text-zinc-400">
                  {loadingDetail ? "Loading..." : "Cover"}
                </div>
              ) : (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={detail.coverImageUrl}
                  alt={`Cover for ${song.title}`}
                  className="h-64 w-64 shrink-0 rounded-lg object-cover"
                />
              )}

              <div className="flex flex-col gap-3">
  <div>
    <p className="text-lg font-semibold text-zinc-800">{song.title}</p>
    <p className="text-sm text-zinc-500">{song.artist}</p>
    {!isSingle(song) && <p className="text-sm text-zinc-400">{song.album} (Album)</p>}
  </div>

  {detail && (
    <div className="flex items-center gap-2 text-xs text-zinc-400">
      <span className="rounded-full bg-zinc-100 px-2 py-0.5">{song.genre}</span>
      <span>♥ {song.likes}</span>
      <span>·</span>
      <span>{detail.audio.tempoBpm} BPM</span>
      <span>·</span>
      <span>
        {detail.audio.key} {detail.audio.scaleName}
      </span>
    </div>
  )}

<PlayButton isPlaying={isPlaying} loading={playbackLoading || !detail} onClick={toggle} />

{detail?.lyrics && (
  <LyricsDisplay lyrics={detail.lyrics} currentTime={currentTime} isPlaying={isPlaying} />
)}

<blockquote className="max-w-prose border-l-2 border-zinc-200 pl-3 text-sm italic text-zinc-500">
  {detail?.reviewText ?? "Loading review…"}
</blockquote>

</div>
            </div>
          </td>
        </tr>
      )}
    </>
  );
}