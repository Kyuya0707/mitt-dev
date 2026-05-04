import Link from "next/link";

export default function AppFooter() {
  return (
    <footer className="border-t bg-gray-50 px-6 py-8 text-sm text-gray-700">
      <div className="mx-auto flex max-w-5xl flex-wrap items-center gap-4">
        <Link href="/terms" className="hover:underline">
          利用規約
        </Link>
        <Link href="/privacy" className="hover:underline">
          プライバシーポリシー
        </Link>
        <Link href="/legal" className="hover:underline">
          特定商取引法に基づく表記
        </Link>
        <Link href="/refund-policy" className="hover:underline">
          返金方針
        </Link>
        <a href="mailto:support@knowvalue.jp" className="hover:underline">
          お問い合わせ
        </a>
      </div>
    </footer>
  );
}
