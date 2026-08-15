/* eslint-disable @next/next/no-img-element */
import Link from "next/link";
import { getCurrentUser } from "@/lib/auth";
import NotificationBell from "@/app/components/NotificationBell";
import { getPublicUserDisplayName } from "@/lib/public-user-display";

export default async function AppUserNav() {
  const authUser = await getCurrentUser();

  if (!authUser) {
    return (
      <Link href="/login" className="text-gray-700 hover:underline">
        ログイン
      </Link>
    );
  }

  const avatarUrl =
    typeof authUser.user_metadata?.avatar_url === "string" &&
    authUser.user_metadata.avatar_url.trim().length > 0
      ? authUser.user_metadata.avatar_url.trim()
      : "/no-image.svg";
  const displayName = getPublicUserDisplayName(
    {
      username:
        (typeof authUser.user_metadata?.username === "string"
          ? authUser.user_metadata.username
          : null),
      name:
        (typeof authUser.user_metadata?.full_name === "string"
          ? authUser.user_metadata.full_name
          : null),
      email: authUser.email ?? null,
    },
    authUser.id
  );

  return (
    <div className="flex items-center gap-3">
      <NotificationBell />
      <Link
        href="/mypage"
        className="block h-9 w-9 overflow-hidden rounded-full border bg-gray-100"
        aria-label={`${displayName}のマイページ`}
        title={`${displayName}のマイページ`}
      >
        <img
          src={avatarUrl}
          alt={displayName}
          className="h-full w-full object-cover"
        />
      </Link>
    </div>
  );
}
