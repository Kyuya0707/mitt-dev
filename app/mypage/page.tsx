import Link from "next/link";
import prisma from "@/lib/prisma";
import { supabaseServer } from "@/lib/supabase-server";
import { ensurePrismaUser } from "@/lib/ensure-prisma-user";
import NotificationSettingsSection from "./NotificationSettingsSection";
import PpConsentSection from "./PpConsentSection";
import StripeConnectSection from "./StripeConnectSection";
import LogoutButton from "./LogoutButton";
import { syncStripeConnectAccountStatus } from "@/lib/stripe-connect";
import ReferralLinkButton from "@/app/components/ReferralLinkButton";
import MyPageCard from "./MyPageCard";

function getDisplayName(input: {
  username?: string | null;
  name?: string | null;
  email?: string | null;
}) {
  if (input.username?.trim()) {
    return input.username.trim();
  }

  if (input.name?.trim()) {
    return input.name.trim();
  }

  if (input.email?.includes("@")) {
    return input.email.split("@")[0];
  }

  return "未設定";
}

function InfoRow({
  label,
  value,
}: {
  label: string;
  value: React.ReactNode;
}) {
  return (
    <div className="rounded-xl border border-gray-100 bg-gray-50 px-4 py-3">
      <div className="text-xs font-medium text-gray-500">{label}</div>
      <div className="mt-1 text-sm leading-6 text-gray-900">{value}</div>
    </div>
  );
}

function ActionLink({
  href,
  title,
  description,
}: {
  href: string;
  title: string;
  description: string;
}) {
  return (
    <Link
      href={href}
      className="rounded-2xl border border-gray-200 bg-white p-4 shadow-sm transition hover:border-blue-200 hover:bg-blue-50"
    >
      <div className="text-sm font-semibold text-gray-900">{title}</div>
      <div className="mt-1 text-sm leading-6 text-gray-600">{description}</div>
    </Link>
  );
}

export default async function MyPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const supabase = await supabaseServer();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
        <p className="mb-4 text-sm text-gray-700">ログインが必要です。</p>
        <Link
          href="/login?redirectTo=/mypage"
          className="text-sm text-blue-600 underline"
        >
          ログインページへ
        </Link>
      </div>
    );
  }

  const meta = (user.user_metadata ?? {}) as {
    full_name?: string;
    username?: string;
    bio?: string;
    website?: string;
    prefecture?: string;
    interests?: string[];
    avatar_url?: string;
  };

  if (error) {
    console.error("Supabase getUser error:", error.message);
  }

  try {
    await ensurePrismaUser({
      id: user.id,
      email: user.email,
      username: meta.username,
      name: meta.full_name,
      interests: Array.isArray(meta.interests) ? meta.interests : [],
    });
  } catch (syncError) {
    console.error("Failed to ensure Prisma user on mypage:", syncError);
  }

  const sp = searchParams ? await searchParams : undefined;
  const updated =
    (Array.isArray(sp?.updated) ? sp?.updated[0] : sp?.updated) === "1";
  const connectStatusParam = Array.isArray(sp?.connect)
    ? sp?.connect[0]
    : sp?.connect;

  if (connectStatusParam === "return") {
    const existingUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: { stripeAccountId: true },
    });

    if (existingUser?.stripeAccountId) {
      try {
        await syncStripeConnectAccountStatus(user.id, existingUser.stripeAccountId);
      } catch (syncError) {
        console.error("Failed to sync Stripe Connect status on mypage:", syncError);
      }
    }
  }

  const dbUser = await prisma.user.findUnique({
    where: { id: user.id },
    include: {
      questions: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { category: true },
      },
      answers: {
        orderBy: { createdAt: "desc" },
        take: 3,
        include: { question: true },
      },
    },
  });

  if (!dbUser) {
    return (
      <div className="rounded-2xl border border-gray-200 bg-white p-8 shadow-sm">
        ユーザー情報の取得に失敗しました。
      </div>
    );
  }

  const ppConsentAt = dbUser.ppConsentAt ?? null;
  const displayName = getDisplayName({
    username: meta.username || dbUser.username,
    name: meta.full_name || dbUser.name,
    email: user.email ?? dbUser.email,
  });
  const fullName = meta.full_name || dbUser.name || "未設定";
  const interestsText =
    meta.interests && meta.interests.length > 0
      ? meta.interests.join(" / ")
      : dbUser.interestCategories.length > 0
        ? dbUser.interestCategories.join(" / ")
        : "未設定";
  const avatarUrl =
    typeof meta.avatar_url === "string" && meta.avatar_url.trim().length > 0
      ? meta.avatar_url
      : null;
  const displayId = dbUser.displayId ?? "発行準備中";

  return (
    <div className="mx-auto max-w-6xl text-black">
      <div className="mb-8 flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-gray-950">
            マイページ
          </h1>
          <p className="mt-2 text-sm text-gray-600">
            プロフィール、受取設定、通知設定、履歴をまとめて確認できます。
          </p>
        </div>
        {updated && (
          <div className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
            プロフィールを更新しました。
          </div>
        )}
      </div>

      <div className="grid gap-6 lg:grid-cols-[1.35fr_1fr]">
        <div className="space-y-6">
          <MyPageCard
            title="アカウント概要"
            description="表示名、表示ID、認証情報を確認できます。"
            actions={
              <Link
                href="/mypage/edit"
                className="inline-flex rounded-xl bg-blue-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-blue-700"
              >
                プロフィールを編集
              </Link>
            }
          >
            <div className="flex flex-col gap-5 sm:flex-row sm:items-start sm:justify-between">
              <div className="flex items-center gap-4">
                <div className="flex h-20 w-20 items-center justify-center overflow-hidden rounded-full border border-gray-200 bg-gray-100">
                  {avatarUrl ? (
                    // eslint-disable-next-line @next/next/no-img-element
                    <img
                      src={avatarUrl}
                      alt={displayName}
                      className="h-full w-full object-cover"
                    />
                  ) : (
                    <span className="text-xs font-semibold text-gray-500">
                      No Image
                    </span>
                  )}
                </div>
                <div>
                  <p className="text-xl font-semibold text-gray-950">
                    {displayName}
                  </p>
                  <p className="mt-1 text-sm text-gray-600">@{dbUser.username || "未設定"}</p>
                  <p className="mt-1 text-sm text-gray-600">
                    表示ID: <span className="font-medium text-gray-900">{displayId}</span>
                  </p>
                  <p className="mt-1 text-sm text-gray-600">{user.email ?? dbUser.email}</p>
                </div>
              </div>
              <div className="w-full sm:w-auto">
                <ReferralLinkButton referralId={dbUser.username || dbUser.id} />
              </div>
            </div>
          </MyPageCard>

          <div className="grid gap-4 sm:grid-cols-2">
            <ActionLink
              href="/questions/new"
              title="質問する"
              description="知りたいことを報酬付きで投稿します。"
            />
            <ActionLink
              href="/questions"
              title="質問一覧を見る"
              description="公開中の質問やカテゴリを確認できます。"
            />
            <ActionLink
              href="/notifications"
              title="通知を見る"
              description="回答、BEST選定、交渉などの通知を確認できます。"
            />
            <ActionLink
              href="/mypage/purchases"
              title="購入履歴を見る"
              description="質問投稿決済やBEST閲覧購入の履歴を確認できます。"
            />
          </div>

          <MyPageCard title="プロフィール・基本情報">
            <div className="grid gap-3 sm:grid-cols-2">
              <InfoRow label="名前" value={fullName} />
              <InfoRow label="ユーザー名" value={dbUser.username || "未設定"} />
              <InfoRow label="表示ID" value={displayId} />
              <InfoRow label="メールアドレス" value={user.email ?? dbUser.email} />
              <InfoRow label="地域" value={meta.prefecture || "未設定"} />
              <InfoRow
                label="SNS / Webサイト"
                value={
                  meta.website ? (
                    <a
                      href={meta.website}
                      target="_blank"
                      rel="noreferrer"
                      className="break-all text-blue-600 underline"
                    >
                      {meta.website}
                    </a>
                  ) : (
                    "未設定"
                  )
                }
              />
              <div className="sm:col-span-2">
                <InfoRow label="自己紹介" value={meta.bio || "未設定"} />
              </div>
              <div className="sm:col-span-2">
                <InfoRow label="興味カテゴリ" value={interestsText} />
              </div>
            </div>
          </MyPageCard>

          <MyPageCard
            title={
              dbUser.questions.length === 0
                ? "質問投稿履歴"
                : "質問投稿履歴（最新3件）"
            }
            description="最近投稿した質問を確認できます。"
            actions={
              <Link
                href="/mypage/questions"
                className="text-sm text-blue-600 underline"
              >
                すべて見る
              </Link>
            }
          >
            {dbUser.questions.length === 0 ? (
              <p className="text-sm text-gray-500">投稿履歴はまだありません。</p>
            ) : (
              <div className="space-y-3">
                {dbUser.questions.map((question) => (
                  <div
                    key={question.id}
                    className="rounded-xl border border-blue-100 bg-blue-50 px-4 py-3"
                  >
                    <Link
                      href={`/questions/${question.id}`}
                      className="font-medium text-blue-800 underline"
                    >
                      {question.title}
                    </Link>
                    <p className="mt-1 text-sm text-gray-600">
                      カテゴリ: {question.category?.name || "未設定"}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                      投稿日時: {new Date(question.createdAt).toLocaleString("ja-JP")}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </MyPageCard>

          <MyPageCard
            title={dbUser.answers.length === 0 ? "回答履歴" : "回答履歴（最新3件）"}
            description="最近投稿した回答を確認できます。"
            actions={
              <Link
                href="/mypage/answers"
                className="text-sm text-blue-600 underline"
              >
                すべて見る
              </Link>
            }
          >
            {dbUser.answers.length === 0 ? (
              <p className="text-sm text-gray-500">回答履歴はまだありません。</p>
            ) : (
              <div className="space-y-3">
                {dbUser.answers.map((answer) => (
                  <div
                    key={answer.id}
                    className="rounded-xl border border-green-100 bg-green-50 px-4 py-3"
                  >
                    <Link
                      href={`/questions/${answer.questionId}`}
                      className="font-medium text-green-800 underline"
                    >
                      {answer.question?.title || "（削除された質問）"}
                    </Link>
                    <p className="mt-1 text-sm text-gray-500">
                      回答日時: {new Date(answer.createdAt).toLocaleString("ja-JP")}
                    </p>
                    <p className="mt-1 text-sm text-gray-600">
                      {answer.question?.bestAnswerId === answer.id
                        ? "BEST回答に選ばれています"
                        : "通常回答"}
                    </p>
                  </div>
                ))}
              </div>
            )}
          </MyPageCard>
        </div>

        <div className="space-y-6">
          <StripeConnectSection
            stripeAccountId={dbUser.stripeAccountId}
            onboardingCompleted={dbUser.stripeConnectOnboardingCompleted}
            chargesEnabled={dbUser.stripeConnectChargesEnabled}
            payoutsEnabled={dbUser.stripeConnectPayoutsEnabled}
            detailsSubmitted={dbUser.stripeConnectDetailsSubmitted}
            disabledReason={dbUser.stripeConnectDisabledReason}
            currentlyDueCount={
              Array.isArray(dbUser.stripeConnectRequirementsCurrentlyDue)
                ? dbUser.stripeConnectRequirementsCurrentlyDue.length
                : 0
            }
            connectStatusParam={connectStatusParam ?? null}
          />

          <MyPageCard
            title="報酬確認"
            description="質問報酬とBEST閲覧料分配の受取状況を確認できます。"
          >
            <Link
              href="/mypage/rewards"
              className="inline-flex rounded-xl bg-amber-500 px-4 py-2 text-sm font-medium text-white transition hover:bg-amber-600"
            >
              報酬を確認する
            </Link>
          </MyPageCard>

          <NotificationSettingsSection />

          <MyPageCard
            title="同意状況"
            description="副業・税務に関する同意状況を確認できます。"
          >
            <PpConsentSection
              ppConsentAt={ppConsentAt ? ppConsentAt.toISOString() : null}
              redirectTo="/mypage"
            />
          </MyPageCard>

          <MyPageCard
            title="アカウント操作"
            description="ログアウトなどのアカウント操作です。"
          >
            <div className="flex flex-col gap-4">
              <Link
                href="/"
                className="text-sm text-blue-600 underline hover:text-blue-800"
              >
                ← トップへ戻る
              </Link>
              <div>
                <LogoutButton />
              </div>
            </div>
          </MyPageCard>
        </div>
      </div>
    </div>
  );
}
