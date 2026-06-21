"use client";

import { useEffect, useState } from "react";
import { useGenerationParams } from "@/hooks/useGenerationParams";
import { SongRow } from "./SongRow";
import type { SongsPageResponse } from "@/types/api";
import type { SongSummary } from "@/types/song";
import { PAGE_SIZE } from "@/lib/constants";
import { ExportButton } from "./ExportButton";

export function TableView() {
  const { locale, seed, likesAvg } = useGenerationParams();

  // Thanks to the `key` prop in MainView, this component remounts fresh
  // whenever locale/seed/likesAvg change — so page always starts at 1
  // for a new generation, with no manual reset effect required.
  const [page, setPage] = useState(1);
  const [songs, setSongs] = useState<SongSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function fetchPage() {
      setLoading(true);
      setError(null);
      try {
        const url = `/api/songs?locale=${locale}&seed=${seed}&page=${page}&pageSize=${PAGE_SIZE}&likesAvg=${likesAvg}`;
        const res = await fetch(url);
        if (!res.ok) throw new Error(`API error: ${res.status}`);
        const data: SongsPageResponse = await res.json();
        if (!cancelled) setSongs(data.items);
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Unknown error");
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    // Defer past the current synchronous tick — same reasoning as the
    // GalleryView fix: calling setLoading(true) directly in the effect
    // body (even via a function call) is what trips the warning.
    const timeoutId = setTimeout(fetchPage, 0);

    return () => {
      cancelled = true;
      clearTimeout(timeoutId);
    };
  }, [locale, seed, likesAvg, page]);

  return (
    <div className="flex flex-col gap-4 px-6 py-4">

      <div className="overflow-x-auto rounded-lg border border-zinc-200">
        <table className="w-full border-collapse text-left">
          <thead className="bg-green-500">
            <tr>
              {["#", "Title", "Artist", "Album", "Genre", "Likes", ""].map((h) => (
                <th
                  key={h}
                  className="px-4 py-2 text-xs font-semibold uppercase tracking-wide text-black"
                >
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {loading && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-zinc-100">
                  Loading...
                </td>
              </tr>
            )}
            {error && (
              <tr>
                <td colSpan={7} className="px-4 py-8 text-center text-sm text-red-500">
                  {error}
                </td>
              </tr>
            )}
            {!loading && !error && songs.map((song) => (
              <SongRow
                key={song.index}
                song={song}
                page={page}
                locale={locale}
                seed={seed}
                likesAvg={likesAvg}
              />
            ))}
          </tbody>
        </table>
      </div>

      <div className="flex items-center gap-3">
        <button
          onClick={() => setPage((p) => Math.max(1, p - 1))}
          disabled={page === 1 || loading}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-100 hover:text-black disabled:cursor-not-allowed disabled:opacity-80"
        >
          ← Previous
        </button>

        <div className="flex items-center gap-2 text-sm text-zinc-100">
          Page
          <input
            type="number"
            min={1}
            value={page}
            onChange={(e) => {
              const val = parseInt(e.target.value, 10);
              if (!isNaN(val) && val >= 1) setPage(val);
            }}
            className="w-16 rounded-md border border-zinc-300 px-2 py-1 text-center text-sm focus:outline-none focus:ring-2 focus:ring-zinc-400"
          />
        </div>

        <button
          onClick={() => setPage((p) => p + 1)}
          disabled={loading}
          className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-100 hover:bg-zinc-100 hover:text-black disabled:cursor-not-allowed disabled:opacity-40"
        >
          Next →
        </button>
        <ExportButton locale={locale} seed={seed} page={page} pageSize={PAGE_SIZE} />
      </div>

    </div>
  );
}