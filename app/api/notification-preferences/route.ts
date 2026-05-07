import { NextResponse } from "next/server";
import { getCurrentUser } from "@/lib/auth";
import prisma from "@/lib/prisma";
import { ensureNotificationPreference } from "@/lib/notifications";

export async function GET() {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  const preference = await ensureNotificationPreference(user.id);
  return NextResponse.json(preference);
}

export async function PUT(req: Request) {
  const user = await getCurrentUser();

  if (!user) {
    return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
  }

  const body = await req.json().catch(() => ({}));

  const updated = await prisma.notificationPreference.upsert({
    where: { userId: user.id },
    update: {
      emailOnAnswerCreated: Boolean(body.emailOnAnswerCreated),
      emailOnCommentCreated: Boolean(body.emailOnCommentCreated),
      emailOnBestSelected: Boolean(body.emailOnBestSelected),
      emailOnNegotiationCreated: Boolean(body.emailOnNegotiationCreated),
      emailOnNegotiationAccepted: Boolean(body.emailOnNegotiationAccepted),
      emailOnCategoryQuestionCreated: Boolean(
        body.emailOnCategoryQuestionCreated
      ),
      emailOnLogin: Boolean(body.emailOnLogin),
    },
    create: {
      userId: user.id,
      emailOnAnswerCreated: Boolean(body.emailOnAnswerCreated),
      emailOnCommentCreated: Boolean(body.emailOnCommentCreated),
      emailOnBestSelected: Boolean(body.emailOnBestSelected),
      emailOnNegotiationCreated: Boolean(body.emailOnNegotiationCreated),
      emailOnNegotiationAccepted: Boolean(body.emailOnNegotiationAccepted),
      emailOnCategoryQuestionCreated: Boolean(
        body.emailOnCategoryQuestionCreated
      ),
      emailOnLogin: Boolean(body.emailOnLogin),
    },
  });

  return NextResponse.json(updated);
}
