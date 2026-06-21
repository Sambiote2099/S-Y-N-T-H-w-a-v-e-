"use client";

import { useRouter, useSearchParams, usePathname } from "next/navigation";
import { useCallback } from "react";
import type { GenerationParams, ViewMode } from "@/types/params";

const DEFAULTS: GenerationParams & { viewMode: ViewMode } = {
  locale: "en-US",
  seed: "42",
  likesAvg: 5,
  viewMode: "table",
};

export function useGenerationParams() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();

  const locale   = searchParams.get("locale")   ?? DEFAULTS.locale;
  const seed     = searchParams.get("seed")      ?? DEFAULTS.seed;
  const likesAvg = parseFloat(searchParams.get("likesAvg") ?? String(DEFAULTS.likesAvg));
  const viewMode = (searchParams.get("view") ?? DEFAULTS.viewMode) as ViewMode;

  const setParams = useCallback(
    (updates: Partial<GenerationParams & { viewMode: ViewMode }>) => {
      // Build new params on top of current ones
      const next = new URLSearchParams(searchParams.toString());

      if (updates.locale   !== undefined) next.set("locale",   updates.locale);
      if (updates.seed     !== undefined) next.set("seed",     updates.seed);
      if (updates.likesAvg !== undefined) next.set("likesAvg", String(updates.likesAvg));
      if (updates.viewMode !== undefined) next.set("view",     updates.viewMode);

      // Replace instead of push — changing a filter shouldn't add browser history entries
      router.replace(`${pathname}?${next.toString()}`);
    },
    [router, pathname, searchParams]
  );

  return { locale, seed, likesAvg, viewMode, setParams };
}