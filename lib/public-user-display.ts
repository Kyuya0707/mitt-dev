type PublicUserLike = {
  username?: string | null;
  deletedAt?: Date | string | null;
};

export function getPublicUserDisplayName(
  user: PublicUserLike | null | undefined,
  fallbackUserId?: string | null
) {
  if (user?.deletedAt) {
    return "退会済みユーザー";
  }
  const username = user?.username?.trim();
  if (username) {
    return username;
  }

  if (fallbackUserId) {
    return `ユーザー${fallbackUserId.slice(0, 6)}`;
  }

  return "匿名ユーザー";
}
