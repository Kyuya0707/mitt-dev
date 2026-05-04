"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { createClientBrowser } from "@/lib/supabase-browser";

export default function ResetPasswordPage() {
  const supabase = createClientBrowser();
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    const initialize = async () => {
      await supabase.auth.getSession();
      setReady(true);
    };

    void initialize();
  }, [supabase]);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setErrorMsg("");

    try {
      if (password.length < 6) {
        setErrorMsg("パスワードは6文字以上で入力してください。");
        return;
      }

      if (password !== confirmPassword) {
        setErrorMsg("確認用パスワードが一致しません。");
        return;
      }

      const { error } = await supabase.auth.updateUser({
        password,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setMessage("パスワードを更新しました。ログインし直してください。");
      setPassword("");
      setConfirmPassword("");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white shadow rounded">
      <h1 className="text-xl font-bold mb-4">新しいパスワードを設定</h1>
      <p className="text-sm text-gray-600 mb-4">
        メールのリンクから開いたあと、新しいパスワードを設定してください。
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="block mb-1 text-gray-700">新しいパスワード</label>
          <input
            type="password"
            className="w-full p-2 border rounded text-black"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            disabled={!ready}
          />
        </div>

        <div>
          <label className="block mb-1 text-gray-700">新しいパスワード（確認）</label>
          <input
            type="password"
            className="w-full p-2 border rounded text-black"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            required
            minLength={6}
            autoComplete="new-password"
            disabled={!ready}
          />
        </div>

        {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}
        {message && <p className="text-green-700 text-sm">{message}</p>}

        <button
          type="submit"
          disabled={loading || !ready}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "更新中..." : "パスワードを更新"}
        </button>
      </form>

      <div className="mt-4 text-sm text-center">
        <Link href="/login" className="text-blue-600 underline hover:text-blue-800">
          ログイン画面へ戻る
        </Link>
      </div>
    </div>
  );
}
