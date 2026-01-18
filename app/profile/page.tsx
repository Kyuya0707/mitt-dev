"use client";

import { useEffect, useState } from "react";
import { createClientBrowser } from "@/lib/supabase-browser";
import { useRouter } from "next/navigation";

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

// 🆕 日本語・長いファイル名に対応した安全ファイル名生成関数
function generateSafeFileName(original: string) {
  const ext = original.split(".").pop();
  const randomStr = Math.random().toString(36).slice(2, 10);
  const timestamp = Date.now();

  const safe = original
    .replace(/[^a-zA-Z0-9.-]/g, "_") // 日本語・記号を変換
    .slice(0, 20); // 長すぎるファイル名を20文字に制限

  return `${timestamp}_${randomStr}_${safe}.${ext}`;
}

export default function ProfilePage() {
  const supabase = createClientBrowser();
  const router = useRouter();

  const [loading, setLoading] = useState(true);

  const [username, setUsername] = useState("");
  const [bio, setBio] = useState("");
  const [website, setWebsite] = useState("");
  const [prefecture, setPrefecture] = useState("未選択");
  const [interests, setInterests] = useState<string[]>([]);
  const [avatarPreview, setAvatarPreview] = useState<string | null>(null);
  const [avatarFile, setAvatarFile] = useState<File | null>(null);

  const [errorMsg, setErrorMsg] = useState("");
  const [successMsg, setSuccessMsg] = useState("");

  // 現在のユーザーデータを取得
  useEffect(() => {

    const fetchProfile = async () => {
      const {
        data: { user },
        error,
      } = await supabase.auth.getUser();

      if (!user || error) {
        router.push("/login");
        return;
      }

      const meta = user.user_metadata;

      setUsername(meta.username ?? "");
      setBio(meta.bio ?? "");
      setWebsite(meta.website ?? "");
      setPrefecture(meta.prefecture ?? "未選択");
      setInterests(meta.interests ?? []);
      setAvatarPreview(meta.avatar_url ?? null);

      setLoading(false);
    };

    fetchProfile();
  }, []);

  // 興味カテゴリー切り替え
  const toggleInterest = (item: string) => {
    setInterests((prev) =>
      prev.includes(item) ? prev.filter((v) => v !== item) : [...prev, item]
    );
  };

  // プロフィール画像選択
  const handleImageSelect = (e: any) => {
    const file = e.target.files?.[0];
    if (!file) return;

    setAvatarFile(file);
    setAvatarPreview(URL.createObjectURL(file));
  };

  const handleUpdate = async (e: React.FormEvent) => {
    e.preventDefault();
    setErrorMsg("");
    setSuccessMsg("");

    let newAvatarUrl = avatarPreview;

    // ①画像アップロード（新しい画像が選ばれている場合）
    if (avatarFile) {
      const safeFileName = generateSafeFileName(avatarFile.name);

      const { error: uploadError } = await supabase.storage
        .from("profiles")
        .upload(safeFileName, avatarFile, {
          upsert: true,
          contentType: avatarFile.type,
        });

      if (uploadError) {
        console.log(uploadError);
        setErrorMsg("画像アップロードに失敗しました");
        return;
      }

      const { data: publicUrlData } = supabase.storage
        .from("profiles")
        .getPublicUrl(safeFileName);

      newAvatarUrl = publicUrlData.publicUrl;
    }

    // ② Supabase user_metadata 更新
    const { error } = await supabase.auth.updateUser({
      data: {
        username,
        bio,
        website,
        prefecture,
        interests,
        avatar_url: newAvatarUrl,
      },
    });

    if (error) {
      setErrorMsg(error.message);
      return;
    }

    // ③ 最新ユーザー情報を再取得して画面へ反映
    const {
      data: { user: refreshedUser },
    } = await supabase.auth.getUser();

    if (refreshedUser) {
      const meta = refreshedUser.user_metadata;
      setUsername(meta.username ?? "");
      setBio(meta.bio ?? "");
      setWebsite(meta.website ?? "");
      setPrefecture(meta.prefecture ?? "未選択");
      setInterests(meta.interests ?? []);
      setAvatarPreview(meta.avatar_url ?? null);
    }

    setSuccessMsg("プロフィールを更新しました！");
  };

  if (loading) return <p className="text-center mt-10">読み込み中...</p>;

  return (
    <div className="max-w-lg mx-auto mt-10 bg-white shadow p-6 rounded-lg">
      <h1 className="text-2xl font-bold mb-6">プロフィール編集</h1>

      <form onSubmit={handleUpdate} className="space-y-6">
        {/* プロフィール画像 */}
        <div className="flex flex-col items-center">
          <div className="w-24 h-24 rounded-full overflow-hidden bg-gray-200 mb-2">
            {avatarPreview ? (
              <img src={avatarPreview} className="w-full h-full object-cover" />
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

        {/* ユーザー名 */}
        <div>
          <label className="block text-gray-700 mb-1">ユーザー名</label>
          <input
            className="w-full border p-2 rounded text-black"
            value={username}
            onChange={(e) => setUsername(e.target.value)}
            required
          />
        </div>

        {/* 自己紹介 */}
        <div>
          <label className="block text-gray-700 mb-1">自己紹介</label>
          <textarea
            className="w-full border p-2 rounded text-black"
            rows={3}
            value={bio}
            onChange={(e) => setBio(e.target.value)}
          />
        </div>

        {/* 興味カテゴリー */}
        <div>
          <label className="block text-gray-700 mb-2">興味カテゴリー</label>

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
          <label className="block text-gray-700 mb-1">SNS / Webサイト</label>
          <input
            className="w-full border p-2 rounded text-black"
            value={website}
            onChange={(e) => setWebsite(e.target.value)}
            placeholder="https://"
          />
        </div>

        {/* 地域 */}
        <div>
          <label className="block text-gray-700 mb-1">地域</label>
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

        {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}
        {successMsg && <p className="text-green-600 text-sm">{successMsg}</p>}

        <button className="w-full bg-blue-600 text-white py-2 rounded font-semibold">
          更新する
        </button>
      </form>
    </div>
  );
}
