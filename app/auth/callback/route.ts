// app/auth/callback/route.ts
import { NextResponse } from "next/server";
import { supabaseServer } from "@/lib/supabase-server";

export async function GET(request: Request) {
  const url = new URL(request.url);
  const code = url.searchParams.get("code");

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
    await fetch(`${url.origin}/api/user/sync`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        id: user.id,
        email: user.email,
      }),
    });
  }

  // ④ マイページへ
  return NextResponse.redirect(`${url.origin}/mypage`);
}