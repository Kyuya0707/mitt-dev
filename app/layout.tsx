import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "KnowValue",
  description: "暗闇の中から、本当に価値ある情報を見つけ出す。",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="ja">
      <body className="min-h-screen">{children}</body>
    </html>
  );
}
