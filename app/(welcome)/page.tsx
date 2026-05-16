// app/(welcome)/page.tsx
"use client";

import Link from "next/link";
import { useEffect, useMemo, useState } from "react";
import { motion } from "framer-motion";
import { supabaseBrowser } from "@/lib/supabase-browser";
import type { User } from "@supabase/supabase-js";
import ReferralLinkButton from "@/app/components/ReferralLinkButton";

const fadeUp = {
  hidden: { opacity: 0, y: 18 },
  show: (delay = 0) => ({
    opacity: 1,
    y: 0,
    transition: { duration: 0.75, delay },
  }),
};

const softPop = {
  hidden: { opacity: 0, scale: 0.97 },
  show: (delay = 0) => ({
    opacity: 1,
    scale: 1,
    transition: { duration: 0.7, delay },
  }),
};

function SectionTitle({
  title,
  subtitle,
}: {
  title: string;
  subtitle?: string;
}) {
  return (
    <div className="mb-6 text-center">
      <motion.h2
        className="text-2xl sm:text-3xl font-extrabold tracking-tight"
        initial="hidden"
        whileInView="show"
        viewport={{ once: true, amount: 0.4 }}
        variants={fadeUp}
        custom={0}
      >
        {title}
      </motion.h2>
      {subtitle && (
        <motion.p
          className="mt-2 text-sm sm:text-base text-white/60 leading-relaxed"
          initial="hidden"
          whileInView="show"
          viewport={{ once: true, amount: 0.4 }}
          variants={fadeUp}
          custom={0.1}
        >
          {subtitle}
        </motion.p>
      )}
    </div>
  );
}

function Pill({ children }: { children: React.ReactNode }) {
  return (
    <span className="inline-flex items-center gap-2 px-3 py-1 rounded-full border border-yellow-400/30 bg-yellow-400/10 text-yellow-200 text-xs">
      <span className="w-1.5 h-1.5 rounded-full bg-yellow-400 animate-pulse" />
      {children}
    </span>
  );
}

function FeatureCard({
  icon,
  title,
  desc,
  delay,
}: {
  icon: string;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <motion.div
      className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6 backdrop-blur hover:bg-white/[0.05] transition"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.35 }}
      variants={softPop}
      custom={delay}
    >
      <div className="flex items-start gap-3">
        <div className="text-2xl">{icon}</div>
        <div>
          <div className="font-bold text-white">{title}</div>
          <div className="mt-1 text-sm text-white/65 leading-relaxed">
            {desc}
          </div>
        </div>
      </div>
    </motion.div>
  );
}

function StepCard({
  step,
  title,
  desc,
  delay,
}: {
  step: string;
  title: string;
  desc: string;
  delay: number;
}) {
  return (
    <motion.div
      className="relative rounded-2xl border border-yellow-400/15 bg-black/50 p-5 sm:p-6"
      initial="hidden"
      whileInView="show"
      viewport={{ once: true, amount: 0.35 }}
      variants={fadeUp}
      custom={delay}
    >
      <div className="absolute -top-3 left-4">
        <span className="px-3 py-1 rounded-full bg-yellow-400 text-black text-xs font-extrabold">
          {step}
        </span>
      </div>
      <div className="pt-3">
        <div className="text-lg font-extrabold">{title}</div>
        <div className="mt-2 text-sm text-white/65 leading-relaxed">{desc}</div>
      </div>
    </motion.div>
  );
}

function FaqItem({
  q,
  a,
  defaultOpen = false,
}: {
  q: string;
  a: string;
  defaultOpen?: boolean;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.02] overflow-hidden">
      <button
        type="button"
        onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-4 px-5 py-4 text-left hover:bg-white/[0.03] transition"
      >
        <div className="font-bold text-white">{q}</div>
        <motion.span
          className="text-yellow-300"
          animate={{ rotate: open ? 180 : 0 }}
          transition={{ duration: 0.25 }}
        >
          ▼
        </motion.span>
      </button>

      <motion.div
        initial={false}
        animate={{
          height: open ? "auto" : 0,
          opacity: open ? 1 : 0,
        }}
        transition={{ duration: 0.25 }}
        className="px-5"
      >
        <div className="pb-4 text-sm text-white/65 leading-relaxed">{a}</div>
      </motion.div>
    </div>
  );
}

function InfoCard({
  title,
  desc,
}: {
  title: string;
  desc: string;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
      <div className="text-base font-bold text-white">{title}</div>
      <p className="mt-2 text-sm leading-relaxed text-white/70">{desc}</p>
    </div>
  );
}

type FaqEntry = {
  q: string;
  a: string;
  defaultOpen?: boolean;
};

const FAQ_ITEMS: FaqEntry[] = [
  {
    q: "質問をキャンセルできますか？",
    a: "質問投稿後すぐに自由キャンセルはできません。原則として投稿から1週間後にキャンセル申請が可能になり、承認は管理者判断で行われます。承認された場合はキャンセル扱いとなり、決済や返金の扱いは運営確認後に進めます。",
    defaultOpen: true,
  },
  {
    q: "BEST回答とは何ですか？",
    a: "質問者が、いちばん参考になった回答をBEST回答として選ぶ仕組みです。BEST回答に選ばれた回答者には、質問投稿時に設定された報酬が支払われます。BEST回答は、購入者だけが閲覧できる有料コンテンツになります。",
  },
  {
    q: "BEST回答の閲覧料とは何ですか？",
    a: "BEST回答を他のユーザーが閲覧するための料金です。質問者が質問投稿時に設定でき、閲覧料を支払ったユーザーはそのBEST回答を読めます。すでに購入済みのユーザーには、価格変更後も追加請求はありません。",
  },
  {
    q: "BEST回答が閲覧された場合、収益はどう分配されますか？",
    a: "BEST閲覧料は、質問者70%、KnowValue運営30%で分配されます。回答者はBEST回答に選ばれた時点で、質問投稿時に設定された報酬を受け取ります。BEST閲覧料から回答者への追加分配は現在行っていません。",
  },
  {
    q: "BEST回答の閲覧金額は後から変更できますか？",
    a: "はい、質問者は後からBEST閲覧金額を変更できます。変更後の価格は新しく購入するユーザーに適用され、すでに購入済みのユーザーに追加請求は発生しません。極端な価格変更は、運営が確認する場合があります。",
  },
  {
    q: "回答者はいつ報酬を受け取れますか？",
    a: "回答がBEST回答に選ばれると、質問投稿時に設定された報酬の対象になります。報酬の受け取りには、マイページからの受取設定が必要です。設定が未完了の場合、支払いに時間がかかることがあります。",
  },
  {
    q: "報酬を受け取るには何が必要ですか？",
    a: "マイページから報酬受取設定を行ってください。KnowValueは口座番号などの金融情報を直接保持せず、必要な本人確認や口座登録は受取先のサービス上で行います。個人として登録できます。",
  },
  {
    q: "質問はどのように投稿しますか？",
    a: "質問内容、カテゴリ、報酬金額、BEST閲覧料を入力して投稿します。必要に応じて画像も添付できます。決済が完了すると質問が公開され、回答が集まったら質問者がBEST回答を選びます。",
  },
  {
    q: "回答はどのように投稿しますか？",
    a: "回答したい質問を開いて、自分の経験や知見をもとに回答を投稿します。必要に応じて画像も添付できます。BEST回答に選ばれると報酬の対象になります。",
  },
  {
    q: "交渉機能とは何ですか？",
    a: "回答者が「追加報酬があれば、もっと詳しく回答できる」と質問者へ提案できる機能です。質問者が承認すると追加決済に進み、見送られた場合は回答者へ通知されます。通常のBEST回答報酬とは別の提案機能です。",
  },
  {
    q: "AI回答ではなく、実体験や知見を重視しているのはなぜですか？",
    a: "KnowValueは、実際に経験した人の知見に価値があると考えています。AIの一般論よりも、失敗談や現場感のある答えのほうが、より具体的で役立つことが多いからです。",
  },
  {
    q: "不適切な投稿や違反投稿は通報できますか？",
    a: "はい、通報できます。規約に反する投稿や、迷惑行為・不適切な内容を見つけた場合は、運営が確認できるように報告してください。",
  },
  {
    q: "回答が必ず集まるとは限りませんか？",
    a: "はい。質問内容や条件によっては、回答が集まりにくいことがあります。できるだけ背景や目的を具体的に書くと、回答が集まりやすくなります。",
  },
  {
    q: "BEST回答を選ぶ責任は誰にありますか？",
    a: "質問者にあります。どの回答が一番役に立ったかを見て、最終的にBEST回答を選ぶのは質問者です。",
  },
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
    a: "本気で“答え”が欲しい人、そして経験を正しく評価してもらいたい人に向いています。仕事・生活・投資・キャリアなど、実体験が強い領域ほど相性が良いです。",
  },
] as const;

export default function WelcomePage() {
  const year = useMemo(() => new Date().getFullYear(), []);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();

    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        setUser(null);
        return;
      }
      setUser(data.user ?? null);
    };

    fetchUser();

    const { data: listener } = supabase.auth.onAuthStateChange(
      (_event, session) => {
        setUser(session?.user ?? null);
      }
    );

    return () => {
      listener.subscription.unsubscribe();
    };
  }, []);

  const handleLogout = async () => {
    if (!confirm("ログアウトしますか？")) return;
    const supabase = supabaseBrowser();
    await supabase.auth.signOut();
    window.location.href = "/";
  };

  const scrollToDetails = () => {
    const el = document.getElementById("welcome-details");
    if (el) el.scrollIntoView({ behavior: "smooth", block: "start" });
  };

  return (
    <main className="relative isolate min-h-dvh w-full overflow-x-hidden bg-black text-white">
      {/* 背景：光のにじみ（黒×黄） */}
      <motion.div
        className="pointer-events-none absolute -top-28 -left-28 w-[28rem] h-[28rem] rounded-full bg-yellow-400 blur-[170px]"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 0.9, scale: 1.05 }}
        transition={{ duration: 1.8 }}
      />
      <motion.div
        className="pointer-events-none absolute -bottom-36 -right-28 w-[34rem] h-[34rem] rounded-full bg-yellow-300 blur-[190px]"
        initial={{ opacity: 0, scale: 0.7 }}
        animate={{ opacity: 0.6, scale: 1.1 }}
        transition={{ duration: 2.2, delay: 0.1 }}
      />

      {/* 粒子背景 */}
      <div className="pointer-events-none absolute inset-0 opacity-[0.12]">
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              "radial-gradient(circle at 18% 30%, rgba(255,214,0,0.9) 0.6px, transparent 1px), radial-gradient(circle at 82% 62%, rgba(255,214,0,0.7) 0.6px, transparent 1px), radial-gradient(circle at 60% 18%, rgba(255,214,0,0.5) 0.6px, transparent 1px)",
            backgroundSize: "150px 150px",
          }}
        />
      </div>

      <div className="relative z-10">
        {/* ===== Hero（既存の概要は残しつつ） ===== */}
        <section className="min-h-dvh flex items-center justify-center px-6">
          <div className="w-full max-w-3xl">
            <motion.div
              className="rounded-2xl border border-yellow-400/20 bg-black/55 backdrop-blur p-10 sm:p-12 text-center"
              initial={{ opacity: 0, y: 22, scale: 0.98 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              transition={{ duration: 0.9, delay: 0.15 }}
            >
              <div className="flex items-center justify-center gap-2 mb-5">
                <Pill>闇の中から、価値を見つける</Pill>
                <span className="hidden sm:inline-flex">
                  <Pill>黒 × 黄（Light in the Dark）</Pill>
                </span>
              </div>

              <motion.h1
                className="text-5xl sm:text-6xl font-extrabold tracking-tight"
                initial={{ opacity: 0, y: 18 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.9, delay: 0.25 }}
              >
                <span className="text-white">Know</span>
                <span className="text-yellow-400">Value</span>
              </motion.h1>

              <motion.p
                className="mt-6 text-2xl font-bold leading-relaxed text-white/90 sm:text-3xl"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.0, delay: 0.55 }}
              >
                あなたの経験が、
                <br />
                誰かの答えになる。
              </motion.p>

              <motion.p
                className="mt-4 text-sm leading-relaxed text-yellow-100/90 sm:text-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.0, delay: 0.68 }}
              >
                質問にも、回答にも、
                <br className="sm:hidden" />
                価値がある。
              </motion.p>

              <motion.p
                className="mt-4 text-sm leading-relaxed text-white/65 sm:text-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.0, delay: 0.8 }}
              >
                質問者は報酬を設定して質問でき、回答者は経験や知識を回答として届けられます。
                <br />
                BEST回答に選ばれた回答者には報酬が支払われます。現在は小規模β版として運用しています。
              </motion.p>

              {/* ✅ CTA（ここだけログイン状態で出し分け） */}
              <motion.div
                className="mt-10 flex flex-col items-stretch justify-center gap-3 sm:flex-row sm:flex-wrap sm:items-center"
                initial={{ opacity: 0, y: 14 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ duration: 0.8, delay: 1.05 }}
              >
                {user ? (
                  <>
                    <Link
                      href="/questions"
                      className="w-full shrink-0 whitespace-nowrap rounded-full bg-yellow-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-yellow-300 sm:w-auto sm:px-6 sm:text-base"
                    >
                      質問一覧を見る
                    </Link>

                    <Link
                      href="/mypage"
                      className="w-full shrink-0 whitespace-nowrap rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm transition hover:bg-white/10 sm:w-auto sm:px-6 sm:text-base"
                    >
                      マイページへ
                    </Link>

                    <Link
                      href="/questions/new"
                      className="w-full shrink-0 whitespace-nowrap rounded-full border border-yellow-400/30 bg-yellow-400/5 px-5 py-3 text-sm transition hover:bg-yellow-400/10 sm:w-auto sm:px-6 sm:text-base"
                    >
                      質問する
                    </Link>

                    <ReferralLinkButton
                      referralId={user.id}
                      className="w-full shrink-0 whitespace-nowrap rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm hover:bg-white/10 sm:w-auto sm:px-6 sm:text-base"
                    />

                    <button
                      type="button"
                      onClick={handleLogout}
                      className="w-full shrink-0 whitespace-nowrap rounded-full border border-red-400/30 bg-red-400/5 px-5 py-3 text-sm transition hover:bg-red-400/10 sm:w-auto sm:px-6 sm:text-base"
                    >
                      ログアウト
                    </button>
                  </>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      className="w-full shrink-0 whitespace-nowrap rounded-full bg-yellow-400 px-5 py-3 text-sm font-bold text-black transition hover:bg-yellow-300 sm:w-auto sm:px-6 sm:text-base"
                    >
                      新規登録する
                    </Link>

                    <Link
                      href="/login"
                      className="w-full shrink-0 whitespace-nowrap rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm transition hover:bg-white/10 sm:w-auto sm:px-6 sm:text-base"
                    >
                      ログイン
                    </Link>

                    <button
                      type="button"
                      onClick={scrollToDetails}
                      className="w-full shrink-0 whitespace-nowrap rounded-full border border-yellow-400/30 bg-yellow-400/5 px-5 py-3 text-sm transition hover:bg-yellow-400/10 sm:w-auto sm:px-6 sm:text-base"
                    >
                      Know Valueとは？
                    </button>
                    <Link
                      href="/questions"
                      className="w-full shrink-0 whitespace-nowrap rounded-full border border-white/20 bg-white/5 px-5 py-3 text-sm transition hover:bg-white/10 sm:w-auto sm:px-6 sm:text-base"
                    >
                      質問一覧を見る
                    </Link>
                  </>
                )}
              </motion.div>

              <motion.div
                className="mt-10 text-xs text-white/40"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.0, delay: 1.4 }}
              >
                © {year} KnowValue
              </motion.div>
            </motion.div>
          </div>
        </section>

        {/* ===== 以下、君の既存の説明セクションはそのまま ===== */}
        <section id="welcome-details" className="px-6 pb-24 pt-6 sm:pt-10">
          <div className="mx-auto w-full max-w-5xl">
            <SectionTitle
              title="KnowValueは何をする場所？"
              subtitle="「経験」と「知識」を、正当に評価される“価値”へ。答える人も、知りたい人も、納得できる仕組みに。"
            />

            <div className="grid gap-4 sm:gap-5 sm:grid-cols-2 lg:grid-cols-3">
              <FeatureCard
                icon="🌓"
                title="ノイズの中から“本物”へ"
                desc="情報が溢れるほど、正しい答えは見つかりにくい。KnowValueは、実体験ベースの知見が集まる場所を目指します。"
                delay={0.05}
              />
              <FeatureCard
                icon="💡"
                title="経験は、価値になる"
                desc="あなたが積み上げた経験・失敗・成功は、誰かにとっての最短ルート。知見が正しく評価される世界へ。"
                delay={0.12}
              />
              <FeatureCard
                icon="🧭"
                title="納得できる導線"
                desc="「知りたい」側は迷わず質問し、「答える」側は価値を提示できる。両者が納得して前に進めるUXを作ります。"
                delay={0.19}
              />
            </div>

            <div className="mt-12">
              <SectionTitle
                title="KnowValueとは"
                subtitle="サービス内容を、ひと目で伝わるように整理しています。"
              />

              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
                <InfoCard
                  title="実体験・知識・経験を共有するQ&A"
                  desc="KnowValue は、実体験・知識・経験を共有するQ&Aプラットフォームです。ユーザーは質問を投稿し、他ユーザーが経験や知見をもとに回答します。"
                />
                <InfoCard
                  title="BEST回答は有料コンテンツ"
                  desc="質問者は回答の中から BEST回答 を選択でき、BEST回答は有料コンテンツとして公開されます。閲覧料金は質問者70%、KnowValue運営30%で分配されます。"
                />
                <InfoCard
                  title="報酬受取はStripe Connect"
                  desc="報酬の受取には、Stripe Connect を利用した本人確認・口座登録が必要です。KnowValue は銀行口座などの金融情報を直接保持しません。"
                />
              </div>
            </div>

            <div className="mt-12">
              <SectionTitle
                title="KnowValueのお金の流れ"
                subtitle="個人間送金ではなく、質問・回答・閲覧の流れが分かる形で設計しています。"
              />

              <div className="grid gap-4 lg:grid-cols-[1.2fr_1fr]">
                <div className="rounded-3xl border border-yellow-400/20 bg-black/45 p-6 sm:p-8">
                  <div className="grid gap-4">
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      1. 質問を投稿する
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      2. 回答が集まる
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      3. 質問者が BEST回答 を選ぶ
                    </div>
                    <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                      4. 他ユーザーが BEST回答 を有料閲覧する
                    </div>
                    <div className="rounded-2xl border border-yellow-400/30 bg-yellow-400/10 px-4 py-3 text-yellow-100">
                      5. 閲覧料金の70%が質問者へ還元され、30%がKnowValue運営へ充当されます
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                    <div className="text-base font-bold text-white">
                      個人間送金サービスではありません
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">
                      KnowValue は、質問投稿・回答・BEST閲覧を通じて価値を流通させるQ&Aサービスです。閲覧料金は質問者と運営に分配され、回答者はBEST回答に選ばれた時点で質問投稿時の報酬を受け取ります。
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                    <div className="text-base font-bold text-white">
                      透明性のある収益構造
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">
                      何にお金が使われるのか、誰にどのような価値が還元されるのかを分かりやすく示すことで、安心して使える体験を目指しています。
                    </p>
                  </div>
                </div>
              </div>
            </div>

            <div className="mt-12">
              <SectionTitle
                title="3STEPで分かる KnowValue"
                subtitle="質問する人にも、答える人にも価値がある流れをシンプルに整理しています。"
              />

              <div className="grid gap-4 sm:grid-cols-3">
                <StepCard
                  step="STEP 1"
                  title="質問する"
                  desc="回答者への報酬を設定して質問します。背景や比較したことまで書くほど、良い回答が集まりやすくなります。"
                  delay={0.05}
                />
                <StepCard
                  step="STEP 2"
                  title="経験者から回答が届く"
                  desc="実体験ベースの回答が集まります。AIではなく、実際に経験した人の知見を受け取れます。"
                  delay={0.12}
                />
                <StepCard
                  step="STEP 3"
                  title="BEST回答を選ぶ"
                  desc="BEST回答に報酬が支払われます。価値ある回答は、有料公開によって継続的に評価されます。"
                  delay={0.19}
                />
              </div>
            </div>

            <motion.div
              className="mt-12 rounded-3xl border border-yellow-400/20 bg-black/45 p-6 sm:p-8"
              initial="hidden"
              whileInView="show"
              viewport={{ once: true, amount: 0.35 }}
              variants={softPop}
              custom={0.15}
            >
              <div className="grid gap-5 sm:grid-cols-[minmax(0,1.6fr)_minmax(220px,1fr)] sm:items-start">
                <div>
                  <div className="inline-flex items-center rounded-full border border-yellow-400/30 bg-yellow-400/10 px-3 py-1 text-xs font-semibold text-yellow-200">
                    継続的に価値が残る仕組み
                  </div>
                  <h3 className="mt-4 text-xl font-extrabold sm:text-2xl">
                    BEST回答は有料で公開できます。
                  </h3>
                  <p className="mt-3 text-sm leading-relaxed text-white/70 sm:text-base">
                    BEST回答の閲覧料は、質問者70%、KnowValue運営30%で分配されます。
                    良い質問そのものが、一度きりではなく継続的に評価される仕組みです。
                  </p>
                </div>
                <div className="grid gap-3 text-sm text-white/75">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    質問者70%
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    KnowValue運営30%
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    BEST回答者は選定時に報酬受取
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="mt-12">
              <SectionTitle
                title="よくある質問"
                subtitle="小規模β版の公開にあたって、よくある疑問を整理しています。"
              />

              <div className="grid gap-3">
                {FAQ_ITEMS.map((item) => (
                  <FaqItem
                    key={item.q}
                    q={item.q}
                    a={item.a}
                    defaultOpen={item.defaultOpen}
                  />
                ))}
              </div>
            </div>

            <div className="mt-14 text-center">
              <motion.div
                className="inline-flex flex-col gap-3 sm:flex-row sm:flex-wrap sm:justify-center"
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.35 }}
                variants={fadeUp}
                custom={0.05}
              >
                {user ? (
                  <>
                    <Link
                      href="/questions"
                      className="whitespace-nowrap rounded-full bg-yellow-400 px-6 py-3 text-sm font-extrabold text-black transition hover:bg-yellow-300 sm:px-7 sm:text-base"
                    >
                      質問一覧を見る
                    </Link>
                    <Link
                      href="/questions/new"
                      className="whitespace-nowrap rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm transition hover:bg-white/10 sm:px-7 sm:text-base"
                    >
                      質問する
                    </Link>
                    <Link
                      href="/mypage"
                      className="whitespace-nowrap rounded-full border border-yellow-400/30 bg-yellow-400/5 px-6 py-3 text-sm transition hover:bg-yellow-400/10 sm:px-7 sm:text-base"
                    >
                      マイページへ
                    </Link>
                  </>
                ) : (
                  <>
                    <Link
                      href="/signup"
                      className="whitespace-nowrap rounded-full bg-yellow-400 px-6 py-3 text-sm font-extrabold text-black transition hover:bg-yellow-300 sm:px-7 sm:text-base"
                    >
                      新規登録する
                    </Link>
                    <Link
                      href="/login"
                      className="whitespace-nowrap rounded-full border border-white/20 bg-white/5 px-6 py-3 text-sm transition hover:bg-white/10 sm:px-7 sm:text-base"
                    >
                      ログイン
                    </Link>
                    <Link
                      href="/questions"
                      className="whitespace-nowrap rounded-full border border-yellow-400/30 bg-yellow-400/5 px-6 py-3 text-sm transition hover:bg-yellow-400/10 sm:px-7 sm:text-base"
                    >
                      質問一覧を見る
                    </Link>
                  </>
                )}
              </motion.div>

              <motion.p
                className="mt-5 text-xs text-white/45"
                initial="hidden"
                whileInView="show"
                viewport={{ once: true, amount: 0.35 }}
                variants={fadeUp}
                custom={0.1}
              >
                ※ 小規模β版として運用中のため、仕様や表示は今後更新される場合があります
              </motion.p>
            </div>
          </div>
        </section>
      </div>
    </main>
  );
}
