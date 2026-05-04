export const CATEGORY_NAMES = [
  "車・バイク",
  "恋愛・結婚",
  "仕事・キャリア",
  "転職・就職",
  "お金・投資",
  "副業・起業",
  "学習・資格",
  "プログラミング・IT",
  "ガジェット・家電",
  "趣味・エンタメ",
  "健康・ダイエット",
  "美容・ファッション",
  "子育て・家族",
  "その他",
] as const;

const CATEGORY_ORDER = new Map(
  CATEGORY_NAMES.map((name, index) => [name, index] as const)
);

export function sortCategoryNames<T extends { name?: string | null }>(items: T[]) {
  return [...items].sort((a, b) => {
    const aName = a.name ?? "";
    const bName = b.name ?? "";
    const aOrder = aName
      ? CATEGORY_ORDER.get(aName as (typeof CATEGORY_NAMES)[number]) ??
        Number.MAX_SAFE_INTEGER
      : Number.MAX_SAFE_INTEGER;
    const bOrder = bName
      ? CATEGORY_ORDER.get(bName as (typeof CATEGORY_NAMES)[number]) ??
        Number.MAX_SAFE_INTEGER
      : Number.MAX_SAFE_INTEGER;

    if (aOrder !== bOrder) {
      return aOrder - bOrder;
    }

    return aName.localeCompare(bName, "ja");
  });
}
