import { NextResponse } from "next/server";
import {
  sendScheduledQuestionReminders,
  stopExpiredQuestionRewards,
} from "@/lib/reward-period";
import { expireOverdueNegotiations } from "@/lib/negotiation-expiry";
import { updateTrustScores } from "@/lib/trust-score";
import { createMonthlyPayoutBatches, processScheduledMonthlyPayoutBatches } from "@/lib/monthly-payout";

export const runtime = "nodejs";
export const maxDuration = 60;

export async function GET(request: Request) {
  const cronSecret = process.env.CRON_SECRET;
  const authorization = request.headers.get("authorization");

  if (!cronSecret || authorization !== `Bearer ${cronSecret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const now = new Date();
  const [reminders, expirations, negotiations, trustScores] = await Promise.all([
    sendScheduledQuestionReminders(now),
    stopExpiredQuestionRewards(now),
    expireOverdueNegotiations(now),
    updateTrustScores(now),
  ]);
  const payoutBatches = await createMonthlyPayoutBatches(now);
  const payoutTransfers = payoutBatches.skipped
    ? { checkedCount: 0, completedCount: 0, errors: [] }
    : await processScheduledMonthlyPayoutBatches();

  return NextResponse.json({
    ok: true,
    now: now.toISOString(),
    reminders,
    expirations,
    negotiations,
    trustScores,
    payoutBatches,
    payoutTransfers,
  });
}
