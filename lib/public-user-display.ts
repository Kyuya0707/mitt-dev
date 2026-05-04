type PublicUserLike = {
  username?: string | null;
  name?: string | null;
  email?: string | null;
};

export function getPublicUserDisplayName(
  user: PublicUserLike | null | undefined,
  fallbackUserId?: string | null
) {
  const username = user?.username?.trim();
  if (username) {
    return username;
  }

  const name = user?.name?.trim();
  if (name) {
    return name;
  }

  const emailLocalPart = user?.email?.split("@")[0]?.trim();
  if (emailLocalPart) {
    return emailLocalPart;
  }

  if (fallbackUserId) {
    return `ユーザー${fallbackUserId.slice(0, 6)}`;
  }

  return "匿名ユーザー";
}
