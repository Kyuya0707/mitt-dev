// app/api/answers/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";
import { supabaseServer } from "@/lib/supabase-server";

const ANSWER_IMAGE_BUCKET_CANDIDATES = ["answer-images", "answers"] as const;

// ================================
// ファイル名を安全に変換
// ================================
function safeFileName(originalName: string) {
  return (
    Date.now() +
    "_" +
    originalName.replace(/[^\w.]+/g, "_").replace(/_+/g, "_")
  );
}

function buildStoragePublicUrl(bucket: string, filePath: string) {
  const baseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const encodedPath = filePath
    .split("/")
    .map((segment) => encodeURIComponent(segment))
    .join("/");

  if (!baseUrl) {
    throw new Error("NEXT_PUBLIC_SUPABASE_URL is not set");
  }

  return `${baseUrl}/storage/v1/object/public/${bucket}/${encodedPath}`;
}

function getSafeErrorMessage(error: unknown) {
  return error instanceof Error ? error.message : "unknown_error";
}

export async function POST(req: Request) {
  try {
    const supabase = await supabaseServer();

    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return NextResponse.json({ error: "ログインしてください" }, { status: 401 });
    }

    const formData = await req.formData();

    const content = formData.get("content")?.toString() ?? "";
    const pitch = formData.get("pitch")?.toString() ?? "";
    const proposedAmountRaw = formData.get("proposedAmount")?.toString();
    const questionId = formData.get("questionId")?.toString();
    const images = formData.getAll("images") as File[];
    const trimmedPitch = pitch.trim();
    const trimmedProposedAmount = proposedAmountRaw?.trim() ?? "";
    const hasNegotiationInput =
      trimmedPitch.length > 0 || trimmedProposedAmount.length > 0;

    if (!questionId) {
      return NextResponse.json(
        { error: "質問IDが不足しています" },
        { status: 400 }
      );
    }

    const question = await prisma.question.findUnique({
      where: { id: questionId },
      select: {
        id: true,
        title: true,
        userId: true,
        isClosed: true,
      },
    });

    if (!question) {
      return NextResponse.json(
        { error: "質問が見つかりません" },
        { status: 404 }
      );
    }

    if (question.userId === user.id) {
      return NextResponse.json(
        { error: "質問投稿者本人は回答できません" },
        { status: 403 }
      );
    }

    if (question.isClosed) {
      return NextResponse.json(
        { error: "この質問は受付終了しています" },
        { status: 403 }
      );
    }

    const hasContent = content.trim().length > 0;
    const hasImages = images.some((file) => file instanceof File && file.size > 0);

    if (!hasContent && !hasImages && !hasNegotiationInput) {
      return NextResponse.json(
        { error: "本文、画像、交渉内容のいずれかを入力してください" },
        { status: 400 }
      );
    }

    if (hasNegotiationInput) {
      if (!trimmedPitch) {
        return NextResponse.json(
          { error: "交渉メッセージを入力してください" },
          { status: 400 }
        );
      }

      const proposedAmount = Number(trimmedProposedAmount);

      if (!Number.isFinite(proposedAmount) || proposedAmount < 100) {
        return NextResponse.json(
          { error: "提案金額は100円以上で入力してください" },
          { status: 400 }
        );
      }
    }

    // ① Answer 登録と ② Negotiation 作成を同一 transaction にまとめる
    const { answer, negotiationId } = await prisma.$transaction(async (tx) => {
      const createdAnswer = await tx.answer.create({
        data: {
          content, // 本文は任意（後で必須/非表示にもできる）
          pitch: hasNegotiationInput ? trimmedPitch : null,
          questionId,
          userId: user.id,
        },
      });

      let createdNegotiationId: string | null = null;
      if (hasNegotiationInput) {
        const negotiation = await tx.negotiation.create({
          data: {
            proposedAmount: Number(trimmedProposedAmount),
            status: "PENDING",
            question: { connect: { id: questionId } },
            answer: { connect: { id: createdAnswer.id } },
          },
        });
        createdNegotiationId = negotiation.id;
      }

      return {
        answer: createdAnswer,
        negotiationId: createdNegotiationId,
      };
    });

    // ③ 画像アップロード
    let sortOrder = 0;

    for (const file of images) {
      if (!(file instanceof File) || file.size === 0) continue;

      const safeName = safeFileName(file.name);
      const filePath = `answers/${answer.id}_${safeName}`;
      const contentType = file.type || "application/octet-stream";
      const buffer = Buffer.from(await file.arrayBuffer());

      let uploadedBucket: string | null = null;
      let publicUrl: string | null = null;

      for (const bucket of ANSWER_IMAGE_BUCKET_CANDIDATES) {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, buffer, { contentType });

        if (uploadError) {
          console.error("[answers][image-upload] upload failed", {
            contentType,
            message: getSafeErrorMessage(uploadError),
          });
          continue;
        }

        supabase.storage.from(bucket).getPublicUrl(filePath);
        const normalizedPublicUrl = buildStoragePublicUrl(bucket, filePath);

        uploadedBucket = bucket;
        publicUrl = normalizedPublicUrl;
        break;
      }

      if (!uploadedBucket || !publicUrl) {
        console.error("[answers][image-upload] all buckets failed", {
          contentType,
          message: "all_candidate_uploads_failed",
        });
        continue;
      }

      await prisma.answerImage.create({
        data: {
          answerId: answer.id,
          url: publicUrl,
          sortOrder,
        },
      });

      sortOrder++;
    }

    const recipientUserId = question.userId;

    if (recipientUserId && recipientUserId !== user.id) {
      const answerNotificationInput = {
        userId: recipientUserId,
        actorUserId: user.id,
        type: NOTIFICATION_TYPES.ANSWER_CREATED,
        message: `あなたの質問に回答がつきました: ${question.title}`,
        url: `/questions/${question.id}?from=notification`,
        data: {
          questionId: question.id,
          answerId: answer.id,
        },
        context: "answer_created" as const,
      };

      await safeCreateUserNotification(answerNotificationInput);

      if (negotiationId) {
        await safeCreateUserNotification({
          userId: recipientUserId,
          actorUserId: user.id,
          type: NOTIFICATION_TYPES.NEGOTIATION_CREATED,
          message: `あなたの質問に交渉提案が届きました: ${question.title}`,
          url: `/questions/${question.id}?from=notification`,
          data: {
            questionId: question.id,
            answerId: answer.id,
            negotiationId,
          },
          context: "negotiation_created",
        });
      }
    }

    return NextResponse.json({ id: answer.id });
  } catch (error) {
    console.error("❌ POST /api/answers Error:", {
      message: getSafeErrorMessage(error),
    });
    return NextResponse.json({ error: "回答の投稿に失敗しました" }, { status: 500 });
  }
}
