// app/api/auth/create-user/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma"; // ← PrismaClient ではなく共通の prisma を使う
import { supabaseServer } from "@/lib/supabase-server";

export async function POST() {
  // 🔹 Supabase（Server）クライアントを生成
  const supabase = await supabaseServer();

  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "No Supabase user" }, { status: 400 });
  }

  // 既存確認
  const existing = await prisma.user.findUnique({
    where: { id: user.id },
  });

  if (existing) {
    return NextResponse.json({ ok: true });
  }

  // 新規作成
  await prisma.user.create({
    data: {
      id: user.id,
      email: user.email!,
    },
  });

  return NextResponse.json({ ok: true });
}
