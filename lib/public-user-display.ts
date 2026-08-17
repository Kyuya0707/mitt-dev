type PublicUserLike = {
  username?: string | null;
};

export function getPublicUserDisplayName(
  user: PublicUserLike | null | undefined,
  fallbackUserId?: string | null
) {
  const username = user?.username?.trim();
  if (username) {
    return username;
  }

  if (fallbackUserId) {
    return `ユーザー${fallbackUserId.slice(0, 6)}`;
  }

  return "匿名ユーザー";
}
