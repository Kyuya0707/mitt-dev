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
      title="返金・キャンセル方針"
      description="本ページは法務レビュー前のたたき台です。正式版では表現や条件が変更される場合があります。"
    >
      <Section title="1. 質問投稿決済">
        <p>質問投稿決済後は、原則として返金不可とします。</p>
        <p>ただし、以下の場合は運営判断で返金または代替対応を行うことがあります。</p>
        <ul className="list-disc pl-6">
          <li>48時間以内に回答が0件である場合</li>
          <li>決済エラーまたは二重決済が発生した場合</li>
          <li>明らかな不具合がある場合</li>
          <li>規約違反回答しかないと運営が判断した場合</li>
        </ul>
      </Section>

      <Section title="2. BEST回答閲覧購入">
        <p>
          BEST 回答閲覧購入は、閲覧可能になった後は原則として返金不可とします。
        </p>
      </Section>

      <Section title="3. 決済キャンセル">
        <p>Stripe の決済画面上でキャンセルした場合、請求は発生しません。</p>
      </Section>

      <Section title="4. 返金方法">
        <p>
          返金が発生する場合は、原則として Stripe を通じて返金処理を行います。
        </p>
        <p>
          返金反映までの日数や手数料の扱いは、決済会社およびカード会社の処理に依存します。
        </p>
      </Section>
    </LegalPageLayout>
  );
}
