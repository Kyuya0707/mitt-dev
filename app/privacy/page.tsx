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
          <li>質問、回答、コメント、画像その他の投稿内容</li>
          <li>購入履歴、通知設定、問い合わせ内容</li>
          <li>Stripe Connect に関連する識別子やステータス情報</li>
          <li>IPアドレス、Cookie、利用端末、アクセス日時等のアクセス情報</li>
        </ul>
      </Section>

      <Section title="2. 利用目的">
        <ul className="list-disc pl-6">
          <li>サービス提供、認証、本人確認、アカウント管理</li>
          <li>決済処理、報酬支払い、購入履歴管理</li>
          <li>通知送信、メール配信、お問い合わせ対応</li>
          <li>不正利用防止、利用規約違反対応、セキュリティ確保</li>
          <li>サービス改善、分析、品質向上</li>
        </ul>
      </Section>

      <Section title="3. 外部サービスの利用">
        <p>当サービスは、以下の外部サービスを利用する場合があります。</p>
        <ul className="list-disc pl-6">
          <li>Supabase</li>
          <li>Stripe</li>
          <li>Resend</li>
          <li>Vercel</li>
        </ul>
        <p>
          クレジットカード番号等の決済情報は当社で保持せず、Stripe が管理します。
        </p>
      </Section>

      <Section title="4. 第三者提供">
        <p>
          法令に基づく場合を除き、本人の同意なく第三者に個人情報を提供しません。
        </p>
      </Section>

      <Section title="5. 安全管理">
        <p>
          当サービスは、個人情報への不正アクセス、漏えい、改ざん、滅失等を防止するため、合理的な安全管理措置を講じます。
        </p>
      </Section>

      <Section title="6. Cookie等の利用">
        <p>
          当サービスは、ログイン状態の維持、利便性向上、利用状況の分析等のため、Cookieその他これに類する技術を利用する場合があります。
        </p>
      </Section>

      <Section title="7. 開示・訂正・削除等">
        <p>
          ご本人の個人情報について、開示、訂正、削除等を希望される場合は、下記お問い合わせ先までご連絡ください。
        </p>
      </Section>

      <Section title="8. お問い合わせ">
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
