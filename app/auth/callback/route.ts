// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { resolveAuthRedirect } from "@/lib/auth-redirect";
import { ensurePrismaUser } from "@/lib/ensure-prisma-user";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTo = resolveAuthRedirect([
    url.searchParams.get("redirectTo"),
    url.searchParams.get("callbackUrl"),
    url.searchParams.get("next"),
  ], "/mypage");

  const supabase = await supabaseServer();

  // ① セッション確立（ここ超重要）
  if (code) {
    await supabase.auth.exchangeCodeForSession(code);
  }

  // ② 最新のユーザー情報取得（ここで email は確定後の値）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ③ Prisma 側の User を同期（email変更を反映）
  if (user?.id && user?.email) {
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
  }

  return NextResponse.redirect(new URL(redirectTo, url.origin));
}
