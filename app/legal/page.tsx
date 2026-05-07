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
      description="本ページは法務レビュー前のたたき台です。正式版では表現や記載項目が更新される場合があります。"
    >
      <div className="rounded border border-gray-200 bg-white px-5">
        <Row label="事業者名">川田 葉月</Row>
        <Row label="サービス名">Know Value</Row>
        <Row label="運営責任者">川田 葉月</Row>
        <Row label="所在地">
          神奈川県川崎市多摩区宿河原4丁目
          <br />
          ※詳細住所は請求があった場合に遅滞なく開示します。
        </Row>
        <Row label="電話番号">請求があった場合に遅滞なく開示します。</Row>
        <Row label="お問い合わせ先">
          <a href="mailto:support@knowvalue.jp" className="text-blue-600 underline">
            support@knowvalue.jp
          </a>
        </Row>
        <Row label="販売価格">
          各質問投稿画面またはBEST閲覧購入画面に表示される金額
        </Row>
        <Row label="商品代金以外の必要料金">
          インターネット通信料等はユーザー負担です。
          <br />
          報酬受取時や出金時に手数料が発生する場合があります。
        </Row>
        <Row label="支払方法">
          クレジットカード決済
          <br />
          Stripe Checkout
        </Row>
        <Row label="支払時期">購入手続き完了時に直ちに決済されます。</Row>
        <Row label="サービス提供時期">
          決済完了後、対象機能を利用できます。
        </Row>
        <Row label="キャンセル・返金">
          返金ポリシーに従います。
        </Row>
        <Row label="動作環境">一般的なWebブラウザ</Row>
      </div>
    </LegalPageLayout>
  );
}
