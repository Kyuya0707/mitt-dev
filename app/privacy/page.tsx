import LegalPageLayout from "@/app/components/LegalPageLayout";

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section>
      <h2 className="mb-3 text-xl font-bold">{title}</h2>
      <div className="space-y-3 text-sm leading-7 text-gray-700">{children}</div>
    </section>
  );
}

export default function PrivacyPage() {
  return (
    <LegalPageLayout
      title="プライバシーポリシー"
      description="本ページは法務レビュー前のたたき台です。正式版では表現や範囲が更新される場合があります。"
    >
      <Section title="1. 取得する情報">
        <ul className="list-disc pl-6">
          <li>メールアドレス、ユーザー名、プロフィール情報</li>
          <li>画像、興味カテゴリ、地域等の任意登録情報</li>
          <li>投稿・回答・コメント・通知等の利用履歴</li>
          <li>決済に関する識別情報</li>
        </ul>
      </Section>

      <Section title="2. 利用目的">
        <ul className="list-disc pl-6">
          <li>アカウント管理、認証、本人確認</li>
          <li>サービス提供・改善、不正利用防止</li>
          <li>報酬管理、決済処理、送金対応</li>
          <li>お問い合わせ対応</li>
        </ul>
      </Section>

      <Section title="3. 第三者提供">
        <p>
          法令に基づく場合を除き、本人の同意なく第三者に個人情報を提供しません。
        </p>
      </Section>

      <Section title="4. 外部サービスの利用">
        <p>
          当サービスは、Supabase、Stripe、Stripe Connect、Resend 等の外部サービスを利用する場合があります。
        </p>
      </Section>

      <Section title="5. お問い合わせ">
        <p>
          プライバシーに関するお問い合わせは
          <a href="mailto:support@knowvalue.jp" className="mx-1 text-blue-600 underline">
            support@knowvalue.jp
          </a>
          までご連絡ください。
        </p>
      </Section>
    </LegalPageLayout>
  );
}
