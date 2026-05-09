// app/mypage/edit/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClientBrowser } from "@/lib/supabase-browser";
import { CATEGORY_NAMES } from "@/lib/category-options";
import {
  AGE_GROUP_OPTIONS,
  GENDER_OPTIONS,
  isAgeGroup,
  isGender,
} from "@/lib/profile-demographics";
import { validateUsername } from "@/lib/username";

const INTEREST_OPTIONS = [...CATEGORY_NAMES];

const PREFECTURES = [
  "未選択",
  "北海道","青森県","岩手県","宮城県","秋田県","山形県","福島県",
  "茨城県","栃木県","群馬県","埼玉県","千葉県","東京都","神奈川県",
  "新潟県","富山県","石川県","福井県","山梨県","長野県","岐阜県",
  "静岡県","愛知県","三重県","滋賀県","京都府","大阪府","兵庫県",
  "奈良県","和歌山県","鳥取県","島根県","岡山県","広島県","山口県",
  "徳島県","香川県","愛媛県","高知県","福岡県","佐賀県","長崎県",
  "熊本県","大分県","宮崎県","鹿児島県","沖縄県",
];

type Meta = {
  full_name?: string;
  username?: string;
  age_group?: string;
  gender?: string;
  bio?: string;
  website?: string;
  prefecture?: string;
  interests?: string[];
  avatar_url?: string;
};

export default function MyPageEdit() {
  const router = useRouter();
  const supabase = useMemo(() => createClientBrowser(), []);

  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  const [email, setEmail] = useState<string>(""); // 表示のみ（編集は次STEP）
  const [fullName, setFullName] = useState("");
  const [username, setUsername] = useState("");
  const [ageGroup, setAgeGroup] = useState("回答しない");
  const [gender, setGender] = useState("回答しない");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [prefecture, setPrefecture] = useState("未選択");
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");

  const [newEmail, setNewEmail] = useState("");
  const [emailMsg, setEmailMsg] = useState("");

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      setErrorMsg("");
      setOkMsg("");

      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/login?redirectTo=/mypage/edit");
        return;
      }

      const user = data.user;
      setEmail(user.email ?? "");

      const meta = (user.user_metadata ?? {}) as Meta;

      setFullName(meta.full_name ?? "");
      setUsername(meta.username ?? "");
      setAgeGroup(isAgeGroup(meta.age_group) ? meta.age_group : "回答しない");
      setGender(isGender(meta.gender) ? meta.gender : "回答しない");
      setBio(meta.bio ?? "");
      setWebsite(meta.website ?? "");
      setPrefecture(meta.prefecture ?? "未選択");
      setInterests(Array.isArray(meta.interests) ? meta.interests : []);
      setAvatarUrl(meta.avatar_url ?? null);
      setAvatarPreview(meta.avatar_url ?? null);

      setLoading(false);
    };

    load();
  }, [router, supabase]);

  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((v) => v !== item) : [...prev, item]
    );
  };

  const onPickAvatar = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0] ?? null;
    if (!file) return;
    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const save = async () => {
    setSaving(true);
    setErrorMsg("");
    setOkMsg("");

    try {
      const usernameValidation = validateUsername(username);
      if (!usernameValidation.ok) {
        setErrorMsg(usernameValidation.message);
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
        return;
      }

      if (!usernameCheckData.available) {
        setErrorMsg("このユーザー名はすでに使用されています。");
        return;
      }

      // 1) ログイン確認
      const { data, error } = await supabase.auth.getUser();
      if (error || !data.user) {
        router.push("/login?redirectTo=/mypage/edit");
        return;
      }

      const user = data.user;

      // 2) 画像アップロード（選択時のみ）
      let newAvatarUrl = avatarUrl;

      if (avatarFile) {
        const fileName = `${user.id}/${Date.now()}_${avatarFile.name}`;

        const { error: uploadError } = await supabase.storage
          .from("profiles")
          .upload(fileName, avatarFile, { upsert: true });

        if (uploadError) {
          setErrorMsg("画像アップロードに失敗しました: " + uploadError.message);
          return;
        }

        const { data: publicUrlData } = supabase.storage
          .from("profiles")
          .getPublicUrl(fileName);

        newAvatarUrl = publicUrlData.publicUrl;
      }

      // 3) user_metadata 更新（ここが本命）
      const { error: updateError } = await supabase.auth.updateUser({
        data: {
          full_name: fullName,
          username: usernameValidation.value,
          age_group: ageGroup,
          gender,
          bio,
          website,
          prefecture,
          interests,
          avatar_url: newAvatarUrl,
        },
      });

      if (updateError) {
        setErrorMsg("保存に失敗しました: " + updateError.message);
        return;
      }

      const syncRes = await fetch("/api/user/sync", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          id: user.id,
          email: user.email,
          username: usernameValidation.value,
          name: fullName,
          ageGroup,
          gender,
          interests,
        }),
      });

      if (!syncRes.ok) {
        const syncData = (await syncRes.json().catch(() => ({}))) as {
          error?: string;
        };
        setErrorMsg(syncData.error || "ユーザー情報の同期に失敗しました。");
        return;
      }

      setAvatarUrl(newAvatarUrl ?? null);
      setAvatarFile(null);
      router.push("/mypage?updated=1");
      router.refresh();
      return;
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return (
      <div className="mx-auto mt-10 max-w-3xl rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        読み込み中...
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl text-black">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-3xl font-bold tracking-tight">プロフィール編集</h1>
          <p className="mt-2 text-sm text-gray-600">
            表示名、自己紹介、興味カテゴリなどを更新できます。
          </p>
        </div>
        <Link href="/mypage" className="text-sm text-blue-600 underline">
          ← マイページへ戻る
        </Link>
      </div>

      <div className="space-y-6 rounded-2xl border border-gray-200 bg-white p-6 shadow-sm">
        {/* 画像 */}
        <div>
          <div className="flex items-center gap-4">
            <div className="w-20 h-20 rounded-full overflow-hidden bg-gray-200">
              {avatarPreview ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img src={avatarPreview} className="w-full h-full object-cover" alt="avatar" />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-gray-500 text-sm">
                  No Image
                </div>
              )}
            </div>

            <label className="cursor-pointer rounded-xl border bg-gray-100 px-3 py-2 text-sm">
              画像を選択
              <input type="file" className="hidden" accept="image/*" onChange={onPickAvatar} />
            </label>
          </div>
          <p className="text-xs text-gray-500 mt-2">
            ※ 画像は Storage（profiles）にアップロードされます
          </p>
        </div>

        {/* メール（表示のみ） */}
        <div>
          <label className="block text-sm font-semibold mb-1">メールアドレス（表示のみ）</label>
          <input
            value={email}
            disabled
            className="w-full rounded-xl border bg-gray-100 p-2 text-gray-600"
          />
          <p className="text-xs text-gray-500 mt-1">
            ※ メール変更（再認証あり）は次STEPで実装する
          </p>
        </div>

        {/* フルネーム */}
        <div>
          <label className="block text-sm font-semibold mb-1">表示名（フルネーム）</label>
          <input
            value={fullName}
            onChange={(e) => setFullName(e.target.value)}
            className="w-full rounded-xl border p-2"
            placeholder="例）川田 祐也"
          />
        </div>

        {/* ユーザー名 */}
        <div>
          <label className="block text-sm font-semibold mb-1">ユーザー名</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full rounded-xl border p-2"
            placeholder="例）yuya0707"
            minLength={3}
            maxLength={20}
          />
          <p className="mt-1 text-xs text-gray-500">
            3〜20文字で設定できます。日本語も使えます
          </p>
        </div>

        {/* 年代 */}
        <div>
          <label className="block text-sm font-semibold mb-1">年代（任意）</label>
          <select
            value={ageGroup}
            onChange={(e) => setAgeGroup(e.target.value)}
            className="w-full rounded-xl border p-2"
          >
            {AGE_GROUP_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* 性別 */}
        <div>
          <label className="block text-sm font-semibold mb-1">性別（任意）</label>
          <select
            value={gender}
            onChange={(e) => setGender(e.target.value)}
            className="w-full rounded-xl border p-2"
          >
            {GENDER_OPTIONS.map((option) => (
              <option key={option} value={option}>
                {option}
              </option>
            ))}
          </select>
        </div>

        {/* 自己紹介 */}
        <div>
          <label className="block text-sm font-semibold mb-1">自己紹介</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full rounded-xl border p-2"
            rows={4}
            placeholder="得意分野や実績など"
          />
        </div>

        {/* 興味 */}
        <div>
          <label className="block text-sm font-semibold mb-2">興味カテゴリー（複数選択）</label>
          <div className="flex flex-wrap gap-2">
            {INTEREST_OPTIONS.map((item) => (
              <button
                key={item}
                type="button"
                onClick={() => toggleInterest(item)}
                className={`rounded-full border px-3 py-1 text-sm ${
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

        {/* Web */}
        <div>
          <label className="block text-sm font-semibold mb-1">SNS / Webサイト</label>
          <input
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            className="w-full rounded-xl border p-2"
            placeholder="https://"
          />
        </div>

        {/* 地域 */}
        <div>
          <label className="block text-sm font-semibold mb-1">地域</label>
          <select
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            className="w-full rounded-xl border p-2"
          >
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {/* ===== メールアドレス変更 ===== */}
        <div className="border-t pt-6">
          <h2 className="text-lg font-semibold mb-3">メールアドレス変更</h2>

          <p className="text-sm text-gray-600 mb-2">
            新しいメールアドレスを入力すると、確認メールが送信されます。
            確認完了後にメールアドレスが更新されます。
          </p>

          <input
            type="email"
            value={newEmail}
            onChange={(e) => setNewEmail(e.target.value)}
            className="mb-2 w-full rounded-xl border p-2"
            placeholder="new-email@example.com"
          />

          <button
            type="button"
            onClick={async () => {
              setEmailMsg("");
              if (!newEmail) {
                setEmailMsg("新しいメールアドレスを入力してください。");
                return;
              }
            
              const { error } = await supabase.auth.updateUser({
                email: newEmail,
              });
            
              if (error) {
                setEmailMsg("メール変更に失敗しました: " + error.message);
                return;
              }
            
              setEmailMsg(
                "確認メールを送信しました。新しいメールアドレスをご確認ください。"
              );
              setNewEmail("");
            }}
            className="rounded-xl bg-gray-800 px-4 py-2 text-white hover:bg-black"
          >
            確認メールを送信
          </button>
          
          {emailMsg && <p className="text-sm mt-2 text-blue-700">{emailMsg}</p>}
        </div>

        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        {okMsg && <p className="text-sm text-green-700">{okMsg}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full rounded-xl bg-blue-700 py-2 font-semibold text-white hover:bg-blue-900 disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存する"}
        </button>
      </div>
    </div>
  );
}
