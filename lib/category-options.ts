export const CATEGORY_NAMES = [
  "育児・子育て",
  "転職・キャリア",
  "プログラミング・IT",
  "仕事術・職場の悩み",
  "学習・資格",
  "恋愛・人間関係",
  "暮らし・家事",
  "旅行・地域情報",
  "趣味・創作",
  "商品選び・購入体験",
] as const;

export const MAX_INTEREST_CATEGORIES = 3;

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
