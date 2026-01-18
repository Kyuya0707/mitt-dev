// app/questions/[id]/QuestionReadClient.tsx
"use client";

import { useEffect } from "react";
import { useNotifications } from "@/app/context/NotificationContext";

export default function QuestionReadClient({
  questionId,
  fromNotification,
}: {
  questionId: string;
  fromNotification: boolean;
}) {
  const { refresh } = useNotifications();

  useEffect(() => {
    const run = async () => {
      // ✅ 通常アクセス：即既読
      if (!fromNotification) {
        await fetch(`/api/questions/${questionId}/read`, { method: "POST" });
        await refresh();
        return;
      }

      // ✅ 通知経由：未読へスクロール → その後に既読
      const target = document.querySelector<HTMLElement>('[data-unread="true"]');
      if (target) {
        target.scrollIntoView({ behavior: "smooth", block: "center" });
      }

      // ハイライトを見せるため少し待つ
      await new Promise((r) => setTimeout(r, 600));

      await fetch(`/api/questions/${questionId}/read`, { method: "POST" });
      await refresh();
    };

    run();
  }, [questionId, fromNotification, refresh]);

  return null;
}
