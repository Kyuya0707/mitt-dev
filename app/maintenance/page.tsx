import Link from "next/link";

export default function MaintenancePage() {
  return (
    <div className="min-h-screen bg-white px-6 py-16 text-black">
      <div className="mx-auto max-w-2xl rounded-2xl border border-gray-200 bg-gray-50 p-10 text-center shadow-sm">
        <p className="text-sm font-semibold uppercase tracking-[0.2em] text-gray-500">
          KnowValue
        </p>
        <h1 className="mt-4 text-3xl font-bold">現在メンテナンス中です</h1>
        <p className="mt-4 text-gray-700 leading-relaxed">
          ご不便をおかけしています。
          <br />
          しばらく時間をおいて再度アクセスしてください。
        </p>
        <p className="mt-6 text-sm text-gray-600">
          お問い合わせ:{" "}
          <a
            href="mailto:support@knowvalue.jp"
            className="text-blue-600 underline hover:text-blue-800"
          >
            support@knowvalue.jp
          </a>
        </p>
        <div className="mt-8">
          <Link
            href="/"
            className="inline-flex rounded-lg border border-gray-300 bg-white px-4 py-2 text-sm text-gray-700 transition hover:bg-gray-100"
          >
            トップへ戻る
          </Link>
        </div>
      </div>
    </div>
  );
}
