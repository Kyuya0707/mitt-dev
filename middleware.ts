import { NextResponse, type NextRequest } from "next/server";
import { createServerClient, type CookieOptions } from "@supabase/ssr";

const MAINTENANCE_MODE = process.env.MAINTENANCE_MODE === "true";
const MAINTENANCE_PATH = "/maintenance";
const MAINTENANCE_BYPASS_COOKIE = "kv_maintenance_bypass";

function isExcludedPath(pathname: string) {
  return (
    pathname === MAINTENANCE_PATH ||
    pathname.startsWith("/api/") ||
    pathname.startsWith("/_next/") ||
    pathname === "/favicon.ico" ||
    pathname === "/robots.txt" ||
    pathname === "/sitemap.xml" ||
    pathname.startsWith("/images/") ||
    pathname.startsWith("/public/")
  );
}

export async function middleware(req: NextRequest) {
  const { pathname } = req.nextUrl;

  if (!MAINTENANCE_MODE && pathname === "/coming-soon") {
    const returnTo = req.nextUrl.searchParams.get("from");

    if (returnTo && returnTo.startsWith("/") && !returnTo.startsWith("//")) {
      const url = req.nextUrl.clone();
      url.pathname = returnTo;
      url.search = "";
      return NextResponse.redirect(url);
    }
  }

  if (isExcludedPath(pathname)) {
    return NextResponse.next();
  }

  if (MAINTENANCE_MODE) {
    const bypassToken = req.cookies.get(MAINTENANCE_BYPASS_COOKIE)?.value;

    if (!bypassToken) {
      const url = req.nextUrl.clone();
      url.pathname = MAINTENANCE_PATH;
      url.searchParams.set("from", pathname);
      return NextResponse.redirect(url);
    }
  }

  const res = NextResponse.next();

  const supabase = createServerClient(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        get(name: string) {
          return req.cookies.get(name)?.value;
        },
        set(name: string, value: string, options: CookieOptions) {
          res.cookies.set({ name, value, ...options });
        },
        remove(name: string, options: CookieOptions) {
          res.cookies.set({ name, value: "", ...options });
        },
      },
    }
  );

  await supabase.auth.getUser();

  return res;
}

export const config = {
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|robots.txt|sitemap.xml).*)",
  ],
};
