// app/mypage/page.tsx
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

export default async function MyPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  // ✅ Server 用 Supabase（cookies を読む）
  const supabase = await supabaseServer();

  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (!user) {
    return (
      <div className="p-6 text-center">
        <p className="mb-4">ログインが必要です。</p>
        <Link
          href="/login?redirectTo=/mypage"
          className="text-blue-600 underline"
        >
          ログインページへ
        </Link>
      </div>
    );
  }

  // ✅ Supabase Auth のプロフィール（signup時に保存した data）
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

  const interestsText =
    meta.interests && meta.interests.length > 0
      ? meta.interests.join(" / ")
      : "未設定";
  const sp = searchParams ? await searchParams : undefined;
  const updated = (Array.isArray(sp?.updated) ? sp?.updated[0] : sp?.updated) === "1";
  const connectStatusParam = Array.isArray(sp?.connect) ? sp?.connect[0] : sp?.connect;

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

  // DB からユーザー＋履歴を取得
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
    return <div className="p-6">ユーザー情報の取得に失敗しました。</div>;
  }

  const ppConsentAt = dbUser.ppConsentAt ?? null;

  return (
    <div className="max-w-3xl mx-auto p-6 text-black">
      <h1 className="text-3xl font-bold mb-8">マイページ</h1>

      {updated && (
        <div className="mb-6 rounded border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">
          プロフィールを更新しました。
        </div>
      )}

      {/* ===== 基本情報 ===== */}
      <section className="p-5 bg-white border rounded shadow mb-10">
        <h2 className="text-xl font-semibold mb-3">基本情報</h2>

        <p>
          <span className="font-semibold">ユーザーID：</span> {dbUser.id}
        </p>

        <p>
          <span className="font-semibold">メール：</span> {user.email ?? dbUser.email}
        </p>

        <PpConsentSection
          ppConsentAt={ppConsentAt ? ppConsentAt.toISOString() : null}
          redirectTo="/mypage"
        />

        <hr className="my-5" />

        {/* ===== プロフィール表示 ===== */}
        <h3 className="text-lg font-semibold mb-3">プロフィール</h3>

        <div className="flex items-center gap-4 mb-4">
          <div className="w-16 h-16 rounded-full overflow-hidden bg-gray-200">
            {meta.avatar_url ? (
              // eslint-disable-next-line @next/next/no-img-element
              <img
                src={meta.avatar_url}
                alt="avatar"
                className="w-full h-full object-cover"
              />
            ) : (
              <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                No Image
              </div>
            )}
          </div>

          <div>
            <p className="text-sm">
              <span className="font-semibold">表示名：</span>
              {meta.username || dbUser.username || meta.full_name || dbUser.name || "未設定"}
            </p>

            {(meta.full_name || dbUser.name) && (
              <p className="text-sm">
                <span className="font-semibold">氏名：</span>
                {meta.full_name || dbUser.name}
              </p>
            )}
          </div>
        </div>

        <p className="text-sm mt-1">
          <span className="font-semibold">自己紹介：</span>
          {meta.bio || "未設定"}
        </p>

        <p className="text-sm mt-1">
          <span className="font-semibold">興味カテゴリー：</span>
          {interestsText}
        </p>

        <p className="text-sm mt-1">
          <span className="font-semibold">SNS / Webサイト：</span>
          {meta.website ? (
            <a
              href={meta.website}
              target="_blank"
              rel="noreferrer"
              className="text-blue-600 underline"
            >
              {meta.website}
            </a>
          ) : (
            "未設定"
          )}
        </p>

        <p className="text-sm mt-1">
          <span className="font-semibold">地域：</span>
          {meta.prefecture || "未設定"}
        </p>

        <div className="mt-4">
          <Link
            href="/mypage/edit"
            className="text-sm text-blue-600 underline hover:text-blue-800"
          >
            → プロフィールを編集する
          </Link>
        </div>

        <div className="mt-5 rounded border border-gray-200 bg-gray-50 p-4">
          <p className="text-sm font-semibold text-gray-900">紹介リンク</p>
          <p className="mt-1 text-sm text-gray-600">
            Know Value を紹介するときに使えるリンクです。
          </p>
          <div className="mt-3">
            <ReferralLinkButton referralId={dbUser.username || dbUser.id} />
          </div>
        </div>
      </section>

      <StripeConnectSection
        stripeAccountId={dbUser.stripeAccountId}
        onboardingCompleted={dbUser.stripeConnectOnboardingCompleted}
        chargesEnabled={dbUser.stripeConnectChargesEnabled}
        payoutsEnabled={dbUser.stripeConnectPayoutsEnabled}
        detailsSubmitted={dbUser.stripeConnectDetailsSubmitted}
        disabledReason={dbUser.stripeConnectDisabledReason}
        currentlyDueCount={Array.isArray(dbUser.stripeConnectRequirementsCurrentlyDue) ? dbUser.stripeConnectRequirementsCurrentlyDue.length : 0}
        connectStatusParam={connectStatusParam ?? null}
      />

      <NotificationSettingsSection />

      <section className="mb-10 rounded border border-amber-200 bg-amber-50 p-5 shadow-sm">
        <h2 className="mb-3 text-xl font-semibold text-amber-800">報酬確認</h2>
        <p className="text-sm text-amber-900">
          質問報酬とBEST閲覧料分配の受取状況を確認できます。
        </p>
        <div className="mt-4">
          <Link
            href="/mypage/rewards"
            className="text-sm text-amber-800 underline hover:text-amber-900"
          >
            → 報酬を確認する
          </Link>
        </div>
      </section>

      {/* ===== 同意未完了時の注意 ===== */}
      {/* ===== 質問履歴 ===== */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 text-blue-700">
          {dbUser.questions.length === 0
            ? "質問投稿履歴"
            : "質問投稿履歴（最新3件）"}
        </h2>

        {dbUser.questions.length === 0 ? (
          <p className="text-gray-500">投稿履歴はまだありません。</p>
        ) : (
          <div className="space-y-4">
            {dbUser.questions.map((q) => (
              <div
                key={q.id}
                className="p-4 bg-blue-50 border border-blue-200 rounded shadow"
              >
                <Link
                  href={`/questions/${q.id}`}
                  className="font-semibold text-blue-800 underline"
                >
                  {q.title}
                </Link>
                <p className="text-sm text-gray-600 mt-1">
                  投稿日時：
                  {new Date(q.createdAt).toLocaleString("ja-JP")}
                </p>
                <p className="text-sm">
                  カテゴリ：{q.category?.name}
                </p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <Link
            href="/mypage/questions"
            className="text-blue-600 underline text-sm hover:text-blue-800"
          >
            → 質問履歴をすべて見る
          </Link>
        </div>
      </section>

      {/* ===== 回答履歴 ===== */}
      <section className="mb-10">
        <h2 className="text-xl font-semibold mb-4 text-green-700">
          {dbUser.answers.length === 0
            ? "回答履歴"
            : "回答履歴（最新3件）"}
        </h2>

        {dbUser.answers.length === 0 ? (
          <p className="text-gray-500">回答履歴はまだありません。</p>
        ) : (
          <div className="space-y-4">
            {dbUser.answers.map((ans) => (
              <div
                key={ans.id}
                className="p-4 bg-green-50 border border-green-200 rounded shadow"
              >
                <Link
                  href={`/questions/${ans.questionId}`}
                  className="font-semibold text-green-800 underline"
                >
                  {ans.question?.title || "（削除された質問）"}
                </Link>

                <p className="text-sm text-gray-600 mt-1">
                  回答日時：
                  {new Date(ans.createdAt).toLocaleString("ja-JP")}
                </p>

                {ans.question?.bestAnswerId === ans.id ? (
                  <p className="text-green-700 font-bold text-sm mt-1">
                    ★ BEST回答に選ばれました！
                  </p>
                ) : (
                  <p className="text-gray-600 text-sm mt-1">
                    （通常回答）
                  </p>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4">
          <Link
            href="/mypage/answers"
            className="text-green-600 underline text-sm hover:text-green-800"
          >
            → 回答履歴をすべて見る
          </Link>
        </div>
      </section>

      <div className="mt-6">
        <Link
          href="/mypage/purchases"
          className="text-blue-600 underline hover:text-blue-800"
        >
          購入履歴（支払い履歴）を見る →
        </Link>
      </div>

      <div className="mt-8 flex flex-wrap items-center gap-4">
        <Link
          href="/"
          className="text-blue-600 underline hover:text-blue-800 text-sm"
        >
          ← トップへ戻る
        </Link>
        <LogoutButton />
      </div>
    </div>
  );
}
