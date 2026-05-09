import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sortCategoryNames } from "@/lib/category-options";
import { durationMs, logPerf, nowMs } from "@/lib/perf";

export const revalidate = 3600;

function getSafeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown_error";
}

export async function GET() {
  const totalStart = nowMs();
  try {
    const categories = sortCategoryNames(
      await prisma.category.findMany({
        select: {
          id: true,
          name: true,
        },
      })
    );

    logPerf("questions.categories.GET", {
      total: `${durationMs(totalStart)}ms`,
      count: categories.length,
    });

    return NextResponse.json(categories, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("❌ Category API Error:", {
      message: getSafeErrorMessage(error),
    });
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
