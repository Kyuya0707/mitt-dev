import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";

function csvCell(value: string | number | null) {
  const text = String(value ?? "");
  return `"${text.replaceAll('"', '""')}"`;
}

function getPeriodRange(period: string) {
  const month = /^(\d{4})-(0[1-9]|1[0-2])$/.exec(period);
  if (month) {
    const year = Number(month[1]);
    const monthIndex = Number(month[2]) - 1;
    return {
      start: new Date(Date.UTC(year, monthIndex, 1)),
      end: new Date(Date.UTC(year, monthIndex + 1, 1)),
    };
  }
  const yearOnly = /^(\d{4})$/.exec(period);
  if (yearOnly) {
    const year = Number(yearOnly[1]);
    return {
      start: new Date(Date.UTC(year, 0, 1)),
      end: new Date(Date.UTC(year + 1, 0, 1)),
    };
  }
  return null;
}

export async function GET(request: Request) {
  const user = await getCurrentUser();
  if (!user) return NextResponse.json({ error: "ログインしてください" }, { status: 401 });

  const period = new URL(request.url).searchParams.get("period") ?? "";
  const range = getPeriodRange(period);
  if (!range) {
    return NextResponse.json({ error: "対象期間はYYYY-MMまたはYYYYで指定してください" }, { status: 400 });
  }

  const [payouts, bestViewPayouts] = await Promise.all([
    prisma.payout.findMany({
      where: { userId: user.id, createdAt: { gte: range.start, lt: range.end } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, createdAt: true, kind: true, description: true,
        grossAmount: true, platformFeeAmount: true, netAmount: true,
        amount: true, status: true, transferredAt: true,
      },
    }),
    prisma.bestViewPayout.findMany({
      where: { recipientUserId: user.id, createdAt: { gte: range.start, lt: range.end } },
      orderBy: { createdAt: "asc" },
      select: {
        id: true, createdAt: true, recipientType: true, amount: true,
        status: true, transferredAt: true,
      },
    }),
  ]);

  const rows = [
    ["発生日", "種別", "説明", "総額", "手数料", "純額", "状態", "振込日", "明細ID"],
    ...payouts.map((payout) => [
      payout.createdAt.toISOString(),
      payout.kind === "negotiation_reward" ? "交渉追加報酬" : "質問報酬",
      payout.description ?? "",
      payout.grossAmount ?? payout.amount,
      payout.platformFeeAmount ?? 0,
      payout.netAmount ?? payout.amount,
      payout.status,
      payout.transferredAt?.toISOString() ?? "",
      payout.id,
    ]),
    ...bestViewPayouts.map((payout) => [
      payout.createdAt.toISOString(),
      payout.recipientType === "question_owner" ? "BEST閲覧料（質問者）" : "BEST閲覧料（回答者）",
      "",
      payout.amount,
      0,
      payout.amount,
      payout.status,
      payout.transferredAt?.toISOString() ?? "",
      payout.id,
    ]),
  ];
  const csv = `\uFEFF${rows.map((row) => row.map(csvCell).join(",")).join("\r\n")}`;
  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": `attachment; filename="knowvalue-rewards-${period}.csv"`,
      "Cache-Control": "private, no-store",
    },
  });
}

export const dynamic = "force-dynamic";
