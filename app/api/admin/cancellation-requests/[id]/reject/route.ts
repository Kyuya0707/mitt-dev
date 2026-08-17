import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import { getCurrentUserAdminStatus } from "@/lib/admin";
import { sendCancellationRejectedEmail } from "@/lib/cancellation-notifications";

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

  const requestRecord = await prisma.cancellationRequest.findUnique({
    where: { id },
    include: {
      requester: {
        select: {
          email: true,
        },
      },
      question: {
        select: {
          id: true,
          title: true,
        },
      },
    },
  });

  if (!requestRecord) {
    return NextResponse.json(
      { error: "キャンセル申請が見つかりません" },
      { status: 404 }
    );
  }

  if (requestRecord.status !== "pending") {
    return NextResponse.json(
      { error: "pending の申請のみ却下できます" },
      { status: 400 }
    );
  }

  const reviewedAt = new Date();
  const updated = await prisma.cancellationRequest.updateMany({
    where: {
      id: requestRecord.id,
      status: "pending",
    },
    data: {
      status: "rejected",
      adminNote: body.adminNote?.trim() || null,
      reviewedAt,
      reviewedById: user.id,
    },
  });

  if (updated.count === 0) {
    return NextResponse.json(
      { error: "この申請はすでに処理されています" },
      { status: 409 }
    );
  }

  await prisma.eventLog.create({
    data: {
      type: "cancellation_request_rejected",
      payload: {
        cancellationRequestId: requestRecord.id,
        questionId: requestRecord.question.id,
        reviewedById: user.id,
        adminNote: body.adminNote?.trim() || null,
      },
    },
  });

  if (requestRecord.requester.email) {
    void sendCancellationRejectedEmail({
      to: requestRecord.requester.email,
      questionId: requestRecord.question.id,
      questionTitle: requestRecord.question.title,
      adminNote: body.adminNote?.trim() || null,
    });
  }

  return NextResponse.json({ ok: true });
}
