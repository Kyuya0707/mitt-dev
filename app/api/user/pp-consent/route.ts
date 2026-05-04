import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { supabaseServer } from "@/lib/supabase-server";

const PP_CONSENT_VERSION = "2026-01-18_v1";

export async function GET() {
  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json(
        { error: "ログインが必要です" },
        { status: 401 }
      );
    }

    const prismaUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        consentAt: true,
        ppConsentAt: true,
      },
    });

    return NextResponse.json({
      consentAt: prismaUser?.consentAt?.toISOString() ?? null,
      ppConsentAt: prismaUser?.ppConsentAt?.toISOString() ?? null,
      isAgreed: Boolean(prismaUser?.ppConsentAt || prismaUser?.consentAt),
    });
  } catch (error) {
    console.error("[pp-consent][api] fetch failed", error);
    return NextResponse.json(
      { error: "同意状態の取得に失敗しました" },
      { status: 500 }
    );
  }
}

export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const redirectTo =
    typeof body?.redirectTo === "string" ? body.redirectTo : null;

  try {
    const supabase = await supabaseServer();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return NextResponse.json(
        { error: "ログインが必要です", redirectTo },
        { status: 401 }
      );
    }

    const ppConsentAt = new Date();
    const savedUser = await prisma.user.upsert({
      where: { id: user.id },
      update: {
        email: user.email ?? "",
        ppConsentAt,
        ppConsentVersion: PP_CONSENT_VERSION,
      },
      create: {
        id: user.id,
        email: user.email ?? "",
        ppConsentAt,
        ppConsentVersion: PP_CONSENT_VERSION,
      },
      select: {
        id: true,
        ppConsentAt: true,
        ppConsentVersion: true,
      },
    });

    return NextResponse.json({
      ok: true,
      userId: savedUser.id,
      redirectTo,
      ppConsentAt: ppConsentAt.toISOString(),
      ppConsentVersion: savedUser.ppConsentVersion,
    });
  } catch (error) {
    console.error("[pp-consent][api] save failed", error);
    return NextResponse.json(
      { error: "同意の保存に失敗しました", redirectTo },
      { status: 500 }
    );
  }
}
