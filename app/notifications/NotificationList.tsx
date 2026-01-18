"use client";

import { useRouter } from "next/navigation";
import { useNotifications } from "@/app/context/NotificationContext";

type UnifiedItem = {
  id: string;
  kind: "UNREAD_ANSWER" | "NOTIFICATION";
  title: string;
  subtitle?: string;
  href: string | null;
  createdAt: string; // ISO
  isUnread: boolean;
};

export default function NotificationList({ items }: { items: UnifiedItem[] }) {
  const router = useRouter();
  const { refresh } = useNotifications();

  const handleClick = async (n: UnifiedItem) => {
    // ✅ UNREAD_ANSWER は「ここでは既読にしない」
    if (n.kind === "UNREAD_ANSWER") {
      if (n.href) router.push(n.href); // /questions/[id]?from=notification
      return;
    }

    // それ以外（Notification）は今まで通り
    await fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
    await refresh();
    if (n.href) router.push(n.href);
  };
  
  const formatTime = (iso: string) => {
    const d = new Date(iso);
    return d.toLocaleString();
  };

  const icon = (kind: UnifiedItem["kind"]) => {
    return kind === "UNREAD_ANSWER" ? "💬" : "🔔";
  };

  const formatRelativeTime = (iso: string) => {
    const now = Date.now();
    const diff = Math.floor((now - new Date(iso).getTime()) / 1000);

    if (diff < 60) return `${diff}秒前`;
    if (diff < 3600) return `${Math.floor(diff / 60)}分前`;
    if (diff < 86400) return `${Math.floor(diff / 3600)}時間前`;
    return `${Math.floor(diff / 86400)}日前`;
  };


  return (
    <div className="space-y-4">
      {items.map((n) => (
        <button
          key={`${n.kind}:${n.id}`}
          type="button"
          onClick={() => handleClick(n)}
          className={`w-full text-left block p-4 bg-white border rounded shadow hover:bg-gray-50 ${
            n.isUnread ? "" : "opacity-60"
          }`}
        >
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="font-medium truncate">
                <span className="mr-2">{icon(n.kind)}</span>
                {n.title}
              </div>

              {n.subtitle && (
                <div className="text-sm text-gray-600 mt-1">{n.subtitle}</div>
              )}

              <div className="text-xs text-gray-400 mt-2">
                {formatRelativeTime(n.createdAt)}
              </div>

            </div>

            {n.isUnread && (
              <div className="text-xs text-red-500 font-semibold whitespace-nowrap">
                未読
              </div>
            )}
          </div>
        </button>
      ))}
    </div>
  );
}
