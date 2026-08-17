import prisma from "@/lib/prisma";

function clamp(value: number) {
  return Math.max(0, Math.min(100, Math.round(value)));
}

export function getTrustRank(score: number) {
  if (score >= 90) return "BLACK";
  if (score >= 75) return "PLATINUM";
  if (score >= 60) return "GOLD";
  if (score >= 40) return "SILVER";
  return "BRONZE";
}

export async function updateTrustScores(now = new Date()) {
  const users = await prisma.user.findMany({
    select: { id: true, createdAt: true },
    take: 5000,
  });
  const dayKey = now.toISOString().slice(0, 10);
  let updatedCount = 0;

  for (const user of users) {
    const [bestCount, helpfulCount, confirmedReportCount, sanctions] =
      await Promise.all([
        prisma.payout.count({
          where: { userId: user.id, kind: "question_reward" },
        }),
        prisma.answerLike.count({
          where: { answer: { userId: user.id } },
        }),
        prisma.report.count({
          where: { targetOwnerId: user.id, status: "CONFIRMED" },
        }),
        prisma.sanction.findMany({
          where: { targetUserId: user.id, revokedAt: null },
          select: { type: true },
        }),
      ]);

    const activeMonths = Math.min(
      10,
      Math.max(0, Math.floor((now.getTime() - user.createdAt.getTime()) / (30 * 86400000)))
    );
    const sanctionPenalty = sanctions.reduce((total, sanction) => {
      const penalty =
        sanction.type === "WARNING"
          ? 10
          : sanction.type === "SUSPEND_7_DAYS"
            ? 20
            : sanction.type === "SUSPEND_30_DAYS"
              ? 35
              : 50;
      return total + penalty;
    }, 0);
    const score = clamp(
      50 +
        Math.min(25, bestCount * 5) +
        Math.min(15, helpfulCount) +
        activeMonths -
        Math.max(sanctionPenalty, confirmedReportCount * 5)
    );
    const rank = getTrustRank(score);
    const factors = {
      base: 50,
      bestCount,
      helpfulCount,
      activeMonths,
      confirmedReportCount,
      sanctionPenalty,
    };

    await prisma.$transaction([
      prisma.user.update({ where: { id: user.id }, data: { trustScore: score, rank } }),
      prisma.trustScoreHistory.upsert({
        where: { userId_dayKey: { userId: user.id, dayKey } },
        update: { score, rank, factors },
        create: { userId: user.id, dayKey, score, rank, factors },
      }),
    ]);
    updatedCount += 1;
  }

  return { updatedCount, dayKey };
}
