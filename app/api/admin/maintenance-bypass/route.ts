import { NextResponse } from "next/server";

const MAINTENANCE_BYPASS_COOKIE = "kv_maintenance_bypass";

export async function GET(req: Request) {
  const url = new URL(req.url);
  const token = url.searchParams.get("token");
  const redirectTo = url.searchParams.get("redirectTo") || "/";
  const expectedToken = process.env.MAINTENANCE_BYPASS_TOKEN;

  if (!expectedToken || !token || token !== expectedToken) {
    return NextResponse.json({ error: "権限がありません" }, { status: 403 });
  }

  const res = NextResponse.redirect(new URL(redirectTo, url.origin));
  res.cookies.set({
    name: MAINTENANCE_BYPASS_COOKIE,
    value: expectedToken,
    httpOnly: true,
    secure: true,
    sameSite: "lax",
    maxAge: 60 * 60 * 24,
    path: "/",
  });

  return res;
}
