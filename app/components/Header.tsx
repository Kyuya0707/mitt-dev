"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import type { User } from "@supabase/supabase-js";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useNotifications } from "@/app/context/NotificationContext";

export default function Header() {
  const { count } = useNotifications(); // ← 未読数はここだけを使う！
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();

    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        return;
      }
      setUser(data.user ?? null);
    };

    fetchUser();

    // 🔄 セッション変化監視
    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        const currentUser = session?.user ?? null;
        setUser(currentUser);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    if (confirm("ログアウトしますか？")) {
      const supabase = supabaseBrowser();
      await supabase.auth.signOut();
      window.location.href = "/";
    }
  };

  return (
    <header className="bg-white shadow-sm border-b">
      <div className="max-w-4xl mx-auto flex justify-between items-center p-4">
        <Link href="/" className="text-lg font-bold text-blue-600">
          Know Value
        </Link>

        <div className="flex items-center gap-6">

          {/* 🔔 通知アイコン */}
          {user && (
            <Link href="/notifications" className="relative">
              🔔
              {count > 0 && (
                <span
                  className="
                    absolute -top-1 -right-2
                    bg-red-500 text-white text-xs
                    px-1.5 py-0.5 rounded-full
                  "
                >
                  {count}
                </span>
              )}
            </Link>
          )}

          {/* ユーザー名 / ログイン */}
          {user ? (
            <>
              <span className="text-sm text-gray-700">
                👤 {user?.user_metadata?.username ?? user.email}
              </span>
              <button
                onClick={handleLogout}
                className="text-sm text-red-600 underline"
              >
                ログアウト
              </button>
            </>
          ) : (
            <Link href="/login" className="text-sm text-blue-600 underline">
              ログイン
            </Link>
          )}
        </div>
      </div>
    </header>
  );
}
