export const USERNAME_MIN_LENGTH = 3;
export const USERNAME_MAX_LENGTH = 20;

export function normalizeUsername(input: string) {
  return input.trim().replace(/[\r\n\t]+/g, " ");
}

export function validateUsername(input: string) {
  const value = normalizeUsername(input);

  if (!value) {
    return { ok: false as const, message: "ユーザー名を入力してください。" };
  }

  if (value.length < USERNAME_MIN_LENGTH) {
    return {
      ok: false as const,
      message: `ユーザー名は${USERNAME_MIN_LENGTH}文字以上で入力してください。`,
    };
  }

  if (value.length > USERNAME_MAX_LENGTH) {
    return {
      ok: false as const,
      message: `ユーザー名は${USERNAME_MAX_LENGTH}文字以下で入力してください。`,
    };
  }

  return { ok: true as const, value };
}

export function buildUsernameSeed(input?: string | null) {
  const normalized = normalizeUsername(input ?? "")
    .replace(/\s+/g, " ")
    .replace(/^\s+|\s+$/g, "");

  if (!normalized) {
    return "";
  }

  return normalized.slice(0, USERNAME_MAX_LENGTH);
}

export function buildFallbackUsernameCandidates(input: {
  username?: string | null;
  name?: string | null;
  email?: string | null;
  userId: string;
}) {
  const candidates = [
    buildUsernameSeed(input.username),
    buildUsernameSeed(input.name),
    buildUsernameSeed(input.email?.split("@")[0]),
    buildUsernameSeed(`user_${input.userId.slice(0, 8)}`),
  ].filter((value, index, array) => value && array.indexOf(value) === index);

  return candidates.length > 0 ? candidates : ["user_000000"];
}
