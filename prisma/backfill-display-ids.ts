import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();
const DISPLAY_ID_PREFIX = "KV-";
const DISPLAY_ID_START = 100001;

function formatDisplayId(value: number) {
  return `${DISPLAY_ID_PREFIX}${String(value).padStart(6, "0")}`;
}

function parseDisplayId(displayId: string | null) {
  if (!displayId || !displayId.startsWith(DISPLAY_ID_PREFIX)) {
    return null;
  }

  const value = Number(displayId.slice(DISPLAY_ID_PREFIX.length));
  return Number.isInteger(value) ? value : null;
}

async function main() {
  const usersWithoutDisplayId = await prisma.user.findMany({
    where: { displayId: null },
    select: { id: true, createdAt: true },
    orderBy: { createdAt: "asc" },
  });

  if (usersWithoutDisplayId.length === 0) {
    console.log("No users require displayId backfill.");
    return;
  }

  const existingDisplayIds = await prisma.user.findMany({
    where: {
      displayId: {
        startsWith: DISPLAY_ID_PREFIX,
      },
    },
    select: { displayId: true },
  });

  let nextValue = existingDisplayIds.reduce((max, user) => {
    const parsedValue = parseDisplayId(user.displayId);
    return parsedValue && parsedValue > max ? parsedValue : max;
  }, DISPLAY_ID_START - 1);

  for (const user of usersWithoutDisplayId) {
    nextValue += 1;
    await prisma.user.update({
      where: { id: user.id },
      data: { displayId: formatDisplayId(nextValue) },
    });
  }

  console.log(`Backfilled displayId for ${usersWithoutDisplayId.length} users.`);
}

main()
  .catch((error) => {
    console.error("backfill-display-ids failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
