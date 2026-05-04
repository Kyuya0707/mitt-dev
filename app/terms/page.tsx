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

export default function TermsPage() {
  return (
    <LegalPageLayout
      title="利用規約"
      description="本ページは法務レビュー前のたたき台です。正式版は内容が更新される可能性があります。"
    >
      <Section title="1. サービスの概要">
        <p>
          KnowValue は、ユーザーが報酬を設定して質問を投稿し、他のユーザーが実体験や知識に基づいて回答する報酬付きQ&Aプラットフォームです。
        </p>
        <p>
          当サービスは広告収益型ではなく、信頼できる知見の流通を目的としています。
        </p>
      </Section>

      <Section title="2. ユーザー登録">
        <p>ユーザーは、正確かつ最新の情報を用いて登録を行うものとします。</p>
        <p>当サービスは本人確認や必要な認証手続きを求める場合があります。</p>
      </Section>

      <Section title="3. 質問投稿・回答投稿のルール">
        <p>質問者は、質問内容、報酬額、必要に応じた閲覧料を設定して投稿できます。</p>
        <p>回答者は、自らの経験や知識に基づく回答を投稿するものとします。</p>
        <p>AI により自動生成された回答の投稿は禁止します。</p>
      </Section>

      <Section title="4. BEST回答の選定">
        <p>質問者は、投稿された回答の中から BEST 回答を選定できます。</p>
        <p>
          BEST 回答が選定されると、質問は原則としてクローズされ、所定の報酬処理が進行します。
        </p>
      </Section>

      <Section title="5. 報酬・手数料">
        <p>
          質問報酬は、原則として回答者 90%、KnowValue 10% の割合で分配されます。
        </p>
        <p>
          BEST 回答閲覧料は、原則として質問者 50%、回答者 20%、KnowValue 30% の割合で分配されます。
        </p>
        <p>
          実際の支払処理には Stripe および Stripe Connect を利用します。
        </p>
      </Section>

      <Section title="6. 禁止事項">
        <ul className="list-disc pl-6">
          <li>虚偽情報の投稿</li>
          <li>誹謗中傷、差別的表現、ハラスメント行為</li>
          <li>法令違反または公序良俗に反する行為</li>
          <li>AI回答の投稿</li>
          <li>なりすまし</li>
          <li>不正決済、チャージバック目的の利用</li>
          <li>サービス外への不適切な誘導</li>
        </ul>
      </Section>

      <Section title="7. 投稿コンテンツの取り扱い">
        <p>
          投稿コンテンツの権利は原則として投稿者に帰属します。ただし、当サービスの運営・表示・保守・告知に必要な範囲で利用できるものとします。
        </p>
      </Section>

      <Section title="8. 通報・アカウント停止">
        <p>
          当サービスは、規約違反の疑いがある投稿や行為について、削除、非公開化、警告、利用停止等の措置を行うことがあります。
        </p>
      </Section>

      <Section title="9. 返金・キャンセル">
        <p>
          返金・キャンセルの詳細は
          <a className="mx-1 text-blue-600 underline" href="/refund-policy">
            返金・キャンセル方針
          </a>
          に定めます。
        </p>
      </Section>

      <Section title="10. 免責事項">
        <p>
          当サービスは、投稿内容の正確性、完全性、有用性を保証するものではありません。ユーザーは自己の責任で当サービスを利用するものとします。
        </p>
      </Section>

      <Section title="11. サービス変更・停止">
        <p>
          当サービスは、必要に応じて、サービス内容の変更、停止、終了を行うことがあります。
        </p>
      </Section>

      <Section title="12. 準拠法・管轄">
        <p>
          本規約は日本法に準拠し、本サービスに関して紛争が生じた場合は、運営者所在地を管轄する裁判所を第一審の専属的合意管轄裁判所とします。
        </p>
      </Section>
    </LegalPageLayout>
  );
}
