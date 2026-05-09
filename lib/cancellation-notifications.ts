import {
  buildCommonEmailFooterHtml,
  buildCommonEmailFooterText,
} from "@/lib/email-footer";
import { getSafeErrorMessage } from "@/lib/safe-error";
import { getBaseUrl } from "@/lib/site-url";

type AdminCancellationEmailInput = {
  questionId: string;
  questionTitle: string;
  requesterName: string;
  rewardAmount: number;
  checkoutAmount: number;
  answerCount: number;
  reason?: string | null;
};

type UserCancellationEmailInput = {
  to: string;
  questionId: string;
  questionTitle: string;
  adminNote?: string | null;
};

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function toAbsoluteUrl(path: string) {
  const baseUrl = getBaseUrl();
  return `${baseUrl}${path.startsWith("/") ? path : `/${path}`}`;
}

function getAdminNotificationEmails() {
  const values = [
    ...(process.env.ADMIN_PAYOUT_NOTIFICATION_EMAIL ?? "").split(","),
    ...(process.env.ADMIN_EMAILS ?? "").split(","),
  ]
    .map((value) => value.trim())
    .filter((value) => value.length > 0);

  return Array.from(new Set(values));
}

async function sendEmail(params: {
  to: string[];
  subject: string;
  text: string;
  html: string;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;

  if (!apiKey || !from || params.to.length === 0) {
    return;
  }

  try {
    const response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from,
        to: params.to,
        subject: params.subject,
        text: params.text,
        html: params.html,
      }),
    });

    const responseText = await response.text().catch(() => "");

    if (!response.ok) {
      console.error("[cancellation-notifications] resend error", {
        status: response.status,
        message: responseText || "resend_request_failed",
      });
    }
  } catch (error) {
    console.error("[cancellation-notifications] send failed", {
      message: getSafeErrorMessage(error),
    });
  }
}

export async function sendAdminCancellationRequestNotification(
  input: AdminCancellationEmailInput
) {
  const to = getAdminNotificationEmails();
  if (to.length === 0) {
    return;
  }

  const subject = "【Know Value】キャンセル申請が届きました";
  const adminUrl = toAbsoluteUrl("/admin/cancellation-requests");
  const reasonText = input.reason?.trim() || "未入力";

  const text = [
    subject,
    "",
    `questionId: ${input.questionId}`,
    `質問タイトル: ${input.questionTitle}`,
    `質問者: ${input.requesterName}`,
    `報酬額: ${input.rewardAmount.toLocaleString("ja-JP")}円`,
    `決済額: ${input.checkoutAmount.toLocaleString("ja-JP")}円`,
    `回答数: ${input.answerCount}件`,
    `申請理由: ${reasonText}`,
    `管理画面: ${adminUrl}`,
    "",
    buildCommonEmailFooterText(),
  ].join("\n");

  const html = `
    <div style="background:#f5f7fb;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 24px 8px 24px;">
          <div style="font-size:12px;letter-spacing:0.08em;color:#6b7280;font-weight:600;">Know Value Admin Notification</div>
          <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.4;color:#111827;">${escapeHtml(subject)}</h1>
        </div>
        <div style="padding:24px;">
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;font-size:15px;line-height:1.8;color:#374151;">
            <div><strong>questionId:</strong> ${escapeHtml(input.questionId)}</div>
            <div><strong>質問タイトル:</strong> ${escapeHtml(input.questionTitle)}</div>
            <div><strong>質問者:</strong> ${escapeHtml(input.requesterName)}</div>
            <div><strong>報酬額:</strong> ${escapeHtml(`${input.rewardAmount.toLocaleString("ja-JP")}円`)}</div>
            <div><strong>決済額:</strong> ${escapeHtml(`${input.checkoutAmount.toLocaleString("ja-JP")}円`)}</div>
            <div><strong>回答数:</strong> ${escapeHtml(`${input.answerCount}件`)}</div>
            <div><strong>申請理由:</strong> ${escapeHtml(reasonText)}</div>
          </div>
          <div style="margin-top:24px;">
            <a href="${escapeHtml(adminUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;">
              管理画面を開く
            </a>
          </div>
          <div style="margin-top:16px;font-size:12px;line-height:1.6;color:#6b7280;word-break:break-all;">
            リンク: <a href="${escapeHtml(adminUrl)}" style="color:#2563eb;">${escapeHtml(adminUrl)}</a>
          </div>
          ${buildCommonEmailFooterHtml(escapeHtml)}
        </div>
      </div>
    </div>
  `;

  await sendEmail({ to, subject, text, html });
}

export async function sendCancellationRequestReceivedEmail(
  input: UserCancellationEmailInput
) {
  const subject = "【Know Value】キャンセル申請を受け付けました";
  const questionUrl = toAbsoluteUrl(`/questions/${input.questionId}`);
  const text = [
    subject,
    "",
    `「${input.questionTitle}」のキャンセル申請を受け付けました。`,
    "運営が内容を確認し、承認された場合に返金処理を行います。",
    questionUrl,
    "",
    buildCommonEmailFooterText(),
  ].join("\n");

  const html = `
    <div style="background:#f5f7fb;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 24px 8px 24px;">
          <div style="font-size:12px;letter-spacing:0.08em;color:#6b7280;font-weight:600;">Know Value</div>
          <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.4;color:#111827;">${escapeHtml(subject)}</h1>
        </div>
        <div style="padding:24px;">
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;font-size:15px;line-height:1.8;color:#374151;">
            <div>「${escapeHtml(input.questionTitle)}」のキャンセル申請を受け付けました。</div>
            <div style="margin-top:8px;">運営が内容を確認し、承認された場合に返金処理を行います。</div>
          </div>
          <div style="margin-top:24px;">
            <a href="${escapeHtml(questionUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;">
              質問ページを見る
            </a>
          </div>
          ${buildCommonEmailFooterHtml(escapeHtml)}
        </div>
      </div>
    </div>
  `;

  await sendEmail({ to: [input.to], subject, text, html });
}

export async function sendCancellationApprovedEmail(
  input: UserCancellationEmailInput
) {
  const subject = "【Know Value】キャンセル申請が承認されました";
  const questionUrl = toAbsoluteUrl(`/questions/${input.questionId}`);
  const text = [
    subject,
    "",
    `「${input.questionTitle}」のキャンセル申請が承認されました。`,
    "返金処理を行いました。カード会社への反映時期はご利用の決済会社により異なります。",
    ...(input.adminNote ? [`運営メモ: ${input.adminNote}`, ""] : []),
    questionUrl,
    "",
    buildCommonEmailFooterText(),
  ].join("\n");

  const html = `
    <div style="background:#f5f7fb;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 24px 8px 24px;">
          <div style="font-size:12px;letter-spacing:0.08em;color:#6b7280;font-weight:600;">Know Value</div>
          <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.4;color:#111827;">${escapeHtml(subject)}</h1>
        </div>
        <div style="padding:24px;">
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;font-size:15px;line-height:1.8;color:#374151;">
            <div>「${escapeHtml(input.questionTitle)}」のキャンセル申請が承認されました。</div>
            <div style="margin-top:8px;">返金処理を行いました。カード会社への反映時期はご利用の決済会社により異なります。</div>
            ${
              input.adminNote
                ? `<div style="margin-top:8px;"><strong>運営メモ:</strong> ${escapeHtml(input.adminNote)}</div>`
                : ""
            }
          </div>
          <div style="margin-top:24px;">
            <a href="${escapeHtml(questionUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;">
              質問ページを見る
            </a>
          </div>
          ${buildCommonEmailFooterHtml(escapeHtml)}
        </div>
      </div>
    </div>
  `;

  await sendEmail({ to: [input.to], subject, text, html });
}

export async function sendCancellationRejectedEmail(
  input: UserCancellationEmailInput
) {
  const subject = "【Know Value】キャンセル申請は承認されませんでした";
  const questionUrl = toAbsoluteUrl(`/questions/${input.questionId}`);
  const text = [
    subject,
    "",
    `「${input.questionTitle}」のキャンセル申請は承認されませんでした。`,
    ...(input.adminNote ? [`運営メモ: ${input.adminNote}`, ""] : []),
    questionUrl,
    "",
    buildCommonEmailFooterText(),
  ].join("\n");

  const html = `
    <div style="background:#f5f7fb;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 24px 8px 24px;">
          <div style="font-size:12px;letter-spacing:0.08em;color:#6b7280;font-weight:600;">Know Value</div>
          <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.4;color:#111827;">${escapeHtml(subject)}</h1>
        </div>
        <div style="padding:24px;">
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;font-size:15px;line-height:1.8;color:#374151;">
            <div>「${escapeHtml(input.questionTitle)}」のキャンセル申請は承認されませんでした。</div>
            ${
              input.adminNote
                ? `<div style="margin-top:8px;"><strong>運営メモ:</strong> ${escapeHtml(input.adminNote)}</div>`
                : ""
            }
          </div>
          <div style="margin-top:24px;">
            <a href="${escapeHtml(questionUrl)}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;">
              質問ページを見る
            </a>
          </div>
          ${buildCommonEmailFooterHtml(escapeHtml)}
        </div>
      </div>
    </div>
  `;

  await sendEmail({ to: [input.to], subject, text, html });
}
