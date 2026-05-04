import Link from "next/link";
import AppUserNav from "@/app/components/AppUserNav";

export default function AppHeader() {
  return (
    <header className="h-14 border-b bg-white flex items-center justify-between px-6">
      <Link href="/" className="font-bold">
        KnowValue
      </Link>

      <nav className="text-sm flex items-center gap-4">
        <Link href="/" className="text-gray-700 hover:underline">
          ホーム
        </Link>
        <Link href="/questions" className="text-gray-700 hover:underline">
          質問一覧
        </Link>
        <Link href="/questions/new" className="text-gray-700 hover:underline">
          質問投稿
        </Link>
        <Link href="/terms" className="text-gray-700 hover:underline">
          利用規約
        </Link>
        <AppUserNav />
      </nav>
    </header>
  );
}
