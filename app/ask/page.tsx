"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

export default function AskPage() {
  const router = useRouter();

  useEffect(() => {
    // 質問作成ページへリダイレクト
    router.replace("/questions/new");
  }, [router]);

  // 一瞬だけでも何か表示したいならここにローディング文言を足してOK
  return null;
}
