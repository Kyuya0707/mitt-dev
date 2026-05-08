import Link from "next/link";
import AppUserNav from "@/app/components/AppUserNav";

export default function AppHeader() {
  return (
    <header className="flex h-14 items-center justify-between border-b bg-white px-3 sm:px-6">
      <Link href="/" className="whitespace-nowrap text-sm font-bold sm:text-base">
        KnowValue
      </Link>

      <nav className="flex items-center gap-2 text-[11px] sm:gap-4 sm:text-sm">
        <Link href="/" className="whitespace-nowrap text-gray-700 hover:underline">
          ホーム
        </Link>
        <Link
          href="/questions"
          className="whitespace-nowrap text-gray-700 hover:underline"
        >
          質問一覧
        </Link>
        <Link
          href="/questions/new"
          className="whitespace-nowrap text-gray-700 hover:underline"
        >
          質問投稿
        </Link>
        <AppUserNav />
      </nav>
    </header>
  );
}
