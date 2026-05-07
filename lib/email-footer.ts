export const SUPPORT_EMAIL = "support@knowvalue.jp";

export function buildCommonEmailFooterText() {
  return [
    "--------------------------------------------------------------",
    "",
    "本メールは Know Value より自動送信されています。",
    "送信専用メールアドレスのため、ご返信いただいてもお答えできません。",
    "",
    "ご不明点・お問い合わせにつきましては、",
    `${SUPPORT_EMAIL} までご連絡ください。`,
  ].join("\n");
}

export function buildCommonEmailFooterHtml(
  escapeHtml: (value: string) => string
) {
  return `
    <div style="margin-top:24px;padding-top:16px;border-top:1px solid #e5e7eb;font-size:12px;line-height:1.8;color:#6b7280;">
      <div>本メールは Know Value より自動送信されています。</div>
      <div>送信専用メールアドレスのため、ご返信いただいてもお答えできません。</div>
      <div style="margin-top:8px;">
        ご不明点・お問い合わせにつきましては、
        <a href="mailto:${escapeHtml(SUPPORT_EMAIL)}" style="color:#2563eb;">${escapeHtml(
          SUPPORT_EMAIL
        )}</a>
        までご連絡ください。
      </div>
      <div style="margin-top:8px;">--------------------------------------------------------------</div>
    </div>
  `;
}
