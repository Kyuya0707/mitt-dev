// app/context/NotificationContext.tsx
"use client";

import { createContext, useContext, useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";

type NotificationContextType = {
  count: number;
  refresh: () => Promise<void>;
};

const NotificationContext = createContext<NotificationContextType | null>(null);

export function NotificationProvider({ children }: { children: React.ReactNode }) {
  const [count, setCount] = useState(0);

  const refresh = async () => {
    try {
      const res = await fetch("/api/unread-count", { cache: "no-store" });
      const data = await res.json();
      setCount(data.count ?? 0);
    } catch (err) {
      console.error("❌ fetch unread-count failed:", err);
    }
  };

  useEffect(() => {
    // 初回
    refresh();

    // ログイン/ログアウトで即更新
    const supabase = supabaseBrowser();
    const { data: listener } = supabase.auth.onAuthStateChange(() => {
      refresh();
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  return (
    <NotificationContext.Provider value={{ count, refresh }}>
      {children}
    </NotificationContext.Provider>
  );
}

export function useNotifications() {
  const ctx = useContext(NotificationContext);
  if (!ctx) throw new Error("useNotifications must be inside NotificationProvider");
  return ctx;
}
