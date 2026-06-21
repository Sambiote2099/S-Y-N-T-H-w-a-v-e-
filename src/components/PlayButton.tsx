"use client";

interface PlayButtonProps {
  isPlaying: boolean;
  loading: boolean;
  onClick: () => void;
}

export function PlayButton({ isPlaying, loading, onClick }: PlayButtonProps) {
  return (
    <button
      onClick={onClick}
      disabled={loading}
      className={`flex w-fit items-center gap-2 rounded-full px-4 py-1.5 text-sm font-medium transition-colors ${
        isPlaying ? "bg-red-100 text-red-600 hover:bg-red-200" : "bg-zinc-800 text-white hover:bg-zinc-700"
      } disabled:opacity-50`}
    >
      {loading ? "Loading audio…" : isPlaying ? "■ Stop" : "▶ Play preview"}
    </button>
  );
}