import "server-only";

import { unstable_cache } from "next/cache";
import { Prisma } from "@prisma/client";
import prisma from "@/lib/prisma";
import { sortCategoryNames } from "@/lib/category-options";
import { durationMs, logPerf, nowMs } from "@/lib/perf";

export const DEFAULT_QUESTION_PAGE = 1;
export const DEFAULT_QUESTION_LIMIT = 20;
export const MAX_QUESTION_LIMIT = 50;

export type QuestionDeadlineFilter =
  | "all"
  | "has_deadline"
  | "no_deadline"
  | "open_deadline"
  | "expired_deadline";

export type QuestionListParams = {
  q: string;
  categoryId: string;
  categoryName: string;
  sort: string;
  deadlineFilter: QuestionDeadlineFilter;
  excludeBest: boolean;
  page: number;
  limit: number;
};

export function parsePositiveInt(value: string | null, fallback: number) {
  const parsed = Number(value);

  if (!Number.isFinite(parsed) || parsed < 1) {
    return fallback;
  }

  return Math.trunc(parsed);
}

export function normalizeQuestionDeadlineFilter(
  value: string | null | undefined
): QuestionDeadlineFilter {
  return value === "has_deadline" ||
    value === "no_deadline" ||
    value === "open_deadline" ||
    value === "expired_deadline"
    ? value
    : "all";
}

function buildQuestionListWhere(params: QuestionListParams) {
  const where: Prisma.QuestionWhereInput = {
    cancellationRequests: {
      none: {
        status: "approved",
      },
    },
  };

  if (params.q) {
    where.OR = [
      { title: { contains: params.q, mode: "insensitive" } },
      { content: { contains: params.q, mode: "insensitive" } },
    ];
  }

  if (params.categoryId) {
    where.categoryId = params.categoryId;
  } else if (params.categoryName) {
    where.category = { name: params.categoryName };
  }

  if (params.excludeBest) {
    where.bestAnswerId = null;
  }

  const now = new Date();
  switch (params.deadlineFilter) {
    case "has_deadline":
      where.answerDeadline = { not: null };
      break;
    case "no_deadline":
      where.answerDeadline = null;
      break;
    case "open_deadline":
      where.answerDeadline = { gt: now };
      break;
    case "expired_deadline":
      where.answerDeadline = { not: null, lte: now };
      break;
    default:
      break;
  }

  return where;
}

function buildQuestionListOrderBy(
  sort: string
): Prisma.QuestionOrderByWithRelationInput | Prisma.QuestionOrderByWithRelationInput[] {
  switch (sort) {
    case "reward":
      return { rewardAmount: "desc" };
    case "answers":
      return { answers: { _count: "desc" } };
    case "deadline_asc":
      return [
        { answerDeadline: { sort: "asc", nulls: "last" } },
        { createdAt: "desc" },
      ];
    default:
      return { createdAt: "desc" };
  }
}

function buildQuestionExcerpt(content: string, maxLength = 120) {
  const normalized = content.replace(/\s+/g, " ").trim();
  return normalized.length <= maxLength
    ? normalized
    : `${normalized.slice(0, maxLength)}…`;
}

async function queryQuestionList(params: QuestionListParams) {
  const totalStart = nowMs();
  const where = buildQuestionListWhere(params);
  const orderBy = buildQuestionListOrderBy(params.sort);
  const skip = (params.page - 1) * params.limit;

  const countStart = nowMs();
  const countPromise = prisma.question.count({ where }).then((value) => ({
    value,
    duration: durationMs(countStart),
  }));

  const findManyStart = nowMs();
  const questionsPromise = prisma.question
    .findMany({
      where,
      orderBy,
      skip,
      take: params.limit,
      select: {
        id: true,
        title: true,
        content: true,
        rewardAmount: true,
        viewerPrice: true,
        answerDeadline: true,
        createdAt: true,
        isClosed: true,
        isPaid: true,
        bestAnswerId: true,
        category: { select: { id: true, name: true } },
        _count: { select: { answers: true } },
      },
    })
    .then((value) => ({ value, duration: durationMs(findManyStart) }));

  const [countResult, questionsResult] = await Promise.all([
    countPromise,
    questionsPromise,
  ]);

  const items = questionsResult.value.map((question) => ({
    id: question.id,
    title: question.title,
    content: buildQuestionExcerpt(question.content),
    rewardAmount: question.rewardAmount,
    viewerPrice: question.viewerPrice,
    answerDeadline: question.answerDeadline?.toISOString() ?? null,
    createdAt: question.createdAt.toISOString(),
    isClosed: question.isClosed,
    isPaid: question.isPaid,
    bestAnswerId: question.bestAnswerId,
    category: question.category,
    answerCount: question._count.answers,
  }));

  const totalPages =
    countResult.value === 0 ? 1 : Math.ceil(countResult.value / params.limit);

  logPerf("questions.query", {
    total: `${durationMs(totalStart)}ms`,
    count: `${countResult.duration}ms`,
    findMany: `${questionsResult.duration}ms`,
    items: items.length,
    page: params.page,
    limit: params.limit,
    sort: params.sort,
    deadlineFilter: params.deadlineFilter,
  });

  return {
    items,
    page: params.page,
    limit: params.limit,
    total: countResult.value,
    totalPages,
    hasNextPage: params.page < totalPages,
  };
}

export const getQuestionList = unstable_cache(
  queryQuestionList,
  ["public-question-list-v1"],
  { revalidate: 30, tags: ["questions"] }
);

async function queryQuestionCategories() {
  return sortCategoryNames(
    await prisma.category.findMany({
      select: { id: true, name: true },
    })
  );
}

export const getQuestionCategories = unstable_cache(
  queryQuestionCategories,
  ["question-categories-v1"],
  { revalidate: 3600, tags: ["question-categories"] }
);
