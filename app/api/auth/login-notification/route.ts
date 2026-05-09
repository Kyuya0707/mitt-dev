import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { ensurePrismaUser } from "@/lib/ensure-prisma-user";
import { sendLoginNotificationEmail } from "@/lib/notifications";
import { getSafeErrorMessage } from "@/lib/safe-error";

function getBearerToken(req: Request) {
  const authorization = req.headers.get("authorization");
  if (!authorization?.startsWith("Bearer ")) {
    return null;
  }

  return authorization.slice("Bearer ".length).trim();
}

export async function POST(req: Request) {
  try {
    const accessToken = getBearerToken(req);

    if (!accessToken) {
      return NextResponse.json(
        { error: "ログインが必要です" },
        { status: 401 }
      );
    }

    const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
    const supabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

    if (!supabaseUrl || !supabaseAnonKey) {
      return NextResponse.json(
        { error: "認証設定が不足しています" },
        { status: 500 }
      );
    }

    const supabase = createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    });

    const {
      data: { user },
      error,
    } = await supabase.auth.getUser(accessToken);

    if (error || !user?.email) {
      return NextResponse.json(
        { error: "ログインユーザーの確認に失敗しました" },
        { status: 401 }
      );
    }

    const metadata = user.user_metadata ?? {};

    await ensurePrismaUser({
      id: user.id,
      email: user.email,
      username:
        typeof metadata.username === "string" ? metadata.username : undefined,
      name:
        typeof metadata.full_name === "string" ? metadata.full_name : undefined,
      interests: Array.isArray(metadata.interests)
        ? metadata.interests.filter(
            (value): value is string => typeof value === "string"
          )
        : [],
      ppConsentAt:
        typeof metadata.pp_consent_at === "string"
          ? new Date(metadata.pp_consent_at)
          : null,
      ppConsentVersion:
        typeof metadata.pp_consent_version === "string"
          ? metadata.pp_consent_version
          : null,
    });

    const sent = await sendLoginNotificationEmail({
      userId: user.id,
      email: user.email,
    });

    return NextResponse.json({ ok: true, sent });
  } catch (error) {
    console.error("Login notification route failed:", {
      message: getSafeErrorMessage(error),
    });
    return NextResponse.json(
      { error: "ログイン通知メールの送信に失敗しました" },
      { status: 500 }
    );
  }
}
