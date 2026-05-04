import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

type ParsedArgs = {
  execute: boolean;
};

type AuthUserSummary = {
  id: string;
  email: string | null;
  username: string | null;
  avatarUrl: string | null;
};

type StorageTarget = {
  bucket: string;
  path: string;
  source: string;
};

type DryRunSummary = {
  authUsers: number;
  prismaUsers: number;
  questions: number;
  answers: number;
  purchases: number;
  negotiations: number;
  comments: number;
  answerLikes: number;
  answerReads: number;
  notifications: number;
  payouts: number;
  reports: number;
  questionImages: number;
  answerImages: number;
  storageFiles: number;
};

const prisma = new PrismaClient();

function parseArgs(argv: string[]): ParsedArgs {
  const executeArg = argv.find((arg) => arg.startsWith("--execute="));
  return {
    execute: executeArg?.split("=")[1] === "true",
  };
}

function requireEnv(name: string) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`${name} is required`);
  }
  return value;
}

function getSupabaseAdmin() {
  const url = requireEnv("NEXT_PUBLIC_SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");

  return createClient(url, serviceRoleKey, {
    auth: {
      autoRefreshToken: false,
      persistSession: false,
    },
  });
}

async function listAllAuthUsers() {
  const supabaseAdmin = getSupabaseAdmin();
  const users: AuthUserSummary[] = [];
  let page = 1;
  const perPage = 100;

  while (true) {
    const { data, error } = await supabaseAdmin.auth.admin.listUsers({
      page,
      perPage,
    });

    if (error) {
      throw error;
    }

    for (const user of data.users) {
      const metadata = user.user_metadata ?? {};
      users.push({
        id: user.id,
        email: user.email ?? null,
        username:
          typeof metadata.username === "string" ? metadata.username : null,
        avatarUrl:
          typeof metadata.avatar_url === "string" ? metadata.avatar_url : null,
      });
    }

    if (data.users.length < perPage) {
      break;
    }

    page += 1;
  }

  return users;
}

function parseStorageTargetFromPublicUrl(
  value: string | null | undefined,
  source: string
) {
  if (!value) {
    return null;
  }

  try {
    const url = new URL(value);
    const marker = "/storage/v1/object/public/";
    const markerIndex = url.pathname.indexOf(marker);

    if (markerIndex === -1) {
      return null;
    }

    const storagePath = url.pathname.slice(markerIndex + marker.length);
    const [bucket, ...rest] = storagePath.split("/");

    if (!bucket || rest.length === 0) {
      return null;
    }

    return {
      bucket,
      path: rest.map((segment) => decodeURIComponent(segment)).join("/"),
      source,
    } satisfies StorageTarget;
  } catch {
    return null;
  }
}

function dedupeStorageTargets(targets: Array<StorageTarget | null>) {
  const map = new Map<string, StorageTarget>();

  for (const target of targets) {
    if (!target) continue;
    map.set(`${target.bucket}:${target.path}`, target);
  }

  return Array.from(map.values());
}

async function collectState() {
  const authUsers = await listAllAuthUsers();

  const [
    prismaUsers,
    questions,
    answers,
    purchases,
    negotiations,
    comments,
    answerLikes,
    answerReads,
    notifications,
    payouts,
    reports,
    questionImages,
    answerImages,
  ] = await Promise.all([
    prisma.user.findMany({
      select: { id: true, email: true, username: true, name: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.question.findMany({
      select: { id: true, userId: true, title: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.answer.findMany({
      select: { id: true, userId: true, questionId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.purchase.findMany({
      select: { id: true, userId: true, questionId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.negotiation.findMany({
      select: { id: true, answerId: true, questionId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.comment.findMany({
      select: { id: true, userId: true, answerId: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.answerLike.findMany({
      select: { userId: true, answerId: true, createdAt: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.answerRead.findMany({
      select: { id: true, userId: true, answerId: true },
      orderBy: { readAt: "asc" },
    }),
    prisma.notification.findMany({
      select: { id: true, userId: true, type: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.payout.findMany({
      select: { id: true, userId: true, amount: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.report.findMany({
      select: {
        id: true,
        reporterId: true,
        questionId: true,
        answerId: true,
      },
      orderBy: { createdAt: "asc" },
    }),
    prisma.questionImage.findMany({
      select: { id: true, questionId: true, url: true },
      orderBy: { createdAt: "asc" },
    }),
    prisma.answerImage.findMany({
      select: { id: true, answerId: true, url: true },
      orderBy: { createdAt: "asc" },
    }),
  ]);

  const storageTargets = dedupeStorageTargets([
    ...authUsers.map((user) =>
      parseStorageTargetFromPublicUrl(user.avatarUrl, `auth:${user.id}`)
    ),
    ...questionImages.map((image) =>
      parseStorageTargetFromPublicUrl(image.url, `questionImage:${image.id}`)
    ),
    ...answerImages.map((image) =>
      parseStorageTargetFromPublicUrl(image.url, `answerImage:${image.id}`)
    ),
  ]);

  const summary: DryRunSummary = {
    authUsers: authUsers.length,
    prismaUsers: prismaUsers.length,
    questions: questions.length,
    answers: answers.length,
    purchases: purchases.length,
    negotiations: negotiations.length,
    comments: comments.length,
    answerLikes: answerLikes.length,
    answerReads: answerReads.length,
    notifications: notifications.length,
    payouts: payouts.length,
    reports: reports.length,
    questionImages: questionImages.length,
    answerImages: answerImages.length,
    storageFiles: storageTargets.length,
  };

  return {
    authUsers,
    prismaUsers,
    questions,
    answers,
    purchases,
    negotiations,
    comments,
    answerLikes,
    answerReads,
    notifications,
    payouts,
    reports,
    questionImages,
    answerImages,
    storageTargets,
    summary,
  };
}

async function removeStorageFiles(targets: StorageTarget[]) {
  const supabaseAdmin = getSupabaseAdmin();
  const grouped = new Map<string, string[]>();

  for (const target of targets) {
    const existing = grouped.get(target.bucket) ?? [];
    existing.push(target.path);
    grouped.set(target.bucket, existing);
  }

  for (const [bucket, paths] of grouped) {
    if (paths.length === 0) continue;

    const { error } = await supabaseAdmin.storage.from(bucket).remove(paths);
    if (error) {
      throw error;
    }
  }
}

async function deleteAllUserLinkedData(state: Awaited<ReturnType<typeof collectState>>) {
  // Storage は DB トランザクションに含められないため最後に削除する。
  // 途中失敗時は、DB レコード欠損よりも孤立ファイルが残るほうが安全。
  await prisma.$transaction(async (tx) => {
    await tx.report.deleteMany({});
    await tx.notification.deleteMany({});
    await tx.answerRead.deleteMany({});
    await tx.answerLike.deleteMany({});
    await tx.comment.deleteMany({});
    await tx.purchase.deleteMany({});
    await tx.payout.deleteMany({});
    await tx.negotiation.deleteMany({});
    await tx.answerImage.deleteMany({});
    await tx.questionImage.deleteMany({});
    await tx.answer.deleteMany({});
    await tx.question.deleteMany({});
    await tx.user.deleteMany({});
  });

  const supabaseAdmin = getSupabaseAdmin();
  for (const user of state.authUsers) {
    const { error } = await supabaseAdmin.auth.admin.deleteUser(user.id);
    if (error) {
      throw error;
    }
  }

  await removeStorageFiles(state.storageTargets);
}

function printSection(title: string, value: unknown) {
  console.log(`\n=== ${title} ===`);
  console.dir(value, { depth: null });
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const state = await collectState();

  printSection("DRY RUN SUMMARY", {
    execute: args.execute,
    ...state.summary,
  });

  printSection(
    "AUTH USERS",
    state.authUsers.map((user) => ({
      id: user.id,
      email: user.email,
      username: user.username,
    }))
  );

  printSection("STORAGE FILE TARGETS", state.storageTargets);

  if (!args.execute) {
    console.log(
      "\nDry-run only. Use --execute=true to delete Prisma data, referenced Storage files, and Supabase Auth users."
    );
    return;
  }

  await deleteAllUserLinkedData(state);
  console.log("\nPurge completed.");
}

main()
  .catch((error) => {
    console.error("purge-all-users failed:", error);
    process.exitCode = 1;
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
