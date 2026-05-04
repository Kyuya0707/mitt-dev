"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase-browser";
import { useNotifications } from "@/app/context/NotificationContext";

export default function NotificationBell() {
  const { count } = useNotifications();
  const [isLoggedIn, setIsLoggedIn] = useState(false);

  useEffect(() => {
    const supabase = supabaseBrowser();

    supabase.auth.getUser().then(({ data }) => {
      setIsLoggedIn(!!data.user);
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      setIsLoggedIn(!!session?.user);
    });

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  if (!isLoggedIn) {
    return null;
  }

  return (
    <Link href="/notifications" className="relative">
      <span className="text-xl">🔔</span>
      {count > 0 && (
        <span className="absolute -top-1 -right-2 bg-red-500 text-white text-xs rounded-full px-1.5 py-0.5">
          {count}
        </span>
      )}
    </Link>
  );
}
