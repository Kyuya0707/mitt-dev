import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserAdminStatus } from "@/lib/admin";

export async function GET() {
  const { user, canManageAccounting } = await getCurrentUserAdminStatus();
  if (!user) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }
  if (!canManageAccounting) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const batches = await prisma.payoutBatch.findMany({
    orderBy: [{ periodKey: "desc" }, { createdAt: "desc" }],
    include: {
      user: {
        select: {
          id: true,
          email: true,
          username: true,
          stripeAccountId: true,
          stripeConnectPayoutsEnabled: true,
          stripeConnectDetailsSubmitted: true,
        },
      },
      items: {
        select: {
          id: true,
          amount: true,
          payoutId: true,
          bestViewPayoutId: true,
        },
      },
    },
  });

  return NextResponse.json({
    batches: batches.map((batch) => ({
      ...batch,
      createdAt: batch.createdAt.toISOString(),
      updatedAt: batch.updatedAt.toISOString(),
      transferredAt: batch.transferredAt?.toISOString() ?? null,
    })),
  });
}

export const dynamic = "force-dynamic";
