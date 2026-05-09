import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sortCategoryNames } from "@/lib/category-options";

export const revalidate = 3600;

export async function GET() {
  try {
    const categories = sortCategoryNames(
      await prisma.category.findMany({
        select: {
          id: true,
          name: true,
        },
      })
    );

    return NextResponse.json(categories, {
      headers: {
        "Cache-Control": "public, s-maxage=3600, stale-while-revalidate=86400",
      },
    });
  } catch (error) {
    console.error("❌ Category API Error:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
