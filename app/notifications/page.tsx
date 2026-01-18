// app/notifications/page.tsx
import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import NotificationList from "./NotificationList";

type UnifiedItem = {
  id: string; // 一意。UNREAD_ANSWERは questionId を使う
  kind: "UNREAD_ANSWER" | "NOTIFICATION";
  title: string;
  subtitle?: string;
  href: string | null;
  createdAt: string; // Clientで扱いやすいようにISO文字列
  isUnread: boolean;
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return <div className="p-6">ログインしてください。</div>;

  /* ----------- ① 自分の質問に対する未読回答（軽量化） ----------- */
  // 自分の質問ID一覧
  const myQuestions = await prisma.question.findMany({
    where: { userId: user.id },
    select: { id: true, title: true },
  });

  const questionIds = myQuestions.map((q) => q.id);
  const questionTitleMap = new Map(myQuestions.map((q) => [q.id, q.title]));

  let unreadAnswerItems: UnifiedItem[] = [];

  if (questionIds.length > 0) {
    // 未読の回答を「質問単位」で集計 + 最新回答日時
    const unreadGrouped = await prisma.answer.groupBy({
      by: ["questionId"],
      where: {
        questionId: { in: questionIds },
        reads: { none: { userId: user.id } }, // ←未読条件
      },
      _count: { _all: true },
      _max: { createdAt: true },
    });

    unreadAnswerItems = unreadGrouped.map((g) => {
      const qid = g.questionId;
      const title = questionTitleMap.get(qid) ?? "質問";
      const unreadCount = g._count?._all ?? 0;
      const latest = g._max?.createdAt ?? new Date(0);

      return {
        id: qid,
        kind: "UNREAD_ANSWER",
        title,
        subtitle: `${unreadCount} 件の未読回答があります`,
        href: `/questions/${qid}?from=notification`,
        createdAt: new Date(latest).toISOString(),
        isUnread: true,
      };
    });
  }

  /* ----------- ② Notification テーブル（BESTなど） ----------- */
  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const notificationItems: UnifiedItem[] = notifications.map((n) => ({
    id: n.id,
    kind: "NOTIFICATION",
    title: n.message,
    href: n.url ?? null,
    createdAt: new Date(n.createdAt).toISOString(),
    isUnread: n.readAt == null,
  }));

  /* ----------- ③ マージして並び替え ----------- */
  const items: UnifiedItem[] = [...unreadAnswerItems, ...notificationItems].sort(
    (a, b) => (a.createdAt < b.createdAt ? 1 : -1)
  );

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">通知</h1>

      {items.length === 0 ? (
        <p className="text-gray-500">通知はありません。</p>
      ) : (
        <NotificationList items={items} />
      )}
    </div>
  );
}
