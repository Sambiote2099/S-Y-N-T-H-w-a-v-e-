import { NextRequest, NextResponse } from "next/server";
import { generateSongDetail } from "@/lib/generators/songs";
import { getSupportedLocales } from "@/lib/locales";
import { PAGE_SIZE } from "@/lib/constants";
export const runtime = "nodejs";
export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const locale = params.get("locale") ?? "en-US";
  const seed = params.get("seed") ?? "0";
  const page = Math.max(1, parseInt(params.get("page") ?? "1", 10));
  const indexInPage = Math.max(0, parseInt(params.get("indexInPage") ?? "0", 10));
  const likesAvg = Math.min(10, Math.max(0, parseFloat(params.get("likesAvg") ?? "0")));

  const supported = getSupportedLocales().map((l) => l.code);
  if (!supported.includes(locale)) {
    return NextResponse.json(
      { error: `Unsupported locale "${locale}". Supported: ${supported.join(", ")}` },
      { status: 400 }
    );
  }
  if (!/^\d+$/.test(seed)) {
    return NextResponse.json({ error: "seed must be a non-negative integer string" }, { status: 400 });
  }

  const globalIndex = (page - 1) * PAGE_SIZE + indexInPage + 1;
  const detail = await generateSongDetail(seed, locale, page, indexInPage, likesAvg, globalIndex);

  return NextResponse.json(detail);
}