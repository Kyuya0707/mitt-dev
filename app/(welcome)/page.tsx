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

export default function WelcomePage() {
  const year = useMemo(() => new Date().getFullYear(), []);
  const [user, setUser] = useState<User | null>(null);

  useEffect(() => {
    const supabase = supabaseBrowser();

    const fetchUser = async () => {
      const { data, error } = await supabase.auth.getUser();
      if (error) {
        console.warn("⚠️ Supabase getUser error:", error.message);
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
                    閲覧料金は質問者・回答者へ分配されます。価値ある実体験が、
                    一度きりではなく継続的に評価される仕組みです。
                  </p>
                </div>
                <div className="grid gap-3 text-sm text-white/75">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    質問者へ還元
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    回答者へ還元
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-3">
                    KnowValue運営維持
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
                <FaqItem
                  q="KnowValueは今すぐ全部使えますか？"
                  a="現在は小規模β版として運用しています。基本機能は利用できますが、改善や調整を継続しながら順次安定化を進めています。"
                  defaultOpen
                />
                <FaqItem
                  q="なぜ黒と黄色？"
                  a="暗闇（ノイズ）から光（価値）を見つける、というコンセプトの視覚化です。視認性と印象の強さも大事にしています。"
                />
                <FaqItem
                  q="どんな人に向いていますか？"
                  a="本気で“答え”が欲しい人、そして経験を正しく評価してもらいたい人。仕事・生活・投資・キャリアなど、実体験が強い領域ほど相性が良いです。"
                />
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
