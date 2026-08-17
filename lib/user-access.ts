import prisma from "@/lib/prisma";

export async function getUserMutationRestriction(userId: string) {
  const user = await prisma.user.findUnique({
    where: { id: userId },
    select: { suspendedUntil: true, permanentlySuspendedAt: true, deletedAt: true },
  });
  if (!user) return "ユーザー情報が見つかりません";
  if (user.deletedAt) return "このアカウントは退会済みです。";
  if (user.permanentlySuspendedAt) {
    return "このアカウントは永久利用停止中です。異議申立てはマイページから行えます。";
  }
  if (user.suspendedUntil && user.suspendedUntil > new Date()) {
    return `このアカウントは${user.suspendedUntil.toLocaleString("ja-JP")}まで利用停止中です。`;
  }
  return null;
}
