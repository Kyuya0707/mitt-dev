// ✅ Prisma Client を CJS 互換で読み込む
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

// ✅ Prisma Client 初期化
const prisma = new PrismaClient();

const CATEGORY_NAMES = [
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
];

async function main() {
  for (const name of CATEGORY_NAMES) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
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
