"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import { useGenerationParams } from "@/hooks/useGenerationParams";
import { SongCard } from "./SongCard";
import type { SongsPageResponse } from "@/types/api";
import type { SongSummary } from "@/types/song";

const BATCH_SIZE = 20;

export function GalleryView() {
  const { locale, seed, likesAvg } = useGenerationParams();

  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [nextBatch, setNextBatch] = useState(1);
  const [loadingMore, setLoadingMore] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sentinelRef = useRef<HTMLDivElement>(null);
  const cancelledRef = useRef(false);
  const fetchingBatchRef = useRef<number | null>(null);

  const loadBatch = useCallback(async (batchNum: number) => {
    if (fetchingBatchRef.current === batchNum) return; // already loading this batch
    fetchingBatchRef.current = batchNum;
    setLoadingMore(true);

    try {
      const url = `/api/songs?locale=${locale}&seed=${seed}&page=${batchNum}&pageSize=${BATCH_SIZE}&likesAvg=${likesAvg}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const data: SongsPageResponse = await res.json();

      if (cancelledRef.current) return; // this instance was unmounted — discard

      setSongs((prev) => (batchNum === 1 ? data.items : [...prev, ...data.items]));
      setNextBatch(batchNum + 1);
      setError(null);
    } catch (err) {
      if (!cancelledRef.current) {
        setError(err instanceof Error ? err.message : "Unknown error");
      }
    } finally {
      if (fetchingBatchRef.current === batchNum) fetchingBatchRef.current = null;
      if (!cancelledRef.current) setLoadingMore(false);
    }
  }, [locale, seed, likesAvg]);

  // Runs once on mount. Thanks to the `key` prop in MainView, a fresh mount
  // happens exactly when generation params change — so this doubles as our
  // "reset" logic, with no synchronous setState-on-deps-change needed.
  useEffect(() => {
  cancelledRef.current = false; // reset in case Strict Mode's simulated cleanup set this on the previous pass

  window.scrollTo({ top: 0 });
  const timeoutId = setTimeout(() => loadBatch(1), 0);

  return () => {
    cancelledRef.current = true;
    clearTimeout(timeoutId);
  };
  // eslint-disable-next-line react-hooks/exhaustive-deps
}, []);

  // Infinite scroll: load the next batch when the sentinel scrolls into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting) {
          loadBatch(nextBatch);
        }
      },
      { rootMargin: "300px" }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [nextBatch, loadBatch]);

  return (
    <div className="px-6 py-4">
      {error && <p className="mb-4 text-sm text-red-500">{error}</p>}

      <div className="grid grid-cols-2 gap-4 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5">
        {songs.map((song) => (
          <SongCard key={song.index} song={song} />
        ))}
      </div>

      <div ref={sentinelRef} className="h-10 w-full" />

      {loadingMore && (
        <p className="py-4 text-center text-sm text-zinc-400">Loading more...</p>
      )}
    </div>
  );
}