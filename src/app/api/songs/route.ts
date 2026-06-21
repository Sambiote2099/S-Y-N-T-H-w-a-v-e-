import { NextRequest, NextResponse } from "next/server";
import { generateSongsPage } from "@/lib/generators/songs";
import { getSupportedLocales } from "@/lib/locales";
import type { SongsPageResponse } from "@/types/api";

const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 100;

export async function GET(req: NextRequest) {
  const params = req.nextUrl.searchParams;

  const locale   = params.get("locale")   ?? "en-US";
  const seed     = params.get("seed")     ?? "0";
  const page     = Math.max(1, parseInt(params.get("page")     ?? "1",  10));
  const pageSize = Math.min(
    MAX_PAGE_SIZE,
    Math.max(1, parseInt(params.get("pageSize") ?? String(DEFAULT_PAGE_SIZE), 10))
  );
  const likesAvg = Math.min(10, Math.max(0, parseFloat(params.get("likesAvg") ?? "0")));

  // Validate locale
  const supported = getSupportedLocales().map((l) => l.code);
  if (!supported.includes(locale)) {
    return NextResponse.json(
      { error: `Unsupported locale "${locale}". Supported: ${supported.join(", ")}` },
      { status: 400 }
    );
  }

  // Validate seed — must be a valid integer string
  if (!/^\d+$/.test(seed)) {
    return NextResponse.json(
      { error: "seed must be a non-negative integer string" },
      { status: 400 }
    );
  }

  const items = generateSongsPage(seed, locale, page, pageSize, likesAvg);

  const response: SongsPageResponse = { page, pageSize, items };
  return NextResponse.json(response);
}