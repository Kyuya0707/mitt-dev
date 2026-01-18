// app/coming-soon/page.tsx
"use client";

import Link from "next/link";
import { motion } from "framer-motion";

export default function ComingSoonPage() {
  return (
    <div className="min-h-dvh w-full bg-black text-white flex items-center justify-center overflow-hidden">
      {/* 背景：光のにじみ（黒×黄） */}
      <motion.div
        className="absolute -top-20 -left-20 w-80 h-80 rounded-full bg-yellow-400 blur-[140px]"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 0.85, scale: 1.1 }}
        transition={{ duration: 1.8 }}
      />
      <motion.div
        className="absolute -bottom-28 -right-24 w-96 h-96 rounded-full bg-yellow-300 blur-[160px]"
        initial={{ opacity: 0, scale: 0.6 }}
        animate={{ opacity: 0.55, scale: 1.15 }}
        transition={{ duration: 2.2, delay: 0.1 }}
      />

      {/* 粒子背景 */}
      <div className="absolute inset-0 opacity-[0.12]">
        <div
          className="w-full h-full"
          style={{
            backgroundImage:
              "radial-gradient(circle at 20% 30%, rgba(255,214,0,0.9) 0.5px, transparent 1px), radial-gradient(circle at 80% 60%, rgba(255,214,0,0.7) 0.5px, transparent 1px), radial-gradient(circle at 60% 20%, rgba(255,214,0,0.5) 0.5px, transparent 1px)",
            backgroundSize: "140px 140px",
          }}
        />
      </div>

      <div className="relative z-10 max-w-xl px-6 text-center">
        {/* ロゴ */}
        <motion.h1
          className="text-4xl sm:text-5xl font-extrabold tracking-wide mb-4"
          initial={{ opacity: 0, y: 26 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.9, delay: 0.25 }}
        >
          Know<span className="text-yellow-400">Value</span>
        </motion.h1>

        {/* ステータスバッジ */}
        <motion.div
          className="inline-flex items-center gap-2 px-4 py-2 rounded-full border border-yellow-400/40 bg-yellow-400/10 text-yellow-200 text-sm mb-6"
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.7, delay: 0.7 }}
        >
          <span className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
          現在準備中
        </motion.div>

        {/* 本文 */}
        <motion.p
          className="text-gray-200 leading-relaxed mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.0, delay: 1.0 }}
        >
          KnowValue は正式リリースに向けて
          <br />
          機能を一つひとつ丁寧に仕上げています。
          <br />
          <br />
          価値ある知識が正当に評価される場所を、
          <br />
          もうすぐお届けします。
        </motion.p>

        {/* ボタン（登録/ログインはWelcomeに集約） */}
        <motion.div
          className="flex flex-col sm:flex-row gap-3 justify-center"
          initial={{ opacity: 0, y: 18 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 1.6 }}
        >
          <Link
            href="/"
            className="px-6 py-3 rounded-full border border-yellow-400/30 bg-yellow-400/5 hover:bg-yellow-400/10 transition"
          >
            Welcomeに戻る
          </Link>
        </motion.div>

        <motion.div
          className="mt-10 text-xs text-gray-500"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ duration: 1.0, delay: 2.1 }}
        >
          © {new Date().getFullYear()} KnowValue
        </motion.div>
      </div>
    </div>
  );
}
