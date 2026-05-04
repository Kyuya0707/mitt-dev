import { createRequire } from "module";

const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

const prisma = new PrismaClient();

const TEST_KEYWORDS = [
  "test",
  "テスト",
  "dummy",
  "sample",
  "debug",
  "dev",
  "tmp",
  "temp",
  "mock",
  "sandbox",
  "確認用",
];

type Row = Record<string, unknown>;

function divider(title: string) {
  console.log(`\n=== ${title} ===`);
}

function printRows(rows: Row[], limit = 20) {
  if (rows.length === 0) {
    console.log("0件");
    return;
  }

  for (const row of rows.slice(0, limit)) {
    console.log(JSON.stringify(row, null, 2));
  }

  if (rows.length > limit) {
    console.log(`... ${rows.length - limit}件省略`);
  }
}

function containsTestKeyword(value: string | null | undefined) {
  if (!value) return false;

  const normalized = value.toLowerCase();
  return TEST_KEYWORDS.some((keyword) => normalized.includes(keyword));
}

function getDatabaseHost() {
  const databaseUrl = process.env.DATABASE_URL;

  if (!databaseUrl) return "DATABASE_URL not set";

  try {
    return new URL(databaseUrl).hostname;
  } catch {
    return "invalid DATABASE_URL";
  }
}

async function findAnswersWithoutNegotiation() {
  const answers = await prisma.answer.findMany({
    where: {
      pitch: { not: null },
      negotiation: null,
    },
    select: {
      id: true,
      createdAt: true,
      questionId: true,
      userId: true,
      pitch: true,
      content: true,
    },
    orderBy: { createdAt: "desc" },
  });

  return answers.map((answer) => ({
    id: answer.id,
    createdAt: answer.createdAt.toISOString(),
    questionId: answer.questionId,
    userId: answer.userId,
    pitchPreview: answer.pitch?.slice(0, 80) ?? null,
    contentPreview: answer.content.slice(0, 80),
  }));
}

async function findSuspiciousUnpaidQuestions() {
  const questions = await prisma.question.findMany({
    where: {
      isPaid: false,
      OR: [
        { bestAnswerId: { not: null } },
        { isClosed: true },
        { viewerPrice: { not: null } },
        { boostCount: { gt: 0 } },
        { answers: { some: {} } },
        { purchases: { some: {} } },
      ],
    },
    select: {
      id: true,
      title: true,
      createdAt: true,
      userId: true,
      rewardAmount: true,
      viewerPrice: true,
      bestAnswerId: true,
      isClosed: true,
      boostCount: true,
      _count: {
        select: {
          answers: true,
          purchases: true,
        },
      },
    },
    orderBy: { createdAt: "desc" },
  });

  return questions.map((question) => {
    const reasons: string[] = [];

    if (question.bestAnswerId) reasons.push("bestAnswerIdあり");
    if (question.isClosed) reasons.push("isClosed=true");
    if (question.viewerPrice !== null) reasons.push("viewerPrice設定あり");
    if (question.boostCount > 0) reasons.push("boostCount>0");
    if (question._count.answers > 0) reasons.push("answerあり");
    if (question._count.purchases > 0) reasons.push("purchaseあり");

    return {
      id: question.id,
      createdAt: question.createdAt.toISOString(),
      title: question.title,
      userId: question.userId,
      rewardAmount: question.rewardAmount,
      reasons,
      answerCount: question._count.answers,
      purchaseCount: question._count.purchases,
    };
  });
}

async function findSuspiciousTestData() {
  const [users, questions, answers, negotiations] = await Promise.all([
    prisma.user.findMany({
      where: {
        OR: [
          ...TEST_KEYWORDS.map((keyword) => ({
            email: { contains: keyword, mode: "insensitive" as const },
          })),
          ...TEST_KEYWORDS.map((keyword) => ({
            name: { contains: keyword, mode: "insensitive" as const },
          })),
        ],
      },
      select: {
        id: true,
        email: true,
        name: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.question.findMany({
      where: {
        OR: [
          ...TEST_KEYWORDS.map((keyword) => ({
            title: { contains: keyword, mode: "insensitive" as const },
          })),
          ...TEST_KEYWORDS.map((keyword) => ({
            content: { contains: keyword, mode: "insensitive" as const },
          })),
        ],
      },
      select: {
        id: true,
        title: true,
        content: true,
        userId: true,
        createdAt: true,
        isPaid: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.answer.findMany({
      where: {
        OR: [
          ...TEST_KEYWORDS.map((keyword) => ({
            content: { contains: keyword, mode: "insensitive" as const },
          })),
          ...TEST_KEYWORDS.map((keyword) => ({
            pitch: { contains: keyword, mode: "insensitive" as const },
          })),
        ],
      },
      select: {
        id: true,
        questionId: true,
        userId: true,
        content: true,
        pitch: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
    prisma.negotiation.findMany({
      where: {
        answer: {
          OR: [
            ...TEST_KEYWORDS.map((keyword) => ({
              content: { contains: keyword, mode: "insensitive" as const },
            })),
            ...TEST_KEYWORDS.map((keyword) => ({
              pitch: { contains: keyword, mode: "insensitive" as const },
            })),
          ],
        },
      },
      select: {
        id: true,
        answerId: true,
        proposedAmount: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: "desc" },
    }),
  ]);

  const heuristicQuestions = await prisma.question.findMany({
    where: {
      createdAt: { gte: new Date(Date.now() - 1000 * 60 * 60 * 24 * 14) },
    },
    select: {
      id: true,
      title: true,
      content: true,
      userId: true,
      createdAt: true,
      isPaid: true,
    },
    orderBy: { createdAt: "desc" },
    take: 200,
  });

  const heuristicMatches = heuristicQuestions
    .filter(
      (question) =>
        containsTestKeyword(question.title) || containsTestKeyword(question.content)
    )
    .map((question) => ({
      id: question.id,
      createdAt: question.createdAt.toISOString(),
      title: question.title,
      userId: question.userId,
      isPaid: question.isPaid,
      source: "recent-keyword-match",
    }));

  return {
    users: users.map((user: { id: string; email: string; name: string | null; createdAt: Date }) => ({
      id: user.id,
      createdAt: user.createdAt.toISOString(),
      email: user.email,
      name: user.name,
    })),
    questions: [
      ...questions.map(
        (question: {
          id: string;
          title: string;
          content: string;
          userId: string | null;
          createdAt: Date;
          isPaid: boolean;
        }) => ({
          id: question.id,
          createdAt: question.createdAt.toISOString(),
          title: question.title,
          userId: question.userId,
          isPaid: question.isPaid,
          contentPreview: question.content.slice(0, 80),
          source: "direct-keyword-match",
        })
      ),
      ...heuristicMatches,
    ],
    answers: answers.map(
      (answer: {
        id: string;
        questionId: string;
        userId: string | null;
        content: string;
        pitch: string | null;
        createdAt: Date;
      }) => ({
        id: answer.id,
        createdAt: answer.createdAt.toISOString(),
        questionId: answer.questionId,
        userId: answer.userId,
        pitchPreview: answer.pitch?.slice(0, 80) ?? null,
        contentPreview: answer.content.slice(0, 80),
      })
    ),
    negotiations: negotiations.map(
      (negotiation: {
        id: string;
        answerId: string;
        proposedAmount: number;
        status: string;
        createdAt: Date;
      }) => ({
        id: negotiation.id,
        createdAt: negotiation.createdAt.toISOString(),
        answerId: negotiation.answerId,
        proposedAmount: negotiation.proposedAmount,
        status: negotiation.status,
      })
    ),
  };
}

async function main() {
  divider("DATABASE_URL host");
  console.log(getDatabaseHost());

  const [answersWithoutNegotiation, suspiciousUnpaidQuestions, testData] =
    await Promise.all([
      findAnswersWithoutNegotiation(),
      findSuspiciousUnpaidQuestions(),
      findSuspiciousTestData(),
    ]);

  divider("サマリー");
  console.log(
    JSON.stringify(
      {
        answersWithoutNegotiation: answersWithoutNegotiation.length,
        suspiciousUnpaidQuestions: suspiciousUnpaidQuestions.length,
        suspiciousTestUsers: testData.users.length,
        suspiciousTestQuestions: testData.questions.length,
        suspiciousTestAnswers: testData.answers.length,
        suspiciousTestNegotiations: testData.negotiations.length,
      },
      null,
      2
    )
  );

  divider("1. pitch が入っているのに Negotiation を持たない Answer");
  printRows(answersWithoutNegotiation);

  divider("2. isPaid=false だが公開後データを持つ Question 候補");
  printRows(suspiciousUnpaidQuestions);

  divider("3-A. テスト残骸候補 Users");
  printRows(testData.users);

  divider("3-B. テスト残骸候補 Questions");
  printRows(testData.questions);

  divider("3-C. テスト残骸候補 Answers");
  printRows(testData.answers);

  divider("3-D. テスト残骸候補 Negotiations");
  printRows(testData.negotiations);

  divider("cleanup 用メモ");
  console.log("削除はしていません。上記の id をもとに、後で対象を個別確認して cleanup してください。");
  console.log("Question を cleanup する場合は、Answer / Negotiation / Purchase / Notification など関連データの順序も確認してください。");
}

main()
  .catch((error) => {
    console.error("❌ integrity check failed");
    console.error(error);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
