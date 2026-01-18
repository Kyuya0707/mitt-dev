// app/(app)/layout.tsx
import Link from "next/link";

export default function AppLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-black">
      <header className="h-14 border-b bg-white flex items-center justify-between px-6">
        <Link href="/questions" className="font-bold">
          KnowValue
        </Link>

        <nav className="text-sm flex items-center gap-4">
          <Link href="/questions" className="text-gray-700 hover:underline">
            質問一覧
          </Link>
          <Link href="/mypage" className="text-gray-700 hover:underline">
            マイページ
          </Link>
        </nav>
      </header>

      <main className="px-6 py-6">{children}</main>
    </div>
  );
}
