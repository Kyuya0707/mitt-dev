"use client";

import { useMemo, useState } from "react";

type ReferralLinkButtonProps = {
  referralId: string;
  className?: string;
};

function buildReferralUrl(referralId: string) {
  const baseUrl =
    process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "") ||
    window.location.origin;

  return `${baseUrl}/?ref=${encodeURIComponent(referralId)}`;
}

async function copyText(text: string) {
  if (navigator.clipboard?.writeText) {
    await navigator.clipboard.writeText(text);
    return;
  }

  const textarea = document.createElement("textarea");
  textarea.value = text;
  textarea.setAttribute("readonly", "true");
  textarea.style.position = "fixed";
  textarea.style.opacity = "0";
  document.body.appendChild(textarea);
  textarea.select();
  document.execCommand("copy");
  document.body.removeChild(textarea);
}

export default function ReferralLinkButton({
  referralId,
  className,
}: ReferralLinkButtonProps) {
  const [message, setMessage] = useState("");
  const [copying, setCopying] = useState(false);
  const referralUrl = useMemo(() => buildReferralUrl(referralId), [referralId]);

  const handleCopy = async () => {
    setCopying(true);
    setMessage("");

    try {
      await copyText(referralUrl);
      setMessage("紹介リンクをコピーしました。");
    } catch {
      setMessage("紹介リンクのコピーに失敗しました。");
    } finally {
      setCopying(false);
    }
  };

  return (
    <div className="flex flex-col gap-2">
      <button
        type="button"
        onClick={handleCopy}
        disabled={copying}
        className={
          className ??
          "rounded border border-gray-300 bg-white px-4 py-2 text-sm text-gray-800 hover:bg-gray-50 disabled:cursor-not-allowed disabled:opacity-60"
        }
      >
        {copying ? "コピー中..." : "紹介リンクを取得する"}
      </button>
      {message && <p className="text-xs text-green-700">{message}</p>}
    </div>
  );
}
