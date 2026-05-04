import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TARGET_QUESTION_IDS = [
  "cmmxuwwy40001fowrlolpkwph",
  "cmmqdba9u0001fo2owykici4u",
  "cmmqd4d2x0001fo0ggzrj6yxe",
  "cmmp316sk0001foqhvt001p4a",
  "cmmp21yj20001fohzu2wdzvoh",
] as const;

const TARGET_ANSWER_IDS_WITHOUT_NEGOTIATION = [
  "cmmxumhhx0005fom03wof60bx",
  "cmmxum30g0001fom0xmu16q6p",
  "cmmr3nu7k0001fo4c6vs7hrm6",
] as const;

const TARGET_NEGOTIATION_IDS = [
  "cmmxv8ofh0004fo2d9corggsd",
] as const;

const TARGET_ANSWER_IDS_FROM_NEGOTIATIONS = [
  "cmmxv8o6u0003fo2dqfo9crxr",
] as const;

const TARGET_ANSWER_IDS = [
  ...TARGET_ANSWER_IDS_WITHOUT_NEGOTIATION,
  ...TARGET_ANSWER_IDS_FROM_NEGOTIATIONS,
] as const;

type ParsedArgs = {
  dryRun: boolean;
};

type DeleteCounts = {
  answerImages: number;
  comments: number;
  answerReads: number;
  answerLikes: number;
  reportsOnAnswers: number;
  reportsOnQuestions: number;
  negotiations: number;
  answers: number;
  purchases: number;
  notifications: number;
  questionImages: number;
  questions: number;
};

function parseArgs(argv: string[]): ParsedArgs {
  const dryRunArg = argv.find((arg) => arg.startsWith("--dry-run="));
  const dryRun = dryRunArg ? dryRunArg.split("=")[1] !== "false" : true;
  return { dryRun };
}

function divider(title: string) {
  console.log(`\n=== ${title} ===`);
}

function questionUrl(questionId: string) {
  return `/questions/${questionId}`;
}

function dedupe<T>(values: readonly T[]) {
  return Array.from(new Set(values));
}

async function assertTargetsExist() {
  const [questions, answers, negotiations] = await Promise.all([
    prisma.question.findMany({
      where: { id: { in: [...TARGET_QUESTION_IDS] } },
      select: {
        id: true,
        title: true,
        isPaid: true,
        bestAnswerId: true,
        isClosed: true,
        viewerPrice: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.answer.findMany({
      where: { id: { in: [...TARGET_ANSWER_IDS] } },
      select: {
        id: true,
        questionId: true,
        userId: true,
        pitch: true,
        content: true,
        createdAt: true,
        negotiation: {
          select: {
            id: true,
            status: true,
          },
        },
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.negotiation.findMany({
      where: { id: { in: [...TARGET_NEGOTIATION_IDS] } },
      select: {
        id: true,
        answerId: true,
        questionId: true,
        proposedAmount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const missingQuestions = TARGET_QUESTION_IDS.filter(
    (id) => !questions.some((question) => question.id === id)
  );
  const missingAnswers = TARGET_ANSWER_IDS.filter(
    (id) => !answers.some((answer) => answer.id === id)
  );
  const missingNegotiations = TARGET_NEGOTIATION_IDS.filter(
    (id) => !negotiations.some((negotiation) => negotiation.id === id)
  );

  if (missingQuestions.length || missingAnswers.length || missingNegotiations.length) {
    throw new Error(
      [
        missingQuestions.length
          ? `Missing question IDs: ${missingQuestions.join(", ")}`
          : null,
        missingAnswers.length ? `Missing answer IDs: ${missingAnswers.join(", ")}` : null,
        missingNegotiations.length
          ? `Missing negotiation IDs: ${missingNegotiations.join(", ")}`
          : null,
      ]
        .filter(Boolean)
        .join(" | ")
    );
  }

  const answersReferencedAsBest = await prisma.question.findMany({
    where: {
      bestAnswerId: { in: [...TARGET_ANSWER_IDS] },
      id: { notIn: [...TARGET_QUESTION_IDS] },
    },
    select: {
      id: true,
      title: true,
      bestAnswerId: true,
    },
  });

  if (answersReferencedAsBest.length > 0) {
    throw new Error(
      `Refusing to delete BEST answers still referenced by non-target questions: ${answersReferencedAsBest
        .map((question) => `${question.id} -> ${question.bestAnswerId}`)
        .join(", ")}`
    );
  }

  return { questions, answers, negotiations };
}

async function collectDeletePreview() {
  const targetQuestionIds = [...TARGET_QUESTION_IDS];
  const targetAnswerIds = [...TARGET_ANSWER_IDS];
  const targetNegotiationIds = [...TARGET_NEGOTIATION_IDS];
  const questionUrls = targetQuestionIds.map(questionUrl);

  const [
    answerImages,
    comments,
    answerReads,
    answerLikes,
    reportsOnAnswers,
    reportsOnQuestions,
    purchases,
    notifications,
    questionImages,
  ] = await Promise.all([
    prisma.answerImage.findMany({
      where: { answerId: { in: targetAnswerIds } },
      select: { id: true, answerId: true, url: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.comment.findMany({
      where: { answerId: { in: targetAnswerIds } },
      select: { id: true, answerId: true, userId: true, content: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.answerRead.findMany({
      where: { answerId: { in: targetAnswerIds } },
      select: { id: true, answerId: true, userId: true, readAt: true },
      orderBy: { readAt: "asc" },
    }),
    prisma.answerLike.findMany({
      where: { answerId: { in: targetAnswerIds } },
      select: { answerId: true, userId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.report.findMany({
      where: { answerId: { in: targetAnswerIds } },
      select: { id: true, answerId: true, reporterId: true, reason: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.report.findMany({
      where: { questionId: { in: targetQuestionIds } },
      select: { id: true, questionId: true, reporterId: true, reason: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.purchase.findMany({
      where: { questionId: { in: targetQuestionIds } },
      select: { id: true, questionId: true, userId: true, amount: true, status: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.notification.findMany({
      where: { url: { in: questionUrls } },
      select: { id: true, userId: true, type: true, url: true, message: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.questionImage.findMany({
      where: { questionId: { in: targetQuestionIds } },
      select: { id: true, questionId: true, url: true, sortOrder: true },
      orderBy: [{ questionId: "asc" }, { sortOrder: "asc" }],
    }),
  ]);

  return {
    answerImages,
    comments,
    answerReads,
    answerLikes,
    reportsOnAnswers,
    reportsOnQuestions,
    purchases,
    notifications,
    questionImages,
    counts: {
      answerImages: answerImages.length,
      comments: comments.length,
      answerReads: answerReads.length,
      answerLikes: answerLikes.length,
      reportsOnAnswers: reportsOnAnswers.length,
      reportsOnQuestions: reportsOnQuestions.length,
      negotiations: targetNegotiationIds.length,
      answers: targetAnswerIds.length,
      purchases: purchases.length,
      notifications: notifications.length,
      questionImages: questionImages.length,
      questions: targetQuestionIds.length,
    } satisfies DeleteCounts,
  };
}

function printRows(rows: unknown[]) {
  if (rows.length === 0) {
    console.log("0件");
    return;
  }

  for (const row of rows) {
    console.log(JSON.stringify(row, null, 2));
  }
}

function printPlanSummary(counts: DeleteCounts) {
  console.log(
    JSON.stringify(
      {
        targetQuestions: TARGET_QUESTION_IDS.length,
        targetAnswersWithoutNegotiation: TARGET_ANSWER_IDS_WITHOUT_NEGOTIATION.length,
        targetNegotiations: TARGET_NEGOTIATION_IDS.length,
        targetAnswersFromNegotiations: TARGET_ANSWER_IDS_FROM_NEGOTIATIONS.length,
        deleteCounts: counts,
      },
      null,
      2
    )
  );
}

async function performDelete() {
  const questionIds = dedupe(TARGET_QUESTION_IDS);
  const answerIds = dedupe(TARGET_ANSWER_IDS);
  const negotiationIds = dedupe(TARGET_NEGOTIATION_IDS);
  const notificationUrls = questionIds.map(questionUrl);

  return prisma.$transaction(async (tx) => {
    const counts: DeleteCounts = {
      answerImages: await tx.answerImage.deleteMany({
        where: { answerId: { in: answerIds } },
      }).then((result: { count: number }) => result.count),
      comments: await tx.comment.deleteMany({
        where: { answerId: { in: answerIds } },
      }).then((result: { count: number }) => result.count),
      answerReads: await tx.answerRead.deleteMany({
        where: { answerId: { in: answerIds } },
      }).then((result: { count: number }) => result.count),
      answerLikes: await tx.answerLike.deleteMany({
        where: { answerId: { in: answerIds } },
      }).then((result: { count: number }) => result.count),
      reportsOnAnswers: await tx.report.deleteMany({
        where: { answerId: { in: answerIds } },
      }).then((result: { count: number }) => result.count),
      reportsOnQuestions: await tx.report.deleteMany({
        where: { questionId: { in: questionIds } },
      }).then((result: { count: number }) => result.count),
      negotiations: await tx.negotiation.deleteMany({
        where: { id: { in: negotiationIds } },
      }).then((result: { count: number }) => result.count),
      answers: await tx.answer.deleteMany({
        where: { id: { in: answerIds } },
      }).then((result: { count: number }) => result.count),
      purchases: await tx.purchase.deleteMany({
        where: { questionId: { in: questionIds } },
      }).then((result: { count: number }) => result.count),
      notifications: await tx.notification.deleteMany({
        where: { url: { in: notificationUrls } },
      }).then((result: { count: number }) => result.count),
      questionImages: await tx.questionImage.deleteMany({
        where: { questionId: { in: questionIds } },
      }).then((result: { count: number }) => result.count),
      questions: await tx.question.deleteMany({
        where: { id: { in: questionIds } },
      }).then((result: { count: number }) => result.count),
    };

    return counts;
  });
}

async function main() {
  const { dryRun } = parseArgs(process.argv.slice(2));

  divider("cleanup target");
  console.log(`dryRun=${dryRun}`);
  console.log(`questionIds=${TARGET_QUESTION_IDS.join(", ")}`);
  console.log(
    `answerIdsWithoutNegotiation=${TARGET_ANSWER_IDS_WITHOUT_NEGOTIATION.join(", ")}`
  );
  console.log(`negotiationIds=${TARGET_NEGOTIATION_IDS.join(", ")}`);
  console.log(
    `answerIdsFromNegotiations=${TARGET_ANSWER_IDS_FROM_NEGOTIATIONS.join(", ")}`
  );

  const targets = await assertTargetsExist();
  const preview = await collectDeletePreview();

  divider("summary");
  printPlanSummary(preview.counts);

  divider("questions");
  printRows(targets.questions);

  divider("answers");
  printRows(targets.answers);

  divider("negotiations");
  printRows(targets.negotiations);

  divider("answerImages");
  printRows(preview.answerImages);

  divider("comments");
  printRows(preview.comments);

  divider("answerReads");
  printRows(preview.answerReads);

  divider("answerLikes");
  printRows(preview.answerLikes);

  divider("reportsOnAnswers");
  printRows(preview.reportsOnAnswers);

  divider("reportsOnQuestions");
  printRows(preview.reportsOnQuestions);

  divider("purchases");
  printRows(preview.purchases);

  divider("notifications");
  printRows(preview.notifications);

  divider("questionImages");
  printRows(preview.questionImages);

  if (dryRun) {
    divider("result");
    console.log("dry-run only. Nothing was deleted.");
    return;
  }

  const deleted = await performDelete();

  divider("deleted");
  console.log(JSON.stringify(deleted, null, 2));
}

main()
  .catch((error) => {
    console.error("❌ cleanup failed");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
