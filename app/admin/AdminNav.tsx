import Link from "next/link";

type AdminNavProps = {
  current:
    | "dashboard"
    | "payout-batches"
    | "payouts"
    | "best-view-payouts"
    | "cancellation-requests"
    | "reports"
    | "support-tickets";
};

function getLinkClass(active: boolean) {
  return active
    ? "rounded-full bg-gray-900 px-4 py-2 text-white"
    : "rounded-full border border-gray-300 px-4 py-2 text-gray-700 hover:bg-gray-50";
}

export default function AdminNav({ current }: AdminNavProps) {
  return (
    <div className="mb-6 flex flex-wrap items-center gap-3 text-sm">
      <Link href="/" className="text-gray-700 underline">
        ホーム
      </Link>
      <Link href="/questions" className="text-gray-700 underline">
        質問一覧
      </Link>
      <Link href="/mypage" className="text-gray-700 underline">
        マイページ
      </Link>
      <div className="mx-1 h-4 w-px bg-gray-300" />
      <Link href="/admin" className={getLinkClass(current === "dashboard")}>
        ダッシュボード
      </Link>
      <Link
        href="/admin/payout-batches"
        className={getLinkClass(current === "payout-batches")}
      >
        月次一括振込
      </Link>
      <Link
        href="/admin/payouts"
        className={getLinkClass(current === "payouts")}
      >
        質問報酬明細
      </Link>
      <Link
        href="/admin/best-view-payouts"
        className={getLinkClass(current === "best-view-payouts")}
      >
        BEST閲覧料明細
      </Link>
      <Link
        href="/admin/cancellation-requests"
        className={getLinkClass(current === "cancellation-requests")}
      >
        キャンセル申請
      </Link>
      <Link href="/admin/reports" className={getLinkClass(current === "reports")}>
        通報・異議申立て
      </Link>
      <Link href="/admin/support-tickets" className={getLinkClass(current === "support-tickets")}>
        お問い合わせ
      </Link>
    </div>
  );
}
