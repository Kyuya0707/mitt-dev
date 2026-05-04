import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import { validateUsername } from "@/lib/username";

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const rawUsername = searchParams.get("username") ?? "";
  const validation = validateUsername(rawUsername);

  if (!validation.ok) {
    return NextResponse.json(
      { available: false, error: validation.message },
      { status: 400 }
    );
  }

  const currentUser = await getCurrentUser();
  const existing = await prisma.user.findUnique({
    where: { username: validation.value },
    select: { id: true },
  });

  const available = !existing || existing.id === currentUser?.id;

  return NextResponse.json({
    available,
    username: validation.value,
  });
}
