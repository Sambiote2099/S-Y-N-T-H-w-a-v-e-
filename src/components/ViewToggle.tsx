"use client";

import { useGenerationParams } from "@/hooks/useGenerationParams";
import type { ViewMode } from "@/types/params";
import { Table2, LayoutGrid } from "lucide-react";

export function ViewToggle() {
  const { viewMode, setParams } = useGenerationParams();

  const btn = (mode: ViewMode, Icon: React.ElementType) => (
    <button
      onClick={() => setParams({ viewMode: mode })}
      className={`px-3 py-1.5 rounded-md duration-500 transition-colors flex items-center justify-center ${
        viewMode === mode
          ? "bg-zinc-800 text-white"
          : "text-zinc-600 hover:bg-green-300"
      }`}
    >
      <Icon className="w-4 h-4" />
    </button>
  );

  return (
    <div className="flex items-center gap-1 rounded-lg border border-zinc-200 bg-green-100 p-1">
      {btn("table", Table2)}
      {btn("gallery", LayoutGrid)}
    </div>
  );
}