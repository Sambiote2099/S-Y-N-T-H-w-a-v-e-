import { NextRequest, NextResponse } from "next/server";
import { generateSongForExport } from "@/lib/generators/songs";
import { getSupportedLocales } from "@/lib/locales";

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;
  const locale = params.get("locale") ?? "en-US";
  const seed = params.get("seed") ?? "0";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const pageSize = Math.min(50, Math.max(1, parseInt(params.get("pageSize") ?? "20", 10)));

  const supported = getSupportedLocales().map((l) => l.code);
  if (!supported.includes(locale)) {
    return NextResponse.json({ error: `Unsupported locale "${locale}"` }, { status: 400 });
  }
  if (!/^\d+$/.test(seed)) {
    return NextResponse.json({ error: "seed must be a non-negative integer string" }, { status: 400 });
  }

  const items = Array.from({ length: pageSize }, (_, i) => {
    const globalIndex = (page - 1) * pageSize + i + 1;
    return generateSongForExport(seed, locale, page, i, globalIndex);
  });

  return NextResponse.json({ items });
}