type AdminPayoutNotificationInput = {
  payoutType: "question_reward" | "best_view";
  amount: number;
  recipientName?: string | null;
  recipientEmail?: string | null;
  questionId: string;
  answerId: string;
  adminPath: "/admin/payouts" | "/admin/best-view-payouts";
};

function getAdminNotificationEmails() {
  return (process.env.ADMIN_PAYOUT_NOTIFICATION_EMAIL ?? "")
    .split(",")
    .map((value) => value.trim())
    .filter((value) => value.length > 0);
}

function toAbsoluteUrl(path: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");

  if (!baseUrl) {
    return path;
  }

  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function getPayoutTypeLabel(type: AdminPayoutNotificationInput["payoutType"]) {
  return type === "question_reward" ? "質問報酬" : "BEST閲覧料分配";
}

function buildAdminPayoutEmailContent(input: AdminPayoutNotificationInput) {
  const subject = "【KnowValue】送金対応が必要です";
  const payoutTypeLabel = getPayoutTypeLabel(input.payoutType);
  const recipient = input.recipientName || input.recipientEmail || "未設定";
  const link = toAbsoluteUrl(input.adminPath);

  const text = [
    subject,
    "",
    `送金種別: ${payoutTypeLabel}`,
    `対象金額: ${input.amount.toLocaleString("ja-JP")}円`,
    `受取ユーザー: ${recipient}`,
    `questionId: ${input.questionId}`,
    `answerId: ${input.answerId}`,
    `管理画面: ${link}`,
  ].join("\n");

  const html = `
    <div style="background:#f5f7fb;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 24px 8px 24px;">
          <div style="font-size:12px;letter-spacing:0.08em;color:#6b7280;font-weight:600;">KnowValue Admin Notification</div>
          <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.4;color:#111827;">${escapeHtml(
            subject
          )}</h1>
        </div>
        <div style="padding:24px;">
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;font-size:15px;line-height:1.8;color:#374151;">
            <div><strong>送金種別:</strong> ${escapeHtml(payoutTypeLabel)}</div>
            <div><strong>対象金額:</strong> ${escapeHtml(
              `${input.amount.toLocaleString("ja-JP")}円`
            )}</div>
            <div><strong>受取ユーザー:</strong> ${escapeHtml(recipient)}</div>
            <div><strong>questionId:</strong> ${escapeHtml(input.questionId)}</div>
            <div><strong>answerId:</strong> ${escapeHtml(input.answerId)}</div>
          </div>
          <div style="margin-top:24px;">
            <a href="${escapeHtml(
              link
            )}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;">
              管理画面を開く
            </a>
          </div>
          <div style="margin-top:16px;font-size:12px;line-height:1.6;color:#6b7280;word-break:break-all;">
            リンク: <a href="${escapeHtml(link)}" style="color:#2563eb;">${escapeHtml(
              link
            )}</a>
          </div>
        </div>
      </div>
    </div>
  `;

  return { subject, text, html };
}

export async function sendAdminPayoutNotification(
  input: AdminPayoutNotificationInput
) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  const to = getAdminNotificationEmails();

  if (!apiKey || !from || to.length === 0) {
    return;
  }

  const emailContent = buildAdminPayoutEmailContent(input);

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to,
        subject: emailContent.subject,
        text: emailContent.text,
        html: emailContent.html,
      }),
    });

    const responseText = await response.text().catch(() => "");

    if (!response.ok) {
      console.error("[admin-notifications] resend error", {
        status: response.status,
        body: responseText,
      });
    }
  } catch (error) {
    console.error("Admin payout notification failed:", error);
  }
}
