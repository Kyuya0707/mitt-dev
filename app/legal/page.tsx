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
        <Row label="サービス内容">
          実体験・知識・経験を共有するQ&Aプラットフォーム
          <br />
          質問者が報酬を設定して質問を投稿し、他ユーザーが回答します。
          <br />
          質問者はBEST回答を選択でき、BEST回答は有料コンテンツとして閲覧提供されます。
          <br />
          質問投稿時に14日後以降の回答期限を設定し、回答期限を過ぎるとキャンセル申請が可能になります。
          <br />
          質問者本人は、期限前に限り回答期限を延長できます。
        </Row>
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
          <br />
          質問投稿時の決済額は、質問者が設定した報酬額に当社所定のプラットフォーム手数料を加算した金額となります。
          <br />
          BEST閲覧購入時の決済額は、購入画面に表示されるBEST閲覧価格となります。
        </Row>
        <Row label="商品代金以外の必要料金">
          インターネット通信料等はユーザー負担です。
          <br />
          報酬の月次振込手数料はKnowValueが負担します。
        </Row>
        <Row label="支払方法">
          クレジットカード決済
          <br />
          Stripe Checkout
        </Row>
        <Row label="支払時期">購入手続き完了時に直ちに決済されます。</Row>
        <Row label="サービス提供時期">
          決済完了後、対象コンテンツをすぐに閲覧できます。
        </Row>
        <Row label="返品・キャンセル">
          閲覧開始後のデジタルコンテンツは原則として返品不可です。
          <br />
          質問投稿のキャンセルは回答期限を過ぎた後に申請できます。回答がない場合は自動承認し、回答がある場合は管理者が確認します。
        </Row>
        <Row label="BEST閲覧料">
          BEST回答を閲覧するための料金です。
          <br />
          BEST閲覧料は質問者50%、BEST回答者20%、KnowValue運営30%で分配されます。
          <br />
          すでに購入済みのユーザーに追加請求は発生しません。
        </Row>
        <Row label="不適切投稿">
          規約違反投稿は削除・非公開化・アカウント制限の対象となる場合があります。
          <br />
          通報機能により、管理者が内容を確認します。
        </Row>
        <Row label="β版について">
          β版として運用中のため、機能、表示、条件、手数料などが予告なく変更される場合があります。
        </Row>
        <Row label="キャンセル・返金">
          返金ポリシーに従います。
        </Row>
        <Row label="動作環境">一般的なWebブラウザ</Row>
      </div>
    </LegalPageLayout>
  );
}
