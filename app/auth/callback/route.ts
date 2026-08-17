// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { resolveAuthRedirect } from "@/lib/auth-redirect";
import { ensurePrismaUser } from "@/lib/ensure-prisma-user";
import { sendLoginNotificationEmail } from "@/lib/notifications";
import { supabaseServer } from "@/lib/supabase-server";
import { isAgeGroup, isGender } from "@/lib/profile-demographics";
import { durationMs, logPerf, nowMs } from "@/lib/perf";

function getSafeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown_error";
}

export async function GET(request: Request) {
  const totalStart = nowMs();
  const url = new URL(request.url);
  const code = url.searchParams.get("code");
  const redirectTo = resolveAuthRedirect([
    url.searchParams.get("redirectTo"),
    url.searchParams.get("callbackUrl"),
    url.searchParams.get("next"),
  ], "/mypage");

  const supabase = await supabaseServer();

  // ① セッション確立（ここ超重要）
  let exchangeDuration = 0;
  if (code) {
    const exchangeStart = nowMs();
    await supabase.auth.exchangeCodeForSession(code);
    exchangeDuration = durationMs(exchangeStart);
  }

  // ② 最新のユーザー情報取得（ここで email は確定後の値）
  const {
    data: { user },
  } = await supabase.auth.getUser();

  // ③ Prisma 側の User を同期（email変更を反映）
  let ensureDuration = 0;
  let loginNotificationTriggered = false;
  if (user?.id && user?.email) {
    const metadata = user.user_metadata ?? {};
    const ensureStart = nowMs();
    await ensurePrismaUser({
      id: user.id,
      email: user.email,
      username:
        typeof metadata.username === "string" ? metadata.username : undefined,
      name:
        typeof metadata.full_name === "string" ? metadata.full_name : undefined,
      ageGroup: isAgeGroup(metadata.age_group) ? metadata.age_group : undefined,
      gender: isGender(metadata.gender) ? metadata.gender : undefined,
      bio: typeof metadata.bio === "string" ? metadata.bio : undefined,
      experienceCategory:
        typeof metadata.experience_category === "string"
          ? metadata.experience_category
          : undefined,
      experienceYears:
        typeof metadata.experience_years === "number"
          ? metadata.experience_years
          : undefined,
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
      ageConfirmedAt:
        typeof metadata.age_confirmed_at === "string"
          ? new Date(metadata.age_confirmed_at)
          : null,
    });
    ensureDuration = durationMs(ensureStart);

    if (code) {
      loginNotificationTriggered = true;
      void sendLoginNotificationEmail({
        userId: user.id,
        email: user.email,
      }).catch((error) => {
        console.error("Login notification email failed after callback:", {
          message: getSafeErrorMessage(error),
        });
      });
    }
  }

  logPerf("auth.callback.GET", {
    total: `${durationMs(totalStart)}ms`,
    exchange: `${exchangeDuration}ms`,
    ensure: `${ensureDuration}ms`,
    loginNotificationTriggered,
  });

  if (!user?.id) {
    return NextResponse.redirect(new URL(redirectTo, url.origin));
  }

  return NextResponse.redirect(
    new URL(
      `/auth/verified?redirectTo=${encodeURIComponent(redirectTo)}`,
      url.origin
    )
  );
}
