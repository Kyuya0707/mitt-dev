"use client";

import { useEffect, useState } from "react";
import MyPageCard from "./MyPageCard";

type NotificationPreferences = {
  emailOnAnswerCreated: boolean;
  emailOnCommentCreated: boolean;
  emailOnBestSelected: boolean;
  emailOnNegotiationCreated: boolean;
  emailOnNegotiationAccepted: boolean;
  emailOnNegotiationRejected: boolean;
  emailOnCategoryQuestionCreated: boolean;
  emailOnQuestionSupplement: boolean;
};

const DEFAULT_PREFERENCES: NotificationPreferences = {
  emailOnAnswerCreated: true,
  emailOnCommentCreated: true,
  emailOnBestSelected: true,
  emailOnNegotiationCreated: true,
  emailOnNegotiationAccepted: true,
  emailOnNegotiationRejected: true,
  emailOnCategoryQuestionCreated: true,
  emailOnQuestionSupplement: true,
};

const SETTINGS: Array<{
  key: keyof NotificationPreferences;
  label: string;
}> = [
  { key: "emailOnAnswerCreated", label: "自分の質問に回答がついた" },
  { key: "emailOnQuestionSupplement", label: "回答した質問に補足が追加された" },
  { key: "emailOnCommentCreated", label: "自分の回答にコメントがついた" },
  { key: "emailOnBestSelected", label: "自分の回答がBESTに選ばれた" },
  { key: "emailOnNegotiationCreated", label: "交渉が届いた" },
  { key: "emailOnNegotiationAccepted", label: "交渉が承認された" },
  { key: "emailOnNegotiationRejected", label: "交渉が見送られた" },
  {
    key: "emailOnCategoryQuestionCreated",
    label: "自分の興味カテゴリに一致する質問が公開された",
  },
];

export default function NotificationSettingsSection() {
  const [preferences, setPreferences] =
    useState<NotificationPreferences>(DEFAULT_PREFERENCES);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const load = async () => {
      try {
        const res = await fetch("/api/notification-preferences", {
          cache: "no-store",
        });
        const data = await res.json();

        if (res.ok) {
          setPreferences({
            emailOnAnswerCreated: Boolean(data.emailOnAnswerCreated),
            emailOnCommentCreated: Boolean(data.emailOnCommentCreated),
            emailOnBestSelected: Boolean(data.emailOnBestSelected),
            emailOnNegotiationCreated: Boolean(data.emailOnNegotiationCreated),
            emailOnNegotiationAccepted: Boolean(data.emailOnNegotiationAccepted),
            emailOnNegotiationRejected: Boolean(
              data.emailOnNegotiationRejected
            ),
            emailOnCategoryQuestionCreated: Boolean(
              data.emailOnCategoryQuestionCreated
            ),
            emailOnQuestionSupplement: Boolean(data.emailOnQuestionSupplement),
          });
        }
      } finally {
        setLoading(false);
      }
    };

    void load();
  }, []);

  const handleToggle = (key: keyof NotificationPreferences) => {
    setPreferences((prev) => ({
      ...prev,
      [key]: !prev[key],
    }));
  };

  const handleSave = async () => {
    setSaving(true);
    setMessage("");

    try {
      const res = await fetch("/api/notification-preferences", {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(preferences),
      });

      const data = await res.json().catch(() => ({}));

      if (!res.ok) {
        setMessage(data.error || "通知設定の保存に失敗しました。");
        return;
      }

      setMessage("メール通知設定を保存しました。");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <MyPageCard
        title="通知設定"
        description="メール通知の受信設定を変更できます。"
      >
        <p className="text-sm text-gray-500">読み込み中...</p>
      </MyPageCard>
    );
  }

  return (
    <MyPageCard
      title="通知設定"
      description="一般的なメール通知の受信設定です。"
    >
      <p className="mb-4 text-sm text-gray-600">
        アプリ内通知は常に届きます。ここではメール通知のみ切り替えできます。
      </p>
      <p className="mb-4 rounded-lg border border-blue-100 bg-blue-50 px-3 py-2 text-sm text-blue-900">
        ログイン、返金、振込失敗などのセキュリティ・金銭関連メールは停止できません。
      </p>

      <div className="space-y-3">
        {SETTINGS.map((setting) => (
          <label
            key={setting.key}
            className="flex items-start gap-3 rounded-xl border border-gray-100 bg-gray-50 px-4 py-3 text-sm"
          >
            <input
              type="checkbox"
              checked={preferences[setting.key]}
              onChange={() => handleToggle(setting.key)}
              className="mt-1"
            />
            <span>{setting.label}</span>
          </label>
        ))}
      </div>

      {message && <p className="mt-4 text-sm text-blue-700">{message}</p>}

      <button
        type="button"
        onClick={handleSave}
        disabled={saving}
        className="mt-4 rounded-xl bg-gray-900 px-4 py-2 text-sm text-white disabled:opacity-50"
      >
        {saving ? "保存中..." : "通知設定を保存する"}
      </button>
    </MyPageCard>
  );
}
