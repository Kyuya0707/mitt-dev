import type { Metadata } from "next";
import Link from "next/link";

export const metadata: Metadata = {
  title: "よくある質問 | KnowValue",
  description: "KnowValueの利用方法、料金、報酬、ルールに関するよくある質問です。",
};

const FAQ_SECTIONS = [
  {
    title: "質問・回答について",
    items: [
      {
        q: "質問はどのように投稿しますか？",
        a: "質問内容、カテゴリ、500円以上の報酬金額、BEST閲覧料、回答期限を入力します。投稿時のお支払いは質問報酬と10%のプラットフォーム利用料です。決済が完了すると公開され、回答が集まったら質問者がBEST回答を選びます。",
      },
      {
        q: "回答はどのように投稿しますか？",
        a: "回答したい質問を開いて、自分の経験や知見をもとに回答を投稿します。必要に応じて画像も添付できます。BEST回答に選ばれると報酬の対象になります。",
      },
      {
        q: "回答期限は設定できますか？",
        a: "はい。質問投稿時に回答期限の設定が必須で、通常は投稿日の14日後以降を指定します。条件を満たすBoost利用時だけ、最短7日まで短縮できます。",
      },
      {
        q: "回答期限を過ぎるとどうなりますか？",
        a: "質問者はキャンセル申請ができるようになります。キャンセルが承認されるかBEST回答が決まるまでは回答を受け付けるため、良い回答をそのまま待つこともできます。",
      },
      {
        q: "回答期限は後から変更できますか？",
        a: "期限前であれば延長できます。短縮、期限後の変更、回答期限なしへの変更はできません。",
      },
      {
        q: "BEST回答とは何ですか？",
        a: "質問者が、いちばん参考になった一つの回答をBEST回答として選ぶ仕組みです。BEST回答者には質問報酬の90%がサービス内残高へ付与されます。BEST回答は、質問者・回答者・購入者だけが全文を閲覧できる有料コンテンツになります。",
      },
      {
        q: "回答が必ず集まるとは限りませんか？",
        a: "はい。質問内容や条件によっては、回答が集まりにくいことがあります。できるだけ背景や目的を具体的に書くと、回答が集まりやすくなります。",
      },
      {
        q: "BEST回答を選ぶ責任は誰にありますか？",
        a: "質問者にあります。どの回答が一番役に立ったかを見て、最終的にBEST回答を選ぶのは質問者です。",
      },
    ],
  },
  {
    title: "料金・報酬について",
    items: [
      {
        q: "質問をキャンセルできますか？",
        a: "質問投稿後すぐに自由キャンセルはできません。回答期限を過ぎるとキャンセル申請が可能になり、回答がない場合は自動承認、回答がある場合は運営が内容を確認します。承認時は質問報酬を返金しますが、10%の利用料とBoost料金は原則返金されません。",
      },
      {
        q: "BEST回答の閲覧料とは何ですか？",
        a: "BEST回答を他のユーザーが閲覧するための料金です。質問者が質問投稿時に設定でき、閲覧料を支払ったユーザーはそのBEST回答を読めます。すでに購入済みのユーザーには、価格変更後も追加請求はありません。",
      },
      {
        q: "BEST回答が閲覧された場合、収益はどう分配されますか？",
        a: "BEST閲覧料は、質問者50%、BEST回答者20%、KnowValue運営30%で分配されます。BEST回答者は、これとは別に質問投稿時に設定された報酬も受け取ります。",
      },
      {
        q: "BEST回答の閲覧金額は後から変更できますか？",
        a: "はい、質問者は後からBEST閲覧金額を変更できます。変更後の価格は新しく購入するユーザーに適用され、すでに購入済みのユーザーに追加請求は発生しません。極端な価格変更は、運営が確認する場合があります。",
      },
      {
        q: "回答者はいつ報酬を受け取れますか？",
        a: "BEST回答に選ばれると質問報酬の90%がサービス内残高へ付与されます。月次締め時点で残高が5,000円以上ならまとめて振り込み、5,000円未満は翌月へ繰り越します。受け取りにはマイページからの受取設定が必要です。",
      },
      {
        q: "報酬を受け取るには何が必要ですか？",
        a: "マイページから報酬受取設定を行ってください。KnowValueは口座番号などの金融情報を直接保持せず、必要な本人確認や口座登録は受取先のサービス上で行います。個人として登録できます。",
      },
      {
        q: "交渉機能とは何ですか？",
        a: "回答者が追加報酬を提案できる機能です。質問者が承認すると追加報酬と10%の利用料を支払い、提案者が7日以内に回答すると追加報酬の90%が付与されます。追加報酬は、その回答がBESTに選ばれなくても返金されません。",
      },
      {
        q: "90日以内にBEST回答が決まらない場合は？",
        a: "決済完了から90日で質問報酬を自動返金し、質問を報酬停止中にして新しい回答を停止します。質問と既存回答は残り、質問者は新しい報酬と10%の利用料を支払って同じ質問を再開できます。",
      },
      {
        q: "Boostとは何ですか？",
        a: "報酬3,000円以上の質問を3日間上位へ表示する機能です。1回の料金は質問報酬の10%で、一つの質問につき最大3回利用できます。",
      },
    ],
  },
  {
    title: "ルール・安全について",
    items: [
      {
        q: "投稿にAIを利用できますか？",
        a: "利用できません。回答だけでなく、質問やコメントを含む投稿について、AIによる生成・要約・翻訳・校正・編集を禁止しています。ご自身の言葉と実体験で投稿してください。",
      },
      {
        q: "不適切な投稿や違反投稿は通報できますか？",
        a: "はい、通報できます。規約に反する投稿や、迷惑行為・不適切な内容を見つけた場合は、運営が確認できるように報告してください。",
      },
    ],
  },
  {
    title: "KnowValueについて",
    items: [
      {
        q: "β版では仕様が変わることがありますか？",
        a: "はい。KnowValueは小規模β版として運用しているため、より使いやすくする目的で仕様や表示が更新される場合があります。大きな変更がある場合は、できるだけ分かりやすく案内します。",
      },
      {
        q: "KnowValueは今すぐ全部使えますか？",
        a: "現在は小規模β版として運用しています。基本機能は利用できますが、改善や調整を続けながら順次安定化を進めています。",
      },
      {
        q: "なぜ黒と黄色？",
        a: "暗闇（ノイズ）から光（価値）を見つける、というコンセプトの視覚化です。視認性と印象の強さも大事にしています。",
      },
      {
        q: "どんな人に向いていますか？",
        a: "本気で答えが欲しい人、そして自分の経験を正しく評価してもらいたい18歳以上の人に向いています。育児、キャリア、IT、仕事、学習、恋愛、暮らしなど、実体験が役立つ領域で利用できます。",
      },
    ],
  },
] as const;

export default function FaqPage() {
  return (
    <main className="min-h-dvh bg-black px-6 py-14 text-white sm:py-20">
      <div className="mx-auto max-w-3xl">
        <Link
          href="/"
          className="text-sm font-medium text-yellow-300 transition hover:text-yellow-200"
        >
          ← トップページへ戻る
        </Link>

        <header className="mt-8 border-b border-yellow-400/20 pb-8">
          <p className="text-sm font-semibold tracking-widest text-yellow-300">
            FAQ
          </p>
          <h1 className="mt-3 text-3xl font-extrabold sm:text-4xl">
            よくある質問
          </h1>
          <p className="mt-4 leading-relaxed text-white/65">
            KnowValueの利用方法、料金、報酬、ルールについてまとめています。
          </p>
        </header>

        <div className="mt-10 space-y-12">
          {FAQ_SECTIONS.map((section) => (
            <section key={section.title}>
              <h2 className="mb-4 text-xl font-bold text-yellow-200">
                {section.title}
              </h2>
              <div className="space-y-3">
                {section.items.map((item, index) => (
                  <details
                    key={item.q}
                    open={section === FAQ_SECTIONS[0] && index === 0}
                    className="group rounded-2xl border border-white/10 bg-white/[0.03]"
                  >
                    <summary className="flex cursor-pointer list-none items-center justify-between gap-4 px-5 py-4 font-bold marker:content-none">
                      <span>{item.q}</span>
                      <span
                        aria-hidden="true"
                        className="shrink-0 text-yellow-300 transition group-open:rotate-180"
                      >
                        ▼
                      </span>
                    </summary>
                    <p className="border-t border-white/10 px-5 py-4 text-sm leading-relaxed text-white/70">
                      {item.a}
                    </p>
                  </details>
                ))}
              </div>
            </section>
          ))}
        </div>

        <div className="mt-14 rounded-2xl border border-yellow-400/20 bg-yellow-400/10 p-6 text-center">
          <p className="text-sm leading-relaxed text-yellow-50/80">
            解決しない場合は、お問い合わせフォームからご連絡ください。
          </p>
          <Link
            href="/contact"
            className="mt-4 inline-flex rounded-full bg-yellow-400 px-6 py-3 text-sm font-bold text-black transition hover:bg-yellow-300"
          >
            お問い合わせ
          </Link>
        </div>
      </div>
    </main>
  );
}
