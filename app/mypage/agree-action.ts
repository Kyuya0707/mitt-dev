// app/mypage/agree-action.ts
"use server";

import prisma from "@/lib/prisma";
import { createClientBrowser } from "@/lib/supabase-browser";
import { cookies } from "next/headers";
import { redirect } from "next/navigation";

export async function agreeAction(redirectTo: string) {
  const supabase = createClientBrowser();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  // 同意日時を保存
  await prisma.user.update({
    where: { id: user.id },
    data: { consentAt: new Date() },
  });

  // 呼び出し元に応じて遷移
  redirect(redirectTo);
}
