import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function POST() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  const ageConfirmedAt = new Date();
  await prisma.user.update({
    where: { id: user.id },
    data: { ageConfirmedAt },
  });

  return NextResponse.json({ ok: true, ageConfirmedAt: ageConfirmedAt.toISOString() });
}
