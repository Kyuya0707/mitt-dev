"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useNotifications } from "@/app/context/NotificationContext";
import { toJapaneseErrorMessage } from "@/lib/errors";

type UnifiedItem = {
  id: string;
  kind: "UNREAD_ANSWER" | "NOTIFICATION";
  title: string;
  subtitle?: string;
  href: string | null;
  createdAt: string; // ISO
  isUnread: boolean;
};

export default function NotificationList({
  items,
  unreadCount,
}: {
  items: UnifiedItem[];
  unreadCount: number;
}) {
  const router = useRouter();
  const { refresh } = useNotifications();
  const [markingAllRead, setMarkingAllRead] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  const handleClick = async (n: UnifiedItem) => {
    setErrorMsg("");

    // ✅ UNREAD_ANSWER は「ここでは既読にしない」
    if (n.kind === "UNREAD_ANSWER") {
      if (n.href) router.push(n.href); // /questions/[id]?from=notification
      return;
    }

    // それ以外（Notification）は今まで通り
    const res = await fetch(`/api/notifications/${n.id}/read`, { method: "POST" });
    if (!res.ok) {
      const data = (await res.json().catch(() => ({}))) as { error?: string };
      setErrorMsg(toJapaneseErrorMessage(data));
      return;
    }

    await refresh();
    if (n.href) router.push(n.href);
  };

  const handleReadAll = async () => {
    if (markingAllRead) return;

    setMarkingAllRead(true);
    setErrorMsg("");

    try {
      const res = await fetch("/api/notifications/read-all", {
        method: "POST",
      });

      if (!res.ok) {
        const data = (await res.json().catch(() => ({}))) as { error?: string };
        setErrorMsg(toJapaneseErrorMessage(data));
        return;
      }

      await refresh();
      router.refresh();
    } catch (error) {
      setErrorMsg(toJapaneseErrorMessage(error));
    } finally {
      setMarkingAllRead(false);
    }
  };

  const icon = (kind: UnifiedItem["kind"]) => {
    return kind === "UNREAD_ANSWER" ? "💬" : "🔔";
  };

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-4">
        <p className="text-sm text-gray-500">
          未読 {unreadCount.toLocaleString("ja-JP")} 件
        </p>
        {unreadCount > 0 && (
          <button
            type="button"
            onClick={handleReadAll}
            disabled={markingAllRead}
            className="rounded border border-gray-300 bg-white px-3 py-2 text-sm text-gray-700 transition hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
          >
            {markingAllRead ? "既読にしています..." : "すべて既読にする"}
          </button>
        )}
      </div>

      {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}

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
                {new Date(n.createdAt).toLocaleString("ja-JP")}
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
