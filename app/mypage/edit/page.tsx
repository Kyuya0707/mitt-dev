// app/mypage/edit/page.tsx
"use client";

import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClientBrowser } from "@/lib/supabase-browser";

const INTEREST_OPTIONS = [
  "車・バイク",
  "恋愛",
  "投資・お金",
  "健康・ダイエット",
  "仕事・キャリア",
  "プログラミング",
  "ガジェット",
  "美容",
];

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
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [prefecture, setPrefecture] = useState("未選択");
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarUrl, setAvatarUrl] = useState<string | null>(null);

  const [avatarFile, setAvatarFile] = useState<File | null>(null);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [okMsg, setOkMsg] = useState("");

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
          username,
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

      setAvatarUrl(newAvatarUrl ?? null);
      setAvatarFile(null);

      setOkMsg("保存しました！");
      // マイページへ戻してもOK（好み）
      // router.push("/mypage");
    } finally {
      setSaving(false);
    }
  };

  if (loading) {
    return <div className="max-w-2xl mx-auto p-6 mt-10">読み込み中...</div>;
  }

  return (
    <div className="max-w-2xl mx-auto p-6 mt-10 text-black">
      <div className="flex items-center justify-between mb-6">
        <h1 className="text-2xl font-bold">プロフィール編集</h1>
        <Link href="/mypage" className="text-sm text-blue-600 underline">
          ← マイページへ戻る
        </Link>
      </div>

      <div className="bg-white border rounded shadow p-6 space-y-6">
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

            <label className="cursor-pointer px-3 py-2 bg-gray-100 text-sm rounded border">
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
            className="w-full border p-2 rounded bg-gray-100 text-gray-600"
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
            className="w-full border p-2 rounded"
            placeholder="例）川田 祐也"
          />
        </div>

        {/* ユーザー名 */}
        <div>
          <label className="block text-sm font-semibold mb-1">ユーザー名</label>
          <input
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            className="w-full border p-2 rounded"
            placeholder="例）yuya0707"
          />
        </div>

        {/* 自己紹介 */}
        <div>
          <label className="block text-sm font-semibold mb-1">自己紹介</label>
          <textarea
            value={bio}
            onChange={(e) => setBio(e.target.value)}
            className="w-full border p-2 rounded"
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
                className={`px-3 py-1 rounded-full border text-sm ${
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
            className="w-full border p-2 rounded"
            placeholder="https://"
          />
        </div>

        {/* 地域 */}
        <div>
          <label className="block text-sm font-semibold mb-1">地域</label>
          <select
            value={prefecture}
            onChange={(e) => setPrefecture(e.target.value)}
            className="w-full border p-2 rounded"
          >
            {PREFECTURES.map((p) => (
              <option key={p} value={p}>
                {p}
              </option>
            ))}
          </select>
        </div>

        {errorMsg && <p className="text-sm text-red-600">{errorMsg}</p>}
        {okMsg && <p className="text-sm text-green-700">{okMsg}</p>}

        <button
          onClick={save}
          disabled={saving}
          className="w-full bg-blue-700 text-white py-2 rounded font-semibold hover:bg-blue-900 disabled:opacity-50"
        >
          {saving ? "保存中..." : "保存する"}
        </button>
      </div>
    </div>
  );
}