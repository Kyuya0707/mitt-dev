// app/signup/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClientBrowser } from "@/lib/supabase-browser";
import { CATEGORY_NAMES } from "@/lib/category-options";
import { validateUsername } from "@/lib/username";

const INTEREST_OPTIONS = [...CATEGORY_NAMES];

const PREFECTURES = [
  "未選択",
  "北海道",
  "青森県",
  "岩手県",
  "宮城県",
  "秋田県",
  "山形県",
  "福島県",
  "茨城県",
  "栃木県",
  "群馬県",
  "埼玉県",
  "千葉県",
  "東京都",
  "神奈川県",
  "新潟県",
  "富山県",
  "石川県",
  "福井県",
  "山梨県",
  "長野県",
  "岐阜県",
  "静岡県",
  "愛知県",
  "三重県",
  "滋賀県",
  "京都府",
  "大阪府",
  "兵庫県",
  "奈良県",
  "和歌山県",
  "鳥取県",
  "島根県",
  "岡山県",
  "広島県",
  "山口県",
  "徳島県",
  "香川県",
  "愛媛県",
  "高知県",
  "福岡県",
  "佐賀県",
  "長崎県",
  "熊本県",
  "大分県",
  "宮崎県",
  "鹿児島県",
  "沖縄県",
];

// ✅ PPバージョン（DB保存用）
const PP_CONSENT_VERSION = "2026-01-18_v1";
const SIGNUP_DRAFT_STORAGE_KEY = "knowvalue_signup_draft_v1";

type SignupDraft = {
  email: string;
  username: string;
  lastName: string;
  firstName: string;
  bio: string;
  website: string;
  prefecture: string;
  interests: string[];
  legalAgreed: boolean;
  ppAgreed: boolean;
};

function getInitialSignupDraft(): SignupDraft {
  if (typeof window === "undefined") {
    return {
      email: "",
      username: "",
      lastName: "",
      firstName: "",
      bio: "",
      website: "",
      prefecture: "未選択",
      interests: [],
      legalAgreed: false,
      ppAgreed: false,
    };
  }

  try {
    const rawDraft = window.sessionStorage.getItem(SIGNUP_DRAFT_STORAGE_KEY);
    if (!rawDraft) {
      throw new Error("no draft");
    }

    const draft = JSON.parse(rawDraft) as Partial<SignupDraft>;
    return {
      email: draft.email ?? "",
      username: draft.username ?? "",
      lastName: draft.lastName ?? "",
      firstName: draft.firstName ?? "",
      bio: draft.bio ?? "",
      website: draft.website ?? "",
      prefecture: draft.prefecture ?? "未選択",
      interests: Array.isArray(draft.interests) ? draft.interests : [],
      legalAgreed: Boolean(draft.legalAgreed),
      ppAgreed: Boolean(draft.ppAgreed),
    };
  } catch {
    return {
      email: "",
      username: "",
      lastName: "",
      firstName: "",
      bio: "",
      website: "",
      prefecture: "未選択",
      interests: [],
      legalAgreed: false,
      ppAgreed: false,
    };
  }
}

// ✅ PP本文（モーダル表示用）
const PRIVACY_POLICY_TEXT = `プライバシーポリシー（KnowValue）

KnowValue（以下「当サービス」）は、ユーザーの個人情報を適切に保護し、安心してご利用いただくため、以下のとおりプライバシーポリシーを定めます。ユーザーは、本ポリシーに同意のうえ当サービスを利用するものとします。

1. 取得する情報
当サービスは、以下の情報を取得することがあります。
- アカウント情報：メールアドレス、ユーザー名、プロフィール情報（自己紹介、地域、興味分野、プロフィール画像 等）
- 認証情報：ログイン状態の維持に必要な情報（セッション情報 等）
- 利用情報：閲覧履歴、操作履歴、投稿・回答・コメント等のコンテンツ情報、通知に関する情報
- 決済情報：決済の識別子や取引に関する情報（決済代行サービス経由で取得される情報）
  ※クレジットカード番号等は当サービスでは保持せず、決済代行サービスが取り扱います。
- 技術情報：IPアドレス、ブラウザ情報、OS、アクセス日時、Cookie 等
- お問い合わせ情報：問い合わせ内容、連絡先、対応履歴 等

2. 利用目的
当サービスは、取得した情報を以下の目的で利用します。
1) アカウント作成、本人確認、認証、ログイン等の提供
2) 当サービスの提供・維持・改善（品質向上、不具合修正、機能開発）
3) 質問・回答・交渉・コメント等の機能提供、表示、保護
4) 決済、取引管理、返金対応、購入履歴管理
5) 不正利用の検知・防止、セキュリティ確保
6) お問い合わせ対応、重要なお知らせ等の通知
7) 規約違反行為への対応、紛争解決
8) 統計データの作成（個人を特定できない形に加工した上での分析）

3. 第三者提供
当サービスは、次の場合を除き、ユーザーの個人情報を第三者に提供しません。
- ユーザーの同意がある場合
- 法令に基づく場合
- 人の生命・身体・財産の保護のために必要があり、同意取得が困難な場合
- 公衆衛生の向上または児童の健全育成の推進のために必要で、同意取得が困難な場合
- 国の機関等に協力する必要がある場合

4. 委託（外部サービスの利用）
当サービスは、サービス提供のために外部サービス（例：Supabase、Resend、Stripe 等）を利用することがあります。必要な範囲で情報が共有される場合があります。

5. Cookie等の利用
当サービスは、ログイン状態の維持、利便性向上、利用状況の分析等のため、Cookie等を使用する場合があります。

6. ユーザーの権利（開示・訂正・削除）
ユーザーは、当サービスが保有する自身の個人情報について、開示・訂正・削除等を求めることができます。

7. 安全管理措置
当サービスは、個人情報の漏えい・滅失・毀損等の防止のため、適切な安全管理措置を講じます。

8. 改定
当サービスは、必要に応じて本ポリシーを改定することがあります。

9. お問い合わせ先
support@knowvalue.jp
`;

export default function SignupPage() {
  const router = useRouter();
  const supabase = createClientBrowser();
  const initialDraft = useMemo(() => getInitialSignupDraft(), []);

  const [email, setEmail] = useState(initialDraft.email);
  const [password, setPassword] = useState("");
  const [username, setUsername] = useState(initialDraft.username);
  const [lastName, setLastName] = useState(initialDraft.lastName);
  const [firstName, setFirstName] = useState(initialDraft.firstName);

  const [bio, setBio] = useState(initialDraft.bio);
  const [website, setWebsite] = useState(initialDraft.website);
  const [prefecture, setPrefecture] = useState(initialDraft.prefecture);
  const [interests, setInterests] = useState<string[]>(initialDraft.interests);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState("");

  // ✅ PP同意
  const [ppAgreed, setPpAgreed] = useState(initialDraft.ppAgreed);
  const [ppOpen, setPpOpen] = useState(false);
  const [legalAgreed, setLegalAgreed] = useState(initialDraft.legalAgreed);
  const [loading, setLoading] = useState(false);
  const [signupCompletedEmail, setSignupCompletedEmail] = useState("");

  const signupDraft = useMemo(
    () => ({
      email,
      username,
      lastName,
      firstName,
      bio,
      website,
      prefecture,
      interests,
      legalAgreed,
      ppAgreed,
    }),
    [
      email,
      username,
      lastName,
      firstName,
      bio,
      website,
      prefecture,
      interests,
      legalAgreed,
      ppAgreed,
    ]
  );

  useEffect(() => {
    if (signupCompletedEmail) {
      return;
    }

    window.sessionStorage.setItem(
      SIGNUP_DRAFT_STORAGE_KEY,
      JSON.stringify(signupDraft)
    );
  }, [signupCompletedEmail, signupDraft]);

  // 画像選択
  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  // カテゴリーのチェック変更
  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((v) => v !== item) : [...prev, item]
    );
  };

  const handleSignup = async (e: React.FormEvent) => {
    e.preventDefault();
    if (loading) {
      return;
    }
    setErrorMsg("");
    setLoading(true);

    const usernameValidation = validateUsername(username);
    if (!usernameValidation.ok) {
      setErrorMsg(usernameValidation.message);
      setLoading(false);
      return;
    }
    
    if (!legalAgreed) {
      setErrorMsg("利用規約とプライバシーポリシーへの同意が必要です。");
      setLoading(false);
      return;
    }

    // ✅ PP同意必須
    if (!ppAgreed) {
      setErrorMsg("副業・税務に関する同意が必要です。");
      setLoading(false);
      return;
    }

    const usernameCheckRes = await fetch(
      `/api/user/username?username=${encodeURIComponent(usernameValidation.value)}`
    );
    const usernameCheckData = (await usernameCheckRes.json().catch(() => ({}))) as {
      available?: boolean;
      error?: string;
    };

    if (!usernameCheckRes.ok) {
      setErrorMsg(usernameCheckData.error || "ユーザー名の確認に失敗しました。");
      setLoading(false);
      return;
    }

    if (!usernameCheckData.available) {
      setErrorMsg("このユーザー名はすでに使用されています。");
      setLoading(false);
      return;
    }

    // 1) まずは画像をアップロード（任意）
    let avatarUrl: string | null = null;

    if (avatarFile) {
      const fileName = `${Date.now()}_${avatarFile.name}`;

      const { error: uploadError } = await supabase.storage
        .from("profiles")
        .upload(fileName, avatarFile, { upsert: true });

      if (uploadError) {
        setErrorMsg("画像アップロードに失敗しました");
        setLoading(false);
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("profiles")
        .getPublicUrl(fileName);

      avatarUrl = publicUrlData.publicUrl;
    }

    // 2) サインアップ（確認メール）
    const fullName = `${lastName} ${firstName}`;
    const redirectBase =
      process.env.NEXT_PUBLIC_SITE_URL || window.location.origin;

    const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${redirectBase}/auth/callback`,
        data: {
          full_name: fullName,
          username: usernameValidation.value,
          bio,
          website,
          prefecture,
          interests,
          avatar_url: avatarUrl,
          pp_consent_at: new Date().toISOString(),
          pp_consent_version: PP_CONSENT_VERSION,
        },
      },
    });

    if (signUpError) {
      setErrorMsg(signUpError.message);
      setLoading(false);
      return;
    }

    void signUpData;
    window.sessionStorage.removeItem(SIGNUP_DRAFT_STORAGE_KEY);
    setSignupCompletedEmail(email);
    setPassword("");
    setLoading(false);
  };

  if (signupCompletedEmail) {
    return (
      <div className="mx-auto mt-10 max-w-lg rounded-lg bg-white p-6 shadow">
        <h1 className="mb-4 text-2xl font-bold text-black">確認メールを送信しました</h1>
        <p className="text-sm leading-7 text-gray-700">
          <span className="font-semibold">{signupCompletedEmail}</span>
          に確認メールを送信しました。メール内のリンクから認証を完了してください。
        </p>
        <p className="mt-3 text-sm leading-7 text-gray-700">
          認証完了後にログインできます。メールが届かない場合は、迷惑メールフォルダも確認してください。
        </p>
        <div className="mt-6 flex flex-col gap-3 sm:flex-row">
          <Link
            href="/login"
            className="rounded bg-blue-600 px-4 py-2 text-center font-semibold text-white hover:bg-blue-700"
          >
            ログイン画面へ
          </Link>
          <button
            type="button"
            onClick={() => {
              setSignupCompletedEmail("");
              router.refresh();
            }}
            className="rounded border border-gray-300 px-4 py-2 text-sm text-gray-700 hover:bg-gray-50"
          >
            別のメールアドレスで登録する
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="max-w-lg mx-auto mt-10 bg-white shadow p-6 rounded-lg">
      <h1 className="text-2xl font-bold mb-6">新規登録</h1>

      <form onSubmit={handleSignup} className="space-y-6">
        {/* プロフィール画像 */}
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 mb-2">
            {avatarPreview ? (
              <img
                src={avatarPreview}
                className="w-full h-full object-cover"
                alt="プロフィール画像プレビュー"
              />
            ) : (
              <span className="text-gray-500 flex items-center justify-center h-full">
                No Image
              </span>
            )}
          </div>

          <label className="cursor-pointer px-3 py-2 bg-gray-100 text-sm rounded border">
            画像を選択
            <input
              type="file"
              className="hidden"
              accept="image/*"
              onChange={handleImageSelect}
            />
          </label>
        </div>

        {/* 姓 */}
        <div>
          <label className="block text-gray-700 mb-1">姓（本名）</label>
          <input
            className="w-full border p-2 rounded text-black"
            value={lastName}
            onChange={(e) => setLastName(e.target.value)}
            required
          />
        </div>

        {/* 名 */}
        <div>
          <label className="block text-gray-700 mb-1">名（本名）</label>
          <input
            className="w-full border p-2 rounded text-black"
            value={firstName}
            onChange={(e) => setFirstName(e.target.value)}
            required
          />
        </div>

        {/* ユーザー名 */}
        <div>
          <label className="block text-gray-700 mb-1">ユーザー名</label>
          <input
            className="w-full border p-2 rounded text-black"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            minLength={3}
            maxLength={20}
            required
          />
          <p className="mt-1 text-xs text-gray-500">
            3〜20文字で設定できます。日本語も使えます
          </p>
        </div>

        {/* メール */}
        <div>
          <label className="block text-gray-700 mb-1">メールアドレス</label>
          <input
            type="email"
            className="w-full border p-2 rounded text-black"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
          />
        </div>

        {/* パスワード */}
        <div>
          <label className="block text-gray-700 mb-1">パスワード</label>
          <input
            type="password"
            className="w-full border p-2 rounded text-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
          />
        </div>

        {/* 自己紹介 */}
        <div>
          <label className="block text-gray-700 mb-1">自己紹介（任意）</label>
          <textarea
            className="w-full border p-2 rounded text-black"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            placeholder="得意なことや、興味のある分野など"
          />
        </div>

        {/* 興味カテゴリー */}
        <div>
          <label className="block text-gray-700 mb-2">
            興味カテゴリー（複数選択）
          </label>

          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => toggleInterest(item)}
                className={`px-3 py-1 rounded-full border ${
                  interests.includes(item)
                    ? "bg-blue-600 text-white"
                    : "bg-gray-100 text-gray-700"
                }`}
              >
                {item}
              </button>
            ))}
          </div>
        </div>

        {/* SNS / URL */}
        <div>
          <label className="block text-gray-700 mb-1">SNS / Webサイト（任意）</label>
          <input
            className="w-full border p-2 rounded text-black"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
          />
        </div>

        {/* 地域 */}
        <div>
          <label className="block text-gray-700 mb-1">地域（任意）</label>
          <select
            className="w-full border p-2 rounded text-black"
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
          >
            {PREFECTURES.map((pref) => (
              <option key={pref} value={pref}>
                {pref}
              </option>
            ))}
          </select>
        </div>

        <div className="rounded border p-3 bg-gray-50">
          <div className="flex items-start gap-2">
            <input
              id="legal-consent"
              type="checkbox"
              className="mt-1"
              checked={legalAgreed}
              onChange={(e) => setLegalAgreed(e.target.checked)}
            />
            <label htmlFor="legal-consent" className="text-sm text-gray-700">
              <Link href="/terms" className="font-semibold text-blue-600 underline">
                利用規約
              </Link>
              <span> と </span>
              <Link href="/privacy" className="font-semibold text-blue-600 underline">
                プライバシーポリシー
              </Link>
              <span> に同意します（必須）</span>
            </label>
          </div>
        </div>

        {/* ✅ PP同意（必須） */}
        <div className="rounded border p-3 bg-gray-50">
          <div className="flex items-start gap-2">
            <input
              id="pp"
              type="checkbox"
              className="mt-1"
              checked={ppAgreed}
              onChange={(e) => setPpAgreed(e.target.checked)}
            />
            <label htmlFor="pp" className="text-sm text-gray-700">
              <span className="font-semibold">副業・税務に関する案内</span>に同意します（必須）
              <div className="text-xs text-gray-500 mt-1">
                同意日時・同意バージョンは保存されます（{PP_CONSENT_VERSION}）
              </div>
            </label>
          </div>

          <button
            type="button"
            onClick={() => setPpOpen(true)}
            className="mt-2 text-sm text-blue-600 underline"
          >
            副業・税務に関する案内全文を読む
          </button>
        </div>

        {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}

        <button
          type="submit"
          disabled={loading || !legalAgreed || !ppAgreed}
          className="w-full rounded bg-blue-600 py-2 font-semibold text-white disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "登録中..." : "登録する"}
        </button>
      </form>

      {/* ✅ PPモーダル */}
      {ppOpen && (
        <div className="fixed inset-0 z-50 flex items-center justify-center">
          <div
            className="absolute inset-0 bg-black/60"
            onClick={() => setPpOpen(false)}
          />
          <div className="relative z-10 w-[92vw] max-w-2xl max-h-[80vh] bg-white rounded-xl shadow-lg overflow-hidden">
            <div className="flex items-center justify-between px-4 py-3 border-b">
              <div className="font-bold">副業・税務に関する案内</div>
              <button
                type="button"
                onClick={() => setPpOpen(false)}
                className="px-3 py-1 rounded bg-gray-100 hover:bg-gray-200"
              >
                閉じる
              </button>
            </div>

            <div className="p-4 overflow-auto max-h-[70vh] whitespace-pre-wrap text-sm text-gray-800 leading-relaxed">
              {PRIVACY_POLICY_TEXT}
            </div>

            <div className="px-4 py-3 border-t bg-gray-50 flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setPpOpen(false)}
                className="px-4 py-2 rounded border hover:bg-gray-100"
              >
                閉じる
              </button>
              <button
                type="button"
                onClick={() => {
                  setPpAgreed(true);
                  setPpOpen(false);
                }}
                className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700"
              >
                同意して閉じる
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
