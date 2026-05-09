import Link from "next/link";
import { resolveAuthRedirect } from "@/lib/auth-redirect";

export default async function AuthVerifiedPage({
  searchParams,
}: {
  searchParams?: Promise<{ [key: string]: string | string[] | undefined }>;
}) {
  const sp = searchParams ? await searchParams : undefined;
  const redirectTo = resolveAuthRedirect([
    Array.isArray(sp?.redirectTo) ? sp?.redirectTo[0] : sp?.redirectTo,
  ]);

  return (
    <div className="mx-auto mt-16 max-w-lg rounded-2xl border border-gray-200 bg-white p-8 text-center shadow-sm">
      <h1 className="text-2xl font-bold text-gray-950">メール認証が完了しました</h1>
      <p className="mt-4 text-sm leading-7 text-gray-700">
        KnowValueへの登録ありがとうございます。
        <br />
        ログインして質問・回答を始めましょう。
      </p>
      <div className="mt-8">
        <Link
          href={`/login?redirectTo=${encodeURIComponent(redirectTo)}`}
          className="inline-flex rounded-xl bg-blue-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-blue-700"
        >
          ログインする
        </Link>
      </div>
    </div>
  );
}
