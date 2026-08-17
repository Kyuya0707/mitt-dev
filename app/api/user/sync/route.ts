// app/api/user/sync/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensurePrismaUser } from "@/lib/ensure-prisma-user";
import { isAgeGroup, isGender } from "@/lib/profile-demographics";
import { validateUsername } from "@/lib/username";
import { getSafeErrorCode, getSafeErrorMessage } from "@/lib/safe-error";
import { CATEGORY_NAMES, MAX_INTEREST_CATEGORIES } from "@/lib/category-options";

export async function POST(req: Request) {
  try {
    const currentUser = await getCurrentUser();

    if (!currentUser) {
      return NextResponse.json(
        { error: "ログインしてください" },
        { status: 401 }
      );
    }

    const body = await req.json().catch(() => ({}));

    const requestedId = body.id as string | undefined;
    const username = body.username as string | undefined;
    const name = body.name as string | undefined;
    const ageGroup = isAgeGroup(body.ageGroup) ? body.ageGroup : undefined;
    const gender = isGender(body.gender) ? body.gender : undefined;
    const bio = typeof body.bio === "string" ? body.bio.trim() : undefined;
    const experienceCategory =
      typeof body.experienceCategory === "string" &&
      CATEGORY_NAMES.includes(body.experienceCategory)
        ? body.experienceCategory
        : undefined;
    const experienceYearsRaw = Number(body.experienceYears);
    const experienceYears =
      Number.isInteger(experienceYearsRaw) &&
      experienceYearsRaw >= 0 &&
      experienceYearsRaw <= 80
        ? experienceYearsRaw
        : undefined;
    if (bio && bio.length > 1000) {
      return NextResponse.json({ error: "自己紹介は1,000文字以内です" }, { status: 400 });
    }
    const rawInterests: unknown[] = Array.isArray(body.interests)
      ? body.interests
      : [];
    const interests = [
      ...new Set(
        rawInterests
          .filter(
            (value: unknown): value is string => typeof value === "string"
          )
          .map((value) => value.trim())
          .filter(Boolean)
      ),
    ];

    if (interests.length > MAX_INTEREST_CATEGORIES) {
      return NextResponse.json(
        {
          error: `興味カテゴリーは${MAX_INTEREST_CATEGORIES}件まで選択できます`,
        },
        { status: 400 }
      );
    }

    // ✅ PP同意（今回追加）
    const ppConsentAtRaw = body.ppConsentAt as string | undefined; // ISO文字列で受ける
    const ppConsentVersion = body.ppConsentVersion as string | undefined;
    const ageConfirmedAtRaw = body.ageConfirmedAt as string | undefined;

    if (requestedId && requestedId !== currentUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ppConsentAt を Date に変換（未指定なら null）
    const ppConsentAt = ppConsentAtRaw ? new Date(ppConsentAtRaw) : null;
    const ageConfirmedAt = ageConfirmedAtRaw
      ? new Date(ageConfirmedAtRaw)
      : null;

    if (username) {
      const usernameValidation = validateUsername(username);

      if (!usernameValidation.ok) {
        return NextResponse.json(
          { error: usernameValidation.message },
          { status: 400 }
        );
      }
    }

    await ensurePrismaUser({
      id: currentUser.id,
      email: currentUser.email,
      username,
      name,
      ageGroup,
      gender,
      bio,
      experienceCategory,
      experienceYears,
      interests,
      ppConsentAt,
      ppConsentVersion,
      ageConfirmedAt,
    });

    return NextResponse.json({ ok: true });
  } catch (err) {
    const errorCode = getSafeErrorCode(err);

    if (errorCode === "USERNAME_TAKEN") {
      return NextResponse.json(
        { error: "このユーザー名はすでに使用されています。" },
        { status: 409 }
      );
    }

    console.error("User Sync Error:", {
      message: getSafeErrorMessage(err),
      code: errorCode,
    });
    return NextResponse.json({ error: "Failed to sync" }, { status: 500 });
  }
}
