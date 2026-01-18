// ✅ Prisma Client を CJS 互換で読み込む
import { createRequire } from "module";
const require = createRequire(import.meta.url);
const { PrismaClient } = require("@prisma/client");

// ✅ Prisma Client 初期化
const prisma = new PrismaClient();

async function main() {
  const categories = [
    "恋愛・夫婦",
    "仕事・キャリア",
    "副業・お金",
    "投資・資産運用",
    "健康・美容",
    "旅行・レジャー",
    "グルメ・飲食店",
    "趣味・ライフスタイル",
    "ペット・動物",
    "地域情報（○○駅・○○市）",
    "車・バイク",
    "その他"
  ];

  for (const name of categories) {
    await prisma.category.upsert({
      where: { name },
      update: {},
      create: { name },
    });
  }

  console.log("✅ Categories seed completed!");
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
