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

export default function LegalPage() {
  return (
    <LegalPageLayout
      title="特定商取引法に基づく表記"
      description="本ページは法務レビュー前のたたき台です。正式な事業者情報は今後差し替える可能性があります。"
    >
      <div className="rounded border border-gray-200 bg-white px-5">
        <Row label="事業者名">KnowValue 運営</Row>
        <Row label="運営責任者">後日正式記載予定</Row>
        <Row label="所在地">
          請求があった場合に遅滞なく開示します。
          <br />
          後日正式記載予定
        </Row>
        <Row label="お問い合わせ先">
          <a href="mailto:support@knowvalue.jp" className="text-blue-600 underline">
            support@knowvalue.jp
          </a>
        </Row>
        <Row label="販売価格">
          各質問投稿画面および BEST 閲覧購入画面に表示される金額
        </Row>
        <Row label="商品代金以外の必要料金">
          インターネット通信料等はユーザー負担です。振込手数料等が発生する場合は別途表示します。
        </Row>
        <Row label="支払方法">クレジットカード決済（Stripe Checkout）</Row>
        <Row label="支払時期">購入手続き完了時</Row>
        <Row label="サービス提供時期">
          決済完了後、対象サービスが利用可能になります。
        </Row>
        <Row label="返品・キャンセル">
          デジタルサービスの性質上、原則として決済完了後のキャンセル・返金はできません。
          <br />
          ただし、回答が0件の場合、不正・重大な不具合等、運営が必要と判断した場合は返金または再質問チケット等で対応する場合があります。
        </Row>
        <Row label="動作環境">Webブラウザ</Row>
      </div>
    </LegalPageLayout>
  );
}
