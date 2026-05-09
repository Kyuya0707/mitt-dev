import prisma from "@/lib/prisma";
import { Prisma } from "@prisma/client";
import {
  buildCommonEmailFooterHtml,
  buildCommonEmailFooterText,
  SUPPORT_EMAIL,
} from "@/lib/email-footer";

export const NOTIFICATION_TYPES = {
  ANSWER_CREATED: "ANSWER_CREATED",
  COMMENT_CREATED: "COMMENT_CREATED",
  BEST_SELECTED: "BEST_SELECTED",
  NEGOTIATION_CREATED: "NEGOTIATION_CREATED",
  NEGOTIATION_ACCEPTED: "NEGOTIATION_ACCEPTED",
  NEGOTIATION_REJECTED: "NEGOTIATION_REJECTED",
  CATEGORY_QUESTION_CREATED: "CATEGORY_QUESTION_CREATED",
} as const;

export type NotificationType =
  (typeof NOTIFICATION_TYPES)[keyof typeof NOTIFICATION_TYPES];

type NotificationData = {
  questionId?: string;
  answerId?: string;
  commentId?: string;
  negotiationId?: string;
  categoryId?: string;
};

type CreateNotificationInput = {
  userId: string;
  actorUserId?: string | null;
  type: NotificationType;
  message: string;
  url?: string | null;
  data?: NotificationData;
};

type SafeCreateNotificationInput = CreateNotificationInput & {
  context?: string;
};

type EmailPreferenceKey =
  | "emailOnAnswerCreated"
  | "emailOnCommentCreated"
  | "emailOnBestSelected"
  | "emailOnNegotiationCreated"
  | "emailOnNegotiationAccepted"
  | "emailOnNegotiationRejected"
  | "emailOnCategoryQuestionCreated"
  | "emailOnLogin";

const EMAIL_PREFERENCE_KEY_BY_TYPE: Record<NotificationType, EmailPreferenceKey> = {
  ANSWER_CREATED: "emailOnAnswerCreated",
  COMMENT_CREATED: "emailOnCommentCreated",
  BEST_SELECTED: "emailOnBestSelected",
  NEGOTIATION_CREATED: "emailOnNegotiationCreated",
  NEGOTIATION_ACCEPTED: "emailOnNegotiationAccepted",
  NEGOTIATION_REJECTED: "emailOnNegotiationRejected",
  CATEGORY_QUESTION_CREATED: "emailOnCategoryQuestionCreated",
};

function formatNotificationDate(date: Date) {
  return new Intl.DateTimeFormat("ja-JP", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Asia/Tokyo",
  }).format(date);
}

function getNotificationSubject(type: NotificationType) {
  switch (type) {
    case NOTIFICATION_TYPES.ANSWER_CREATED:
      return "あなたの質問に回答がつきました";
    case NOTIFICATION_TYPES.COMMENT_CREATED:
      return "あなたの回答にコメントがつきました";
    case NOTIFICATION_TYPES.BEST_SELECTED:
      return "あなたの回答がBESTに選ばれました";
    case NOTIFICATION_TYPES.NEGOTIATION_CREATED:
      return "交渉提案が届きました";
    case NOTIFICATION_TYPES.NEGOTIATION_ACCEPTED:
      return "交渉提案が承認されました";
    case NOTIFICATION_TYPES.NEGOTIATION_REJECTED:
      return "交渉が見送られました";
    case NOTIFICATION_TYPES.CATEGORY_QUESTION_CREATED:
      return "興味カテゴリの質問が公開されました";
  }
}

function toAbsoluteUrl(url?: string | null) {
  if (!url) {
    return null;
  }

  if (/^https?:\/\//.test(url)) {
    return url;
  }

  const baseUrl = process.env.NEXT_PUBLIC_SITE_URL?.replace(/\/$/, "");
  if (!baseUrl) {
    return url;
  }

  return `${baseUrl}${url.startsWith("/") ? url : `/${url}`}`;
}

function escapeHtml(value: string) {
  return value
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

function buildEmailContent(params: {
  type: NotificationType;
  message: string;
  url?: string | null;
}) {
  const subject = getNotificationSubject(params.type);
  const absoluteUrl = toAbsoluteUrl(params.url);
  const escapedSubject = escapeHtml(subject);
  const escapedMessage = escapeHtml(params.message);
  const escapedUrl = absoluteUrl ? escapeHtml(absoluteUrl) : null;

  const textLines = [subject, "", params.message];

  if (absoluteUrl) {
    textLines.push("", absoluteUrl);
  }

  textLines.push("", buildCommonEmailFooterText());

  const html = `
    <div style="background:#f5f7fb;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 24px 8px 24px;">
          <div style="font-size:12px;letter-spacing:0.08em;color:#6b7280;font-weight:600;">KnowValue Notification</div>
          <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.4;color:#111827;">${escapedSubject}</h1>
        </div>
        <div style="padding:24px;">
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;font-size:15px;line-height:1.8;color:#374151;">
            ${escapedMessage}
          </div>
          ${
            escapedUrl
              ? `<div style="margin-top:24px;">
                  <a href="${escapedUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;">
                    該当ページを見る
                  </a>
                </div>
                <div style="margin-top:16px;font-size:12px;line-height:1.6;color:#6b7280;word-break:break-all;">
                  リンク: <a href="${escapedUrl}" style="color:#2563eb;">${escapedUrl}</a>
                </div>`
              : ""
          }
          ${buildCommonEmailFooterHtml(escapeHtml)}
        </div>
      </div>
    </div>
  `;

  return {
    subject,
    text: textLines.join("\n"),
    html,
  };
}

export async function ensureNotificationPreference(userId: string) {
  return prisma.notificationPreference.upsert({
    where: { userId },
    update: {},
    create: { userId },
  });
}

async function sendNotificationEmail(params: {
  to: string;
  type: NotificationType;
  message: string;
  url?: string | null;
}) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;
  const emailContent = buildEmailContent({
    type: params.type,
    message: params.message,
    url: params.url,
  });

  if (!apiKey || !from) {
    return;
  }

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject: emailContent.subject,
      text: emailContent.text,
      html: emailContent.html,
    }),
  });

  const responseText = await response.text().catch(() => "");

  if (!response.ok) {
    console.error("[notifications][email] resend error", {
      status: response.status,
      body: responseText,
    });
    throw new Error(`Resend API error: ${response.status} ${responseText}`);
  }
}

async function sendLoginEmail(params: { to: string; loggedInAt: Date }) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.NOTIFICATION_FROM_EMAIL;

  if (!apiKey || !from) {
    return;
  }

  const loggedInAtText = formatNotificationDate(params.loggedInAt);
  const resetPasswordUrl = toAbsoluteUrl("/forgot-password");
  const escapedResetPasswordUrl = resetPasswordUrl
    ? escapeHtml(resetPasswordUrl)
    : null;

  const subject = "【Know Value】ログインがありました";
  const text = [
    subject,
    "",
    "Know Value へのログインを確認しました。",
    `ログイン日時: ${loggedInAtText}`,
    "",
    "お心当たりがない場合は、すぐにパスワードを再設定してください。",
    ...(resetPasswordUrl ? [resetPasswordUrl, ""] : []),
    `${SUPPORT_EMAIL} までご連絡ください。`,
    "",
    buildCommonEmailFooterText(),
  ].join("\n");

  const html = `
    <div style="background:#f5f7fb;padding:32px 16px;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif;color:#111827;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e5e7eb;border-radius:16px;overflow:hidden;">
        <div style="padding:24px 24px 8px 24px;">
          <div style="font-size:12px;letter-spacing:0.08em;color:#6b7280;font-weight:600;">KnowValue Security Notice</div>
          <h1 style="margin:12px 0 0 0;font-size:22px;line-height:1.4;color:#111827;">${escapeHtml(
            subject
          )}</h1>
        </div>
        <div style="padding:24px;">
          <div style="background:#f9fafb;border:1px solid #e5e7eb;border-radius:12px;padding:16px;font-size:15px;line-height:1.8;color:#374151;">
            <div>Know Value へのログインを確認しました。</div>
            <div style="margin-top:8px;"><strong>ログイン日時:</strong> ${escapeHtml(
              loggedInAtText
            )}</div>
            <div style="margin-top:12px;">お心当たりがない場合は、すぐにパスワードを再設定してください。</div>
          </div>
          ${
            escapedResetPasswordUrl
              ? `<div style="margin-top:24px;">
                  <a href="${escapedResetPasswordUrl}" style="display:inline-block;background:#111827;color:#ffffff;text-decoration:none;padding:12px 18px;border-radius:10px;font-size:14px;font-weight:600;">
                    パスワードを再設定する
                  </a>
                </div>`
              : ""
          }
          <div style="margin-top:16px;font-size:13px;line-height:1.8;color:#4b5563;">
            ご不明点は <a href="mailto:${escapeHtml(
              SUPPORT_EMAIL
            )}" style="color:#2563eb;">${escapeHtml(
    SUPPORT_EMAIL
  )}</a> までご連絡ください。
          </div>
          ${buildCommonEmailFooterHtml(escapeHtml)}
        </div>
      </div>
    </div>
  `;

  const response = await fetch("https://api.resend.com/emails", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      from,
      to: [params.to],
      subject,
      text,
      html,
    }),
  });

  const responseText = await response.text().catch(() => "");

  if (!response.ok) {
    console.error("[notifications][login-email] resend error", {
      status: response.status,
      body: responseText,
    });
    throw new Error(`Resend API error: ${response.status} ${responseText}`);
  }
}

export async function createUserNotification({
  userId,
  actorUserId,
  type,
  message,
  url,
  data,
}: CreateNotificationInput) {
  if (!userId) {
    return null;
  }

  if (actorUserId && actorUserId === userId) {
    return null;
  }

  const notification = await prisma.notification.create({
    data: {
      userId,
      type,
      message,
      url: url ?? null,
      data: data ? (data as Prisma.InputJsonValue) : undefined,
    },
  });

  try {
    const preference = await ensureNotificationPreference(userId);
    const preferenceKey = EMAIL_PREFERENCE_KEY_BY_TYPE[type];
    const shouldSend = preference[preferenceKey];

    if (!shouldSend) {
      return notification;
    }

    const targetUser = await prisma.user.findUnique({
      where: { id: userId },
      select: { email: true },
    });

    if (!targetUser?.email) {
      return notification;
    }

    await sendNotificationEmail({
      to: targetUser.email,
      type,
      message,
      url,
    });
  } catch (error) {
    console.error("Notification email failed:", error);
  }

  return notification;
}

export async function safeCreateUserNotification(
  input: SafeCreateNotificationInput
) {
  try {
    return await createUserNotification(input);
  } catch (error) {
    console.error("Notification create failed:", {
      context: input.context ?? null,
      userId: input.userId,
      actorUserId: input.actorUserId ?? null,
      type: input.type,
      data: input.data ?? null,
      error,
    });
    return null;
  }
}

export async function createCategoryQuestionNotifications(input: {
  actorUserId: string;
  questionId: string;
  questionTitle: string;
  categoryId: string;
  categoryName: string;
}) {
  const recipients = await prisma.user.findMany({
    where: {
      id: { not: input.actorUserId },
      interestCategories: {
        has: input.categoryName,
      },
    },
    select: { id: true },
  });

  for (const recipient of recipients) {
    await safeCreateUserNotification({
      userId: recipient.id,
      actorUserId: input.actorUserId,
      type: NOTIFICATION_TYPES.CATEGORY_QUESTION_CREATED,
      message: `興味カテゴリ「${input.categoryName}」の質問が公開されました: ${input.questionTitle}`,
      url: `/questions/${input.questionId}`,
      data: {
        questionId: input.questionId,
        categoryId: input.categoryId,
      },
      context: "category_question_created",
    });
  }
}

export async function sendLoginNotificationEmail(input: {
  userId: string;
  email: string;
  loggedInAt?: Date;
}) {
  try {
    const preference = await ensureNotificationPreference(input.userId);

    if (!preference.emailOnLogin) {
      return false;
    }

    await sendLoginEmail({
      to: input.email,
      loggedInAt: input.loggedInAt ?? new Date(),
    });

    return true;
  } catch (error) {
    console.error("Login notification email failed:", error);
    return false;
  }
}
