"use client";

import { Suspense, useMemo, useState } from "react";
import { useSearchParams } from "next/navigation";
import { resolveAuthRedirect } from "@/lib/auth-redirect";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { toJapaneseErrorMessage } from "@/lib/errors";

function LoginForm() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const searchParams = useSearchParams();

  const redirectTo = useMemo(() => {
    return resolveAuthRedirect([
      searchParams.get("redirectTo"),
      searchParams.get("callbackUrl"),
      searchParams.get("next"),
    ]);
  }, [searchParams]);

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setErrorMsg("");

    try {
      const supabase = supabaseBrowser();

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMsg(toJapaneseErrorMessage(error.message, "ログインに失敗しました"));
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (session?.access_token) {
        await fetch("/api/auth/login-notification", {
          method: "POST",
          headers: {
            Authorization: `Bearer ${session.access_token}`,
          },
        }).catch(() => {});
      }

      window.location.assign(redirectTo);
    } catch (err) {
      setErrorMsg(toJapaneseErrorMessage(err, "ログイン中にエラーが発生しました"));
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white shadow rounded">
      <h1 className="text-xl font-bold mb-4">ログイン</h1>

      <form onSubmit={handleLogin} className="space-y-4">
        <div>
          <label className="block mb-1 text-gray-700">メールアドレス</label>
          <input
            type="email"
            className="w-full p-2 border rounded text-black"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            required
            autoComplete="email"
          />
        </div>

        <div>
          <label className="block mb-1 text-gray-700">パスワード</label>
          <input
            type="password"
            className="w-full p-2 border rounded text-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            autoComplete="current-password"
          />
        </div>

        {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}

        <button
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>

        <div className="flex flex-col gap-2 text-sm text-center">
          <a
            href={`/signup?redirectTo=${encodeURIComponent(redirectTo)}`}
            className="text-blue-600 underline hover:text-blue-800"
          >
            新規登録はこちら
          </a>
          <a
            href="/forgot-password"
            className="text-blue-600 underline hover:text-blue-800"
          >
            パスワードを忘れた方はこちら
          </a>
        </div>
      </form>
    </div>
  );
}

export default function LoginPage() {
  return (
    <Suspense fallback={null}>
      <LoginForm />
    </Suspense>
  );
}
