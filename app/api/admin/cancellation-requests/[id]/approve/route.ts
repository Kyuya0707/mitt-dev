import { NextResponse } from "next/server";
import Stripe from "stripe";
import { getCurrentUserAdminStatus } from "@/lib/admin";
import {
  approveCancellationRequest,
  CancellationApprovalError,
} from "@/lib/cancellation-refund";
import { getSafeErrorMessage } from "@/lib/safe-error";

export const runtime = "nodejs";

function mapRefundErrorMessage(error: unknown) {
  if (error instanceof CancellationApprovalError) {
    return error.message;
  }

  const message = error instanceof Error ? error.message : "";
  const normalized = message.toLowerCase();

  if (normalized.includes("already") && normalized.includes("refund")) {
    return "すでに返金済みです";
  }

  if (
    error instanceof Stripe.errors.StripeInvalidRequestError ||
    normalized.includes("payment_intent")
  ) {
    return "返金対象の決済情報が見つかりません";
  }

  return "Stripe返金処理に失敗しました";
}

export async function POST(
  req: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const { user, canManageOperations } = await getCurrentUserAdminStatus();

  if (!user) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  if (!canManageOperations) {
    return NextResponse.json({ error: "管理者のみ利用できます" }, { status: 403 });
  }

  const { id } = await params;
  const body = (await req.json().catch(() => ({}))) as {
    adminNote?: string | null;
  };

  try {
    const result = await approveCancellationRequest({
      requestId: id,
      reviewedById: user.id,
      adminNote: body.adminNote,
    });

    return NextResponse.json({ ok: true, ...result });
  } catch (error) {
    console.error("Cancellation approve refund error:", {
      message: getSafeErrorMessage(error),
    });

    const status =
      error instanceof CancellationApprovalError
        ? error.code === "not_found"
          ? 404
          : error.code === "processing_conflict"
            ? 409
            : 400
        : 500;

    return NextResponse.json(
      { error: mapRefundErrorMessage(error) },
      { status }
    );
  }
}
