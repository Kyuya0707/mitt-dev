// app/api/user/sync/route.ts
import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensurePrismaUser } from "@/lib/ensure-prisma-user";
import { validateUsername } from "@/lib/username";
import { getSafeErrorCode, getSafeErrorMessage } from "@/lib/safe-error";

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
    const interests = Array.isArray(body.interests)
      ? body.interests.filter(
          (value: unknown): value is string => typeof value === "string"
        )
      : [];

    // ✅ PP同意（今回追加）
    const ppConsentAtRaw = body.ppConsentAt as string | undefined; // ISO文字列で受ける
    const ppConsentVersion = body.ppConsentVersion as string | undefined;

    if (requestedId && requestedId !== currentUser.id) {
      return NextResponse.json({ error: "Forbidden" }, { status: 403 });
    }

    // ppConsentAt を Date に変換（未指定なら null）
    const ppConsentAt = ppConsentAtRaw ? new Date(ppConsentAtRaw) : null;

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
      interests,
      ppConsentAt,
      ppConsentVersion,
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
