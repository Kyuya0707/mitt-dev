// app/privacy-policy/page.tsx
export default function PrivacyPolicyPage() {
  return (
    <div className="max-w-3xl mx-auto p-6 text-black">
      <h1 className="text-2xl font-bold mb-4">プライバシーポリシー</h1>

      <p className="text-sm text-gray-700 leading-relaxed mb-6">
        KnowValue（以下「当サービス」）は、ユーザーの個人情報を適切に取り扱い、保護することを重要な責務と考えます。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">1. 取得する情報</h2>
      <ul className="list-disc pl-6 text-sm text-gray-700 space-y-1">
        <li>メールアドレス、ユーザー名、プロフィール情報（任意）</li>
        <li>画像（任意）</li>
        <li>利用状況に関するログ（アクセス情報、操作履歴など）</li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">2. 利用目的</h2>
      <ul className="list-disc pl-6 text-sm text-gray-700 space-y-1">
        <li>アカウント管理、本人確認、認証メール送付</li>
        <li>サービス提供・改善、不正利用の防止</li>
        <li>お問い合わせ対応</li>
      </ul>

      <h2 className="text-lg font-bold mt-6 mb-2">3. 第三者提供</h2>
      <p className="text-sm text-gray-700 leading-relaxed">
        法令に基づく場合を除き、本人の同意なく第三者に提供しません。
      </p>

      <h2 className="text-lg font-bold mt-6 mb-2">4. お問い合わせ</h2>
      <p className="text-sm text-gray-700 leading-relaxed">
        本ポリシーに関するお問い合わせは、運営者までご連絡ください。
      </p>

      <p className="text-xs text-gray-500 mt-10">最終更新日：2026-01-18</p>
    </div>
  );
}
