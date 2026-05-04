"use client";

import { NotificationProvider } from "./context/NotificationContext";

export default function Providers({ children }: { children: React.ReactNode }) {
  return <NotificationProvider>{children}</NotificationProvider>;
}
