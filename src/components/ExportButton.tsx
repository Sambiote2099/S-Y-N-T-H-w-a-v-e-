"use client";

import { useState } from "react";
import type { SongAudio } from "@/types/song";

interface ExportSongData {
  index: number;
  title: string;
  artist: string;
  album: string;
  audio: SongAudio;
}

interface ExportButtonProps {
  locale: string;
  seed: string;
  page: number;
  pageSize: number;
}

export function ExportButton({ locale, seed, page, pageSize }: ExportButtonProps) {
  const [exporting, setExporting] = useState(false);
  const [progress, setProgress] = useState({ done: 0, total: 0 });

  async function handleExport() {
    setExporting(true);
    setProgress({ done: 0, total: 0 });
    try {
      const url = `/api/songs/export-batch?locale=${locale}&seed=${seed}&page=${page}&pageSize=${pageSize}`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`API error: ${res.status}`);
      const { items }: { items: ExportSongData[] } = await res.json();
      setProgress({ done: 0, total: items.length });

      const { renderSongToMp3, sanitizeFilename } = await import("@/lib/audio/renderToMp3");
      const JSZip = (await import("jszip")).default;
      const zip = new JSZip();
      const usedNames = new Set<string>();

      for (const item of items) {
        const blob = await renderSongToMp3(item.audio);

        const base = `${sanitizeFilename(item.title)} - ${sanitizeFilename(item.album)} - ${sanitizeFilename(item.artist)}`;
        let filename = `${base}.mp3`;
        let suffix = 2;
        while (usedNames.has(filename)) {
          filename = `${base} (${suffix}).mp3`;
          suffix++;
        }
        usedNames.add(filename);
        zip.file(filename, blob);

        setProgress((p) => ({ ...p, done: p.done + 1 }));
      }

      const zipBlob = await zip.generateAsync({ type: "blob" });
      const downloadUrl = URL.createObjectURL(zipBlob);
      const a = document.createElement("a");
      a.href = downloadUrl;
      a.download = `S Y N T H | w a v e -page-${page}.zip`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(downloadUrl);
    } catch (err) {
      console.error("Export failed:", err);
      alert("Export failed — check the browser console for details.");
    } finally {
      setExporting(false);
    }
  }

  return (
    <button
      onClick={handleExport}
      disabled={exporting}
      className="rounded-md border border-zinc-300 px-3 py-1.5 text-sm text-zinc-600 bg-zinc-100 hover:bg-emerald-100 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {exporting
        ? progress.total > 0
          ? `Rendering ${progress.done}/${progress.total}…`
          : "Preparing…"
        : "Export Musics as .zip"}
    </button>
  );
}