const FORBIDDEN_CONTACT_HOSTS = [
  "line.me",
  "discord.com",
  "discord.gg",
  "instagram.com",
  "twitter.com",
  "x.com",
  "facebook.com",
  "tiktok.com",
  "telegram.me",
  "t.me",
  "wa.me",
  "linkedin.com",
] as const;

const FORBIDDEN_QUERY_KEYS = [
  "ref",
  "referral",
  "affiliate",
  "aff",
  "invite",
  "invite_code",
] as const;

export function validateUserContentLinks(content: string) {
  if (/紹介コード|招待コード|アフィリエイト|LINE\s*ID|Discord\s*ID/i.test(content)) {
    return {
      ok: false as const,
      message: "紹介・招待コードや外部連絡先への誘導は投稿できません",
    };
  }

  const urls = content.match(/https?:\/\/[^\s<>()]+/gi) ?? [];
  for (const rawUrl of urls) {
    try {
      const url = new URL(rawUrl.replace(/[。、，．]+$/, ""));
      const host = url.hostname.toLowerCase().replace(/^www\./, "");
      if (
        FORBIDDEN_CONTACT_HOSTS.some(
          (forbidden) => host === forbidden || host.endsWith(`.${forbidden}`)
        )
      ) {
        return {
          ok: false as const,
          message: "個人SNS・メッセージサービスへの誘導リンクは投稿できません",
        };
      }
      if (
        FORBIDDEN_QUERY_KEYS.some((key) => url.searchParams.has(key))
      ) {
        return {
          ok: false as const,
          message: "紹介・アフィリエイト識別子を含むリンクは投稿できません",
        };
      }
    } catch {
      return { ok: false as const, message: "リンクの形式を確認してください" };
    }
  }

  return { ok: true as const };
}
