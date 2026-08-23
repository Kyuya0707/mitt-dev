"use client";

import { useState } from "react";
import { createClientBrowser } from "@/lib/supabase-browser";
import { trackGA4SignUp } from "@/lib/ga";
import {
  isPasswordValid,
  MIN_PASSWORD_LENGTH,
  PASSWORD_REQUIREMENTS_TEXT,
} from "@/lib/password-policy";

export default function SignupPage() {
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [message, setMessage] = useState("");
  const supabase = createClientBrowser();

  const handleSignup = async () => {
    if (!isPasswordValid(password)) {
      setMessage(`パスワードは${PASSWORD_REQUIREMENTS_TEXT}`);
      return;
    }

    const { error } = await supabase.auth.signUp({
      email,
      password,
    });

    if (error) {
      setMessage("登録に失敗しました: " + error.message);
    } else {
      trackGA4SignUp();
      setMessage("確認メールを送信しました！");
    }
  };

  return (
    <div className="max-w-md mx-auto p-6">
      <h1 className="text-2xl font-bold mb-4">新規登録</h1>

      <input
        type="email"
        className="w-full border rounded p-2 mb-3"
        placeholder="メールアドレス"
        value={email}
        onChange={(e) => setEmail(e.target.value)}
      />

      <input
        type="password"
        className="w-full border rounded p-2 mb-3"
        placeholder="パスワード"
        value={password}
        onChange={(e) => setPassword(e.target.value)}
        minLength={MIN_PASSWORD_LENGTH}
        autoComplete="new-password"
      />

      <p className="mb-3 text-xs text-gray-600">{PASSWORD_REQUIREMENTS_TEXT}</p>

      <button
        onClick={handleSignup}
        className="w-full bg-blue-600 text-white p-2 rounded"
      >
        登録する
      </button>

      {message && <p className="mt-4 text-sm text-gray-700">{message}</p>}
    </div>
  );
}
