// ✅ Prisma Client を CJS 互換で読み込む
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

// ✅ Prisma Client 初期化
const prisma = new PrismaClient();

const CATEGORY_NAMES = [
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
];

async function main() {
  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  const fallbackCategory = await prisma.category.findUnique({
    where: { name: "その他" },
    select: { id: true },
  });

  if (!fallbackCategory) {
    throw new Error("fallback category not found");
  }

  const legacyCategories = await prisma.category.findMany({
    where: {
      name: {
        notIn: CATEGORY_NAMES,
      },
    },
    select: { id: true },
  });

  const legacyCategoryIds = legacyCategories.map(
    (category: (typeof legacyCategories)[number]) => category.id
  );

  if (legacyCategoryIds.length > 0) {
    await prisma.question.updateMany({
      where: {
        categoryId: {
          in: legacyCategoryIds,
        },
      },
      data: {
        categoryId: fallbackCategory.id,
      },
    });

    await prisma.category.deleteMany({
      where: {
        id: {
          in: legacyCategoryIds,
        },
      },
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
