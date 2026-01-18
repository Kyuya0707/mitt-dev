// app/api/user/sync/route.ts
import { NextResponse } from "next/server";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

export async function POST(req: Request) {
  try {
    const body = await req.json().catch(() => ({}));

    const id = body.id as string | undefined;
    const email = body.email as string | undefined;

    // ✅ PP同意（今回追加）
    const ppConsentAtRaw = body.ppConsentAt as string | undefined; // ISO文字列で受ける
    const ppConsentVersion = body.ppConsentVersion as string | undefined;

    if (!id || !email) {
      return NextResponse.json({ error: "Invalid data" }, { status: 400 });
    }

    // ppConsentAt を Date に変換（未指定なら null）
    const ppConsentAt = ppConsentAtRaw ? new Date(ppConsentAtRaw) : null;

    await prisma.user.upsert({
      where: { id },
      update: {
        // 既にユーザーがいる場合でも、同意情報が来ていたら更新できるように
        ...(ppConsentAt ? { ppConsentAt } : {}),
        ...(ppConsentVersion ? { ppConsentVersion } : {}),
      },
      create: {
        id,
        email,
        // 初回作成時に同意情報も保存
        ...(ppConsentAt ? { ppConsentAt } : {}),
        ...(ppConsentVersion ? { ppConsentVersion } : {}),
      },
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("User Sync Error:", err);
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}
