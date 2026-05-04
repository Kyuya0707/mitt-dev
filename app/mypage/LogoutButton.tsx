"use client";

import { useState } from "react";
import { createClientBrowser } from "@/lib/supabase-browser";

export default function LogoutButton() {
  const [loading, setLoading] = useState(false);

  const handleLogout = async () => {
    if (loading) return;

    setLoading(true);

    try {
      const supabase = createClientBrowser();
      await supabase.auth.signOut();
      window.location.assign("/login");
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleLogout}
      disabled={loading}
      className="inline-flex items-center rounded-lg bg-red-600 px-4 py-2 text-sm font-medium text-white transition hover:bg-red-700 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? "ログアウト中..." : "ログアウト"}
    </button>
  );
}
