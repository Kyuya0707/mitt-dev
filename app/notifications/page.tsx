import prisma from "@/lib/prisma";
import { getCurrentUser } from "@/lib/auth";
import NotificationList from "./NotificationList";

type NotificationItem = {
  id: string;
  kind: "NOTIFICATION";
  title: string;
  subtitle?: string;
  href: string | null;
  createdAt: string;
  isUnread: boolean;
};

export default async function NotificationsPage() {
  const user = await getCurrentUser();
  if (!user) return <div className="p-6">ログインしてください。</div>;

  const notifications = await prisma.notification.findMany({
    where: { userId: user.id },
    orderBy: { createdAt: "desc" },
  });

  const items: NotificationItem[] = notifications.map((notification) => ({
    id: notification.id,
    kind: "NOTIFICATION",
    title: notification.message,
    href: notification.url ?? null,
    createdAt: notification.createdAt.toISOString(),
    isUnread: notification.readAt == null,
  }));
  const unreadCount = items.filter((item) => item.isUnread).length;

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-bold mb-6">通知</h1>

      {items.length === 0 ? (
        <p className="text-gray-500">通知はありません。</p>
      ) : (
        <NotificationList items={items} unreadCount={unreadCount} />
      )}
    </div>
  );
}
