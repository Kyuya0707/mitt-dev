// app/(welcome)/layout.tsx
import type { ReactNode } from "react";

export default function WelcomeLayout({ children }: { children: ReactNode }) {
  return (
    <div className="min-h-dvh w-full bg-black text-white overflow-x-hidden">
      {children}
    </div>
  );
}
