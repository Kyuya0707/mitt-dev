// lib/supabase-browser.ts
import { createBrowserClient } from "@supabase/ssr";

/**
 * 旧: supabaseBrowser()
 * いろんな所で使っているのでそのまま残す
 */
export const supabaseBrowser = () =>
  createBrowserClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  );

/**
 * ここ最近追加した createClientBrowser もエイリアスとして用意
 * どっちを使ってもOKにしておく
 */
export const createClientBrowser = () => supabaseBrowser();
