import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { sortCategoryNames } from "@/lib/category-options";

export async function GET() {
  try {
    const categories = sortCategoryNames(
      await prisma.category.findMany()
    );

    return NextResponse.json(categories);
  } catch (error) {
    console.error("❌ Category API Error:", error);
    return NextResponse.json({ error: "failed" }, { status: 500 });
  }
}
