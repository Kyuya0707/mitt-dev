import { NextResponse } from "next/server";
import { getCurrentUserAdminStatus } from "@/lib/admin";

export async function POST() {
  const { user, canManageAccounting } = await getCurrentUserAdminStatus();
  if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  if (!canManageAccounting) return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  return NextResponse.json(
    { error: "個別送金は停止しました。月次一括振込を利用してください" },
    { status: 409 }
  );
}
