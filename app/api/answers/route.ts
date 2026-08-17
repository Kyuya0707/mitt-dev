// app/api/answers/route.ts
import { NextResponse } from "next/server";
import prisma from "@/lib/prisma";
import {
  NOTIFICATION_TYPES,
  safeCreateUserNotification,
} from "@/lib/notifications";
import { supabaseServer } from "@/lib/supabase-server";
import {
  ImageUploadValidationError,
  sanitizeUploadImages,
} from "@/lib/image-upload";
import {
  buildPrivateAnswerImageReference,
  PRIVATE_ANSWER_IMAGE_BUCKET,
} from "@/lib/answer-image-storage";
import { validateUserContentLinks } from "@/lib/content-policy";

const ANSWER_IMAGE_BUCKET_CANDIDATES = [PRIVATE_ANSWER_IMAGE_BUCKET] as const;

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

    const postingUser = await prisma.user.findUnique({
      where: { id: user.id },
      select: {
        ageConfirmedAt: true,
        stripeConnectOnboardingCompleted: true,
        stripeConnectDetailsSubmitted: true,
        suspendedUntil: true,
        permanentlySuspendedAt: true,
        deletedAt: true,
      },
    });

    if (!postingUser?.ageConfirmedAt) {
      return NextResponse.json(
        { error: "回答を投稿するには、マイページで18歳以上の確認が必要です。" },
        { status: 403 }
      );
    }

    if (
      postingUser.deletedAt ||
      postingUser.permanentlySuspendedAt ||
      (postingUser.suspendedUntil && postingUser.suspendedUntil > new Date())
    ) {
      return NextResponse.json(
        { error: "利用停止中のため回答・交渉を投稿できません" },
        { status: 403 }
      );
    }

    if (
      !postingUser.stripeConnectOnboardingCompleted ||
      !postingUser.stripeConnectDetailsSubmitted
    ) {
      return NextResponse.json(
        {
          error:
            "初回投稿前に、マイページでStripeの本人確認・受取設定を完了してください。",
        },
        { status: 403 }
      );
    }

    const formData = await req.formData();

    const content = formData.get("content")?.toString() ?? "";
    const pitch = formData.get("pitch")?.toString() ?? "";
    const proposedAmountRaw = formData.get("proposedAmount")?.toString();
    const questionId = formData.get("questionId")?.toString();
    const noAiConfirmed = formData.get("noAiConfirmed") === "true";
    let images;
    try {
      images = await sanitizeUploadImages(formData.getAll("images"));
    } catch (error) {
      if (error instanceof ImageUploadValidationError) {
        return NextResponse.json({ error: error.message }, { status: 400 });
      }
      throw error;
    }
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

    if (!noAiConfirmed) {
      return NextResponse.json(
        { error: "AIを使用していないことへの確認が必要です" },
        { status: 400 }
      );
    }

    const contentPolicy = validateUserContentLinks(`${content}\n${pitch}`);
    if (!contentPolicy.ok) {
      return NextResponse.json(
        { error: contentPolicy.message },
        { status: 400 }
      );
    }

    const question = await prisma.question.findFirst({
      where: {
        id: questionId,
        isPaid: true,
        cancellationRequests: { none: { status: "approved" } },
      },
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

    const existingAnswer = await prisma.answer.findFirst({
      where: {
        questionId,
        userId: user.id,
      },
      select: { id: true },
    });

    if (existingAnswer) {
      return NextResponse.json(
        { error: "一つの質問に投稿できる回答は一件までです" },
        { status: 409 }
      );
    }

    const hasContent = content.trim().length > 0;
    const hasImages = images.length > 0;

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

      if (hasContent || hasImages) {
        return NextResponse.json(
          {
            error:
              "交渉提案時は回答本文・画像を送信できません。承認後7日以内に回答を投稿してください",
          },
          { status: 400 }
        );
      }
    } else if (!hasContent && !hasImages) {
      return NextResponse.json(
        { error: "回答本文または画像を入力してください" },
        { status: 400 }
      );
    }

    // ① Answer 登録と ② Negotiation 作成を同一 transaction にまとめる
    const { answer, negotiationId } = await prisma.$transaction(async (tx) => {
      const createdAnswer = await tx.answer.create({
        data: {
          content: hasNegotiationInput ? "" : content,
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

    for (const image of hasNegotiationInput ? [] : images) {
      const safeName = safeFileName(image.originalName);
      const filePath = `answers/${answer.id}_${safeName}`;
      const contentType = image.contentType;

      let uploadedBucket: string | null = null;
      let publicUrl: string | null = null;

      for (const bucket of ANSWER_IMAGE_BUCKET_CANDIDATES) {
        const { error: uploadError } = await supabase.storage
          .from(bucket)
          .upload(filePath, image.buffer, { contentType });

        if (uploadError) {
          console.error("[answers][image-upload] upload failed", {
            contentType,
            message: getSafeErrorMessage(uploadError),
          });
          continue;
        }

        const normalizedPublicUrl = buildPrivateAnswerImageReference(
          bucket,
          filePath
        );

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
      } else {
        await safeCreateUserNotification(answerNotificationInput);
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
