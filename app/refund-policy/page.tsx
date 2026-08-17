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

export default function RefundPolicyPage() {
  return (
    <LegalPageLayout
      title="返金ポリシー"
      description="本ページは法務レビュー前のたたき台です。正式版では表現や条件が変更される場合があります。"
    >
      <Section title="1. 質問投稿決済の返金">
        <p>質問投稿決済後は、原則として返金不可とします。</p>
        <p>
          質問投稿時に決済されたプラットフォーム手数料についても、原則として返金対象外とします。
        </p>
        <p>
          ただし、回答期限を過ぎた場合、質問者はキャンセル申請を行うことができます。
        </p>
        <p>回答がない場合は自動承認し、回答がある場合は運営が内容を確認します。</p>
        <p>
          承認時は質問報酬を全額返金します。質問投稿時のプラットフォーム利用料とBoost料金は、当サービスの責任による障害等を除き返金しません。
        </p>
      </Section>

      <Section title="2. 例外的な返金対応">
        <p>以下の場合は、運営判断で返金または代替対応を行う場合があります。</p>
        <p>
          例外的に返金対応を行う場合であっても、返金範囲や返金方法は事案に応じて当サービスが合理的に判断します。
        </p>
        <ul className="list-disc pl-6">
          <li>決済エラーや二重決済が発生した場合</li>
          <li>明らかな不具合がある場合</li>
          <li>不正行為が確認された場合</li>
          <li>規約違反回答しかないと運営が判断した場合</li>
        </ul>
      </Section>

      <Section title="3. BEST回答閲覧購入">
        <p>
          BEST回答閲覧購入は、閲覧可能になった後は原則として返金不可とします。
        </p>
        <p>規約違反による削除または当サービスの障害により閲覧不能となった場合は、購入額を全額返金します。</p>
      </Section>

      <Section title="4. 決済キャンセル">
        <p>Stripeの決済画面上でキャンセルした場合、請求は発生しません。</p>
      </Section>

      <Section title="5. 返金方法">
        <p>返金が発生する場合は、原則として元の決済手段へStripe経由で返金します。</p>
        <p>
          返金反映までの日数は、カード会社その他の決済事業者の処理に依存します。
        </p>
      </Section>
    </LegalPageLayout>
  );
}
