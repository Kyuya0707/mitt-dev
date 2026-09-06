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

const ACTIVE_CATEGORIES = [
  "育児・子育て",
  "転職・キャリア",
  "プログラミング・IT",
  "仕事術・職場の悩み",
  "学習・資格",
  "恋愛・人間関係",
  "暮らし・家事",
  "旅行・地域情報",
  "趣味・創作",
  "商品選び・購入体験",
] as const;

const PROHIBITED_TOPICS = [
  "投資・暗号資産などの金融分野",
  "医療診断・治療判断",
  "法律判断・個別の法的助言",
  "ギャンブル・占い",
  "転売利益を目的とする手法",
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
                あなたの経験は、
                <br />
                <span className="text-yellow-300">AIよりも価値がある。</span>
              </motion.p>

              <motion.p
                className="mt-4 text-sm leading-relaxed text-yellow-100/90 sm:text-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.0, delay: 0.68 }}
              >
                あなたの経験が、
                <br className="sm:hidden" />
                誰かの答えになる。
              </motion.p>

              <motion.p
                className="mt-4 text-sm leading-relaxed text-white/65 sm:text-base"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.0, delay: 0.8 }}
              >
                質問者は500円以上の報酬を設定して質問でき、回答者は実体験を自分の言葉で届けられます。
                <br />
                BEST回答者には質問報酬の90%を還元。広告なし・AI投稿禁止の有料Q&amp;Aです。
              </motion.p>

              <motion.p
                className="mt-3 text-xs leading-relaxed text-white/45"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ duration: 1.0, delay: 0.9 }}
              >
                18歳以上対象・初回投稿前の本人確認必須／公開名はニックネームのみ
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
              <FeatureCard
                icon="✍️"
                title="AIではなく、自分の言葉で"
                desc="AIによる生成・要約・翻訳・校正・編集を禁止し、人が実際に得た経験と知見を守ります。"
                delay={0.26}
              />
              <FeatureCard
                icon="🚫"
                title="広告を掲載しない"
                desc="広告主の都合ではなく、質問と回答そのものの価値を中心に設計しています。"
                delay={0.33}
              />
              <FeatureCard
                icon="🏅"
                title="信頼と実績を見える形に"
                desc="本人確認、信頼スコア、ランク、BEST回答数を通じて、安心して相手を選べるようにします。"
                delay={0.4}
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
                  desc="質問者は回答の中から BEST回答 を選択でき、BEST回答は有料コンテンツとして公開されます。閲覧料金は質問者50%、BEST回答者20%、KnowValue運営30%で分配されます。"
                />
                <InfoCard
                  title="報酬受取はStripe Connect"
                  desc="報酬の受取には、Stripe Connect を利用した本人確認・口座登録が必要です。KnowValue は銀行口座などの金融情報を直接保持しません。"
                />
              </div>
            </div>

            <div className="mt-12">
              <SectionTitle
                title="相談できるカテゴリー"
                subtitle="実際に経験した人だからこそ答えられる、生活と仕事の知見を扱います。"
              />

              <div className="rounded-3xl border border-white/10 bg-white/[0.025] p-5 sm:p-7">
                <div className="flex flex-wrap justify-center gap-2">
                  {ACTIVE_CATEGORIES.map((category) => (
                    <span
                      key={category}
                      className="rounded-full border border-yellow-400/25 bg-yellow-400/[0.08] px-3 py-2 text-xs font-semibold text-yellow-100 sm:text-sm"
                    >
                      {category}
                    </span>
                  ))}
                </div>

                <div className="mt-6 border-t border-white/10 pt-5">
                  <p className="text-center text-sm font-bold text-white">
                    安全性と法令遵守のため、取り扱わない分野
                  </p>
                  <p className="mt-2 text-center text-xs leading-relaxed text-white/55 sm:text-sm">
                    {PROHIBITED_TOPICS.join("／")}
                  </p>
                </div>
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
                      5. 閲覧料金の50%を質問者、20%をBEST回答者、30%をKnowValue運営へ分配します
                    </div>
                  </div>
                </div>

                <div className="grid gap-4">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-5 sm:p-6">
                    <div className="text-base font-bold text-white">
                      個人間送金サービスではありません
                    </div>
                    <p className="mt-2 text-sm leading-relaxed text-white/70">
                      KnowValue は、質問投稿・回答・BEST閲覧を通じて価値を流通させるQ&Aサービスです。閲覧料金は質問者、BEST回答者、運営に分配され、回答者はBEST回答に選ばれた時点で質問投稿時の報酬も受け取ります。
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
                  desc="500円以上の報酬と回答期限を設定し、報酬に10%の利用料を加えて支払います。期限を過ぎるとキャンセル申請が可能です。"
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
                  desc="BEST回答者へ質問報酬の90%を付与します。BEST回答は有料公開され、購入後は恒久的に閲覧できます。"
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
                    BEST回答の閲覧料は、質問者50%、BEST回答者20%、KnowValue運営30%で分配されます。
                    良い質問と価値ある回答の両方が、継続的に評価される仕組みです。
                  </p>
                </div>
                <div className="grid gap-3 text-sm text-white/75">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    質問者50%
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    BEST回答者20%
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    KnowValue運営30%
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    BEST回答者は選定時の質問報酬も受取
                  </div>
                </div>
              </div>
            </motion.div>

            <div className="mt-12 text-center">
              <Link
                href="/faq"
                className="inline-flex items-center rounded-full border border-yellow-400/30 bg-yellow-400/10 px-6 py-3 text-sm font-bold text-yellow-100 transition hover:bg-yellow-400/20"
              >
                よくある質問を見る
                <span aria-hidden="true" className="ml-2">→</span>
              </Link>
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
