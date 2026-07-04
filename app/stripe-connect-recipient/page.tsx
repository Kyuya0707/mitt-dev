import LegalPageLayout from "@/app/components/LegalPageLayout";

function Row({
  label,
  children,
}: {
  label: string;
  children: React.ReactNode;
}) {
  return (
    <div className="grid gap-2 border-b py-4 md:grid-cols-[220px_1fr]">
      <div className="text-sm font-semibold text-gray-900">{label}</div>
      <div className="text-sm leading-7 text-gray-700">{children}</div>
    </div>
  );
}

export default function StripeConnectRecipientPage() {
  return (
    <LegalPageLayout
      title="Stripe受取登録について"
      description="KnowValueで報酬を受け取る利用者向けの説明ページです。Connected AccountはKnowValueの運営者ではありません。"
    >
      <div className="rounded border border-gray-200 bg-white px-5">
        <Row label="登録の位置づけ">
          このStripe Connect Expressアカウントは、KnowValueの運営者アカウントではなく、
          KnowValue上で回答や知識提供を行い、その報酬を受け取る個人利用者のための登録です。
        </Row>
        <Row label="行うこと">
          自身の実体験、知識、経験に基づいてQ&amp;A回答を提供し、報酬を受け取ります。
          <br />
          報酬はStripe Connect Expressを通じて受け取ります。
        </Row>
        <Row label="行わないこと">
          第三者への送金、決済代行、プラットフォーム運営は行いません。
          <br />
          Stripe外で銀行振込を行うものではありません。
        </Row>
        <Row label="禁止事項">
          投資助言、金融商品、暗号資産、ギャンブル、アダルト、違法行為、
          情報商材、詐欺的行為などは禁止です。
        </Row>
        <Row label="補足">
          Stripeの本人確認や口座登録は、Stripeの案内に従って進めてください。
          <br />
          KnowValueは銀行口座などの金融情報を保持しません。
        </Row>
      </div>
    </LegalPageLayout>
  );
}
