import QuestionsClient from "./QuestionsClient";
import {
  DEFAULT_QUESTION_LIMIT,
  DEFAULT_QUESTION_PAGE,
  getQuestionCategories,
  getQuestionList,
  normalizeQuestionDeadlineFilter,
} from "@/lib/question-list";

type SearchParams = Promise<
  Record<string, string | string[] | undefined>
>;

function firstValue(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? "" : value ?? "";
}

export default async function QuestionsPage({
  searchParams,
}: {
  searchParams: SearchParams;
}) {
  const params = await searchParams;
  const query = firstValue(params.q).trim();
  const categoryId = firstValue(params.categoryId).trim();
  const categoryName = firstValue(params.category).trim();
  const sort = firstValue(params.sort).trim() || "latest";
  const deadlineFilter = normalizeQuestionDeadlineFilter(
    firstValue(params.deadlineFilter)
  );
  const excludeBestParam = firstValue(params.excludeBest);
  const excludeBest = excludeBestParam === "1" || excludeBestParam === "true";

  const [initialData, initialCategories] = await Promise.all([
    getQuestionList({
      q: query,
      categoryId,
      categoryName,
      sort,
      deadlineFilter,
      excludeBest,
      page: DEFAULT_QUESTION_PAGE,
      limit: DEFAULT_QUESTION_LIMIT,
    }),
    getQuestionCategories(),
  ]);

  return (
    <QuestionsClient
      initialData={initialData}
      initialCategories={initialCategories}
      initialFilters={{
        query,
        categoryId: categoryId || categoryName,
        sort,
        deadlineFilter,
        excludeBestSelected: excludeBest,
      }}
    />
  );
}
