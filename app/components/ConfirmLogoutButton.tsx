"use client";

import { supabaseBrowser } from "@/lib/supabase-browser";

export default function ConfirmLogoutButton() {
  const supabase = supabaseBrowser();

  const handleLogout = async () => {
    if (confirm("ログアウトしますか？")) {
      await supabase.auth.signOut();
      window.location.href = "/";
    }
  };

  return (
    <button
      onClick={handleLogout}
      className="text-sm text-red-600 underline hover:text-red-800"
    >
      ログアウト
    </button>
  );
}
