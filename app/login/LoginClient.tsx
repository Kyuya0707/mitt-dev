"use client";

import { useState } from "react";
import { createClientBrowser } from "@/lib/supabase-browser";

export default function LoginClient({ redirectTo }: { redirectTo: string }) {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMsg, setErrorMsg] = useState("");
  const supabase = createClientBrowser();

  const handleLogin = async (e: React.FormEvent) => {
    e.preventDefault();

    const { error } = await supabase.auth.signInWithPassword({
      email,
      password,
    });

    if (error) {
      setErrorMsg(error.message);
    } else {
      window.location.href = redirectTo;
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
          />
        </div>

        {errorMsg && <p className="text-red-600 text-sm">{errorMsg}</p>}

        <button className="w-full bg-blue-600 text-white py-2 rounded hover:bg-blue-700">
          ログイン
        </button>

      </form>
    </div>
  );
}
