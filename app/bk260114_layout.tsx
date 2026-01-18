import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

import Header from "./components/Header";
import { NotificationProvider } from "./context/NotificationContext";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  title: "知恵袋（仮）",
  description: "質問する・回答する・BESTを選ぶQ&Aサービス",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body
        className={`${geistSans.variable} ${geistMono.variable} antialiased bg-gray-100 min-h-screen`}
      >
        {/* ⭐ 通知コンテキスト（全体を包む） */}
        <NotificationProvider>
          {/* ⭐ モーダル用ポータル */}
          <div id="modal-root"></div>

          {/* ⭐ 共通ヘッダー */}
          <Header />

          {/* ⭐ ページ内容 */}
          <div className="max-w-4xl mx-auto py-6">
            {children}
          </div>
        </NotificationProvider>
      </body>
    </html>
  );
}
