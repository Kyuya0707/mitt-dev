// lib/supabase-server.ts
import { cookies } from "next/headers";
import { createServerClient } from "@supabase/ssr";

export async function supabaseServer() {
  // ✅ 型が Promise なので await する
  const cookieStore = await cookies();

  return createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,        // Supabase の URL
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,  // ANON KEY（.env と合わせる）
    {
      cookies: {
        // 読み取りだけ本物の cookies() を使う
        get(name: string) {
          return cookieStore.get(name)?.value;
        },
        // Next.js 16 ではここで cookie を書き換えると怒られるので no-op にする
        set() {
          // no-op
        },
        remove() {
          // no-op
        },
      },
    }
  );
}
