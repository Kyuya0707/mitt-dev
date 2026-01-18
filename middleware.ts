// middleware.ts
import { NextResponse, type NextRequest } from "next/server";
import { createServerClient } from "@supabase/ssr";

const TEASER_MODE = true; // 公開時は false にするだけ

export async function middleware(req: NextRequest) {
  // --- 1) まず Supabase セッションを同期（ここが重要） ---
  let res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: any) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: any) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  // これを呼ぶことで、必要な cookie 更新が res に乗る
  await supabase.auth.getUser();

  // --- 2) ここからティザー制御 ---
  const { pathname } = req.nextUrl;

  // 常に許可（Welcome/ティザー/認証系）
  const allowedPrefixes = ["/", "/coming-soon", "/login", "/signup", "/auth"];

  const isAllowed = allowedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );
  if (isAllowed) return res;

  // ティザーOFFなら全部通す
  if (!TEASER_MODE) return res;

  // 開発中は止める（/mypage は止めない方針）
  const blockedPrefixes = [
    "/questions",
    "/payment",
    // "/api", // API止めたいならON
  ];

  const isBlocked = blockedPrefixes.some(
    (p) => pathname === p || pathname.startsWith(p + "/")
  );

  if (isBlocked) {
    const url = req.nextUrl.clone();
    url.pathname = "/coming-soon";
    url.searchParams.set("from", pathname);
    return NextResponse.redirect(url);
  }

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
