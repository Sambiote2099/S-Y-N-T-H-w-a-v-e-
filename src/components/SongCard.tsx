import type { SongSummary } from "@/types/song";
import { isSingle } from "@/types/song";

export function SongCard({ song }: { song: SongSummary }) {
  return (
    <div className="flex flex-col gap-3 rounded-lg border border-zinc-200 bg-zinc-50 p-3 transition-shadow hover:shadow-md">
      {/* Cover placeholder — Phase 8 */}
      <div className="flex aspect-square items-center justify-center rounded-md bg-emerald-100">
  <span className="text-3xl font-semibold text-zinc-300">#{song.index}</span>
</div>

      <div className="flex flex-col gap-0.5">
        <p className="truncate text-sm font-medium text-zinc-800">{song.title}</p>
        <p className="truncate text-xs text-zinc-500">{song.artist}</p>
        <p className="truncate text-xs text-zinc-400">
          {isSingle(song) ? "Single" : song.album}
        </p>
      </div>

      <div className="flex items-center justify-between text-xs text-zinc-500">
        <span className="rounded-full bg-zinc-100 px-2 py-0.5">{song.genre}</span>
        <span>{"♥ " + song.likes}</span>
      </div>
    </div>
  );
}