// app/api/ranking/route.ts
import { NextResponse } from "next/server";
import { getRankingRows, normalizeRankingRange } from "@/lib/ranking";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const range = normalizeRankingRange(url.searchParams.get("range"));
  const rows = await getRankingRows(range);

  return NextResponse.json({ range, rows });
}
