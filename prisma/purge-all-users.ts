import { PrismaClient } from "@prisma/client";
import { createClient } from "@supabase/supabase-js";

type ParsedArgs = {
  execute: boolean;
  confirmPurge: boolean;
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
  notificationPreferences: number;
  questions: number;
  answers: number;
  purchases: number;
  bestViewRevenueShares: number;
  bestViewPayouts: number;
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

type PurgeState = {
  authUsers: AuthUserSummary[];
  storageTargets: StorageTarget[];
  summary: DryRunSummary;
};

const prisma = new PrismaClient();

function parseArgs(argv: string[]): ParsedArgs {
  const executeArg = argv.find((arg) => arg.startsWith("--execute="));
  return {
    execute: executeArg?.split("=")[1] === "true",
    confirmPurge: process.env.CONFIRM_PURGE === "YES",
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

function sanitizeDatabaseTarget(databaseUrl: string) {
  try {
    const url = new URL(databaseUrl);
    return {
      host: url.hostname,
      database: url.pathname.replace(/^\//, ""),
      sslmode: url.searchParams.get("sslmode"),
    };
  } catch {
    return {
      host: "unknown",
      database: "unknown",
      sslmode: null,
    };
  }
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
  const prismaUsers = await prisma.user.count();
  const notificationPreferences = await prisma.notificationPreference.count();
  const questions = await prisma.question.count();
  const answers = await prisma.answer.count();
  const purchases = await prisma.purchase.count();
  const bestViewRevenueShares = await prisma.bestViewRevenueShare.count();
  const bestViewPayouts = await prisma.bestViewPayout.count();
  const negotiations = await prisma.negotiation.count();
  const comments = await prisma.comment.count();
  const answerLikes = await prisma.answerLike.count();
  const answerReads = await prisma.answerRead.count();
  const notifications = await prisma.notification.count();
  const payouts = await prisma.payout.count();
  const reports = await prisma.report.count();
  const questionImages = await prisma.questionImage.findMany({
    select: { id: true, url: true },
    orderBy: { createdAt: "asc" },
  });
  const answerImages = await prisma.answerImage.findMany({
    select: { id: true, url: true },
    orderBy: { createdAt: "asc" },
  });

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
    prismaUsers,
    notificationPreferences,
    questions,
    answers,
    purchases,
    bestViewRevenueShares,
    bestViewPayouts,
    negotiations,
    comments,
    answerLikes,
    answerReads,
    notifications,
    payouts,
    reports,
    questionImages: questionImages.length,
    answerImages: answerImages.length,
    storageFiles: storageTargets.length,
  };

  return {
    authUsers,
    storageTargets,
    summary,
  } satisfies PurgeState;
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

async function deleteAllUserLinkedData(state: PurgeState) {
  // Storage は DB トランザクションに含められないため最後に削除する。
  // 途中失敗時は、DB レコード欠損よりも孤立ファイルが残るほうが安全。
  await prisma.$transaction(async (tx) => {
    await tx.report.deleteMany({});
    await tx.notification.deleteMany({});
    await tx.notificationPreference.deleteMany({});
    await tx.answerRead.deleteMany({});
    await tx.answerLike.deleteMany({});
    await tx.comment.deleteMany({});
    await tx.bestViewPayout.deleteMany({});
    await tx.bestViewRevenueShare.deleteMany({});
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
  const databaseTarget = sanitizeDatabaseTarget(requireEnv("DATABASE_URL"));
  const state = await collectState();

  printSection("SAFETY CHECK", {
    databaseTarget,
    execute: args.execute,
    confirmPurge: args.confirmPurge,
    backupRecommended:
      "本番実行前に Supabase/PostgreSQL のバックアップ取得を推奨します。",
  });

  printSection("DRY RUN SUMMARY", {
    execute: args.execute,
    confirmPurge: args.confirmPurge,
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
      "\nDry-run only. Backup を取得したうえで、CONFIRM_PURGE=YES と --execute=true を付けた場合のみ削除が実行されます。"
    );
    return;
  }

  if (!args.confirmPurge) {
    throw new Error(
      "CONFIRM_PURGE=YES が設定されていないため削除を中止しました。"
    );
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
