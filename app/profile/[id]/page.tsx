// app/profile/[id]/page.tsx

import { createClientBrowser } from "@/lib/supabase-browser";
import { cookies } from "next/headers";

export default async function UserProfilePage({
  params,
}: {
  params: { id: string };
}) {
  // ★ async Cookie API を await する
  const cookieStore = await cookies();
  const supabase = createClientBrowser();

  const { data, error } = await supabase.auth.admin.getUserById(params.id);

  if (error || !data?.user) {
    return (
      <div className="text-center mt-20">
        ユーザーが見つかりません。
      </div>
    );
  }

  const meta = data.user.user_metadata;

  return (
    <div className="max-w-xl mx-auto mt-10 bg-white shadow p-6 rounded-lg">

      {/* アイコン */}
      <div className="flex justify-center mb-4">
        <div className="w-28 h-28 rounded-full overflow-hidden bg-gray-200">
          {meta.avatar_url ? (
            <img
              src={meta.avatar_url}
              className="w-full h-full object-cover"
            />
          ) : (
            <div className="flex items-center justify-center h-full text-gray-500">
              No Image
            </div>
          )}
        </div>
      </div>

      {/* ユーザー名 */}
      <h1 className="text-2xl font-bold text-center mb-2">{meta.username}</h1>

      {meta.prefecture && meta.prefecture !== "未選択" && (
        <p className="text-center text-gray-600 mb-4">{meta.prefecture}</p>
      )}

      {/* 自己紹介 */}
      {meta.bio && (
        <div className="mb-4">
          <h2 className="font-semibold mb-1">自己紹介</h2>
          <p className="text-gray-700 whitespace-pre-line">{meta.bio}</p>
        </div>
      )}

      {/* 興味カテゴリー */}
      {meta.interests && meta.interests.length > 0 && (
        <div className="mb-4">
          <h2 className="font-semibold mb-2">興味カテゴリー</h2>
          <div className="flex flex-wrap gap-2">
            {meta.interests.map((item: string) => (
              <span
                key={item}
                className="px-3 py-1 bg-blue-600 text-white rounded-full text-sm"
              >
                {item}
              </span>
            ))}
          </div>
        </div>
      )}

      {/* SNS / Webサイト */}
      {meta.website && (
        <div className="mt-4">
          <h2 className="font-semibold mb-1">SNS / Webサイト</h2>
          <a
            href={meta.website}
            target="_blank"
            className="text-blue-600 underline break-all"
          >
            {meta.website}
          </a>
        </div>
      )}
    </div>
  );
}
