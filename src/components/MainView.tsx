"use client";

import { useGenerationParams } from "@/hooks/useGenerationParams";
import { TableView } from "./TableView";
import { GalleryView } from "./GalleryView";

export function MainView() {
  const { viewMode, locale, seed, likesAvg } = useGenerationParams();
  const remountKey = `${locale}|${seed}|${likesAvg}`;

  if (viewMode === "table") return <TableView key={remountKey} />;
  return <GalleryView key={remountKey} />;
}