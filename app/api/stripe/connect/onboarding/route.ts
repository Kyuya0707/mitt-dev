import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getCurrentUser } from "@/lib/auth";
import { ensureConnectedAccountForUser } from "@/lib/stripe-connect";
import { getBaseUrl } from "@/lib/site-url";

export const runtime = "nodejs";

function getStripe() {
  const key = process.env.STRIPE_SECRET_KEY;

  if (!key) {
    throw new Error("STRIPE_SECRET_KEY is not set");
  }

  return new Stripe(key);
}

export async function POST(req: Request) {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    const accountResult = await ensureConnectedAccountForUser({
      id: user.id,
      email: user.email,
    });

    const baseUrl = getBaseUrl();

    const stripe = getStripe();
    const link = await stripe.accountLinks.create({
      account: accountResult.account.id,
      type: "account_onboarding",
      return_url: `${baseUrl}/mypage?connect=return`,
      refresh_url: `${baseUrl}/mypage?connect=refresh`,
    });

    return NextResponse.json({ url: link.url });
  } catch (error) {
    console.error("Stripe Connect onboarding link error:", error);
    return NextResponse.json(
      { error: "Stripe Connect オンボーディングURLの作成に失敗しました" },
      { status: 500 }
    );
  }
}
