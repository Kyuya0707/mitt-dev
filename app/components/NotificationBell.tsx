"use client";

import Link from "next/link";
import { useNotifications } from "@/app/context/NotificationContext";

export default function NotificationBell() {
  const { count } = useNotifications();

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
