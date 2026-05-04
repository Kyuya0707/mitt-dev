"use client";

import Link from "next/link";
import { useState } from "react";
import { createClientBrowser } from "@/lib/supabase-browser";

export default function ForgotPasswordPage() {
  const supabase = createClientBrowser();
  const [email, setEmail] = useState("");
  const [message, setMessage] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    setMessage("");
    setErrorMsg("");

    try {
      const redirectTo =
        `${window.location.origin}/reset-password`;

      const { error } = await supabase.auth.resetPasswordForEmail(email, {
        redirectTo,
      });

      if (error) {
        setErrorMsg(error.message);
        return;
      }

      setMessage("パスワード再設定メールを送信しました。メールをご確認ください。");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="max-w-md mx-auto mt-20 p-6 bg-white shadow rounded">
      <h1 className="text-xl font-bold mb-4">パスワード再発行</h1>
      <p className="text-sm text-gray-600 mb-4">
        登録メールアドレスを入力すると、再設定用のメールを送信します。
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
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

        {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}
        {message && <p className="text-green-700 text-sm">{message}</p>}

        <button
          type="submit"
          disabled={loading}
          className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700 disabled:opacity-60"
        >
          {loading ? "送信中..." : "再設定メールを送信"}
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
