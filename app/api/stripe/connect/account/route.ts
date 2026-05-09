import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import { ensureConnectedAccountForUser } from "@/lib/stripe-connect";
import { getSafeErrorMessage } from "@/lib/safe-error";

export const runtime = "nodejs";

export async function POST() {
  try {
    const user = await getCurrentUser();

    if (!user) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    if (!process.env.STRIPE_SECRET_KEY) {
      return NextResponse.json(
        { error: "STRIPE_SECRET_KEY is not set" },
        { status: 500 }
      );
    }

    const result = await ensureConnectedAccountForUser({
      id: user.id,
      email: user.email,
    });

    return NextResponse.json({
      accountId: result.account.id,
      onboardingCompleted: result.user.stripeConnectOnboardingCompleted,
      chargesEnabled: result.user.stripeConnectChargesEnabled,
      payoutsEnabled: result.user.stripeConnectPayoutsEnabled,
      detailsSubmitted: result.user.stripeConnectDetailsSubmitted,
    });
  } catch (error) {
    console.error("Stripe Connect account create error:", {
      message: getSafeErrorMessage(error),
    });
    return NextResponse.json(
      { error: "Stripe Connect アカウント作成に失敗しました" },
      { status: 500 }
    );
  }
}
