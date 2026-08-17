import { NextResponse } from "next/server";
import { createClient } from "@supabase/supabase-js";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

export async function DELETE(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  const body = (await request.json().catch(() => ({}))) as { confirmation?: string };
  if (body.confirmation !== "退会する") {
    return NextResponse.json({ error: "確認欄へ「退会する」と入力してください" }, { status: 400 });
  }
  const serviceRoleKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  if (!serviceRoleKey || !supabaseUrl) {
    return NextResponse.json({ error: "退会処理の管理設定が未完了です" }, { status: 503 });
  }

  const [payouts, bestViewPayouts, cancellations, reports, appeals] = await Promise.all([
    prisma.payout.count({ where: { userId: user.id, status: { not: "paid" } } }),
    prisma.bestViewPayout.count({ where: { recipientUserId: user.id, status: { not: "paid" } } }),
    prisma.cancellationRequest.count({
      where: {
        status: "pending",
        OR: [{ requesterUserId: user.id }, { question: { userId: user.id } }],
      },
    }),
    prisma.report.count({
      where: { status: "PENDING", OR: [{ reporterId: user.id }, { targetOwnerId: user.id }] },
    }),
    prisma.appeal.count({ where: { userId: user.id, status: "PENDING" } }),
  ]);
  if (payouts + bestViewPayouts + cancellations + reports + appeals > 0) {
    return NextResponse.json(
      { error: "未処理の振込・返金・通報・異議申立てがあるため、完了後に退会できます" },
      { status: 409 }
    );
  }

  const deletedAt = new Date();
  await prisma.$transaction(async (tx) => {
    await tx.notification.deleteMany({ where: { userId: user.id } });
    await tx.notificationPreference.deleteMany({ where: { userId: user.id } });
    await tx.user.update({
      where: { id: user.id },
      data: {
        email: `deleted-${user.id}@deleted.knowvalue.invalid`,
        username: null,
        name: null,
        bio: null,
        experienceCategory: null,
        experienceYears: null,
        ageGroup: null,
        gender: null,
        interestCategories: [],
        stripeAccountId: null,
        stripeConnectOnboardingCompleted: false,
        stripeConnectChargesEnabled: false,
        stripeConnectPayoutsEnabled: false,
        stripeConnectDetailsSubmitted: false,
        stripeConnectRequirementsCurrentlyDue: Prisma.DbNull,
        stripeConnectRequirementsEventuallyDue: Prisma.DbNull,
        deletedAt,
      },
    });
    await tx.eventLog.create({
      data: { type: "account_anonymized", payload: { userId: user.id, deletedAt: deletedAt.toISOString() } },
    });
  });

  const admin = createClient(supabaseUrl, serviceRoleKey, {
    auth: { persistSession: false, autoRefreshToken: false },
  });
  const { error } = await admin.auth.admin.deleteUser(user.id);
  if (error) {
    await prisma.eventLog.create({
      data: { type: "account_auth_delete_failed", payload: { userId: user.id, message: error.message } },
    });
    return NextResponse.json({ error: "匿名化は完了しましたが、認証削除を運営が確認します" }, { status: 202 });
  }
  return NextResponse.json({ ok: true });
}
