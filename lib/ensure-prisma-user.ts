import prisma from "@/lib/prisma";
import { ensureNotificationPreference } from "@/lib/notifications";
import {
  buildFallbackUsernameCandidates,
  USERNAME_MAX_LENGTH,
  validateUsername,
} from "@/lib/username";

type EnsurePrismaUserInput = {
  id: string;
  email?: string | null;
  username?: string | null;
  name?: string | null;
  interests?: string[] | null;
  ppConsentAt?: Date | null;
  ppConsentVersion?: string | null;
};

function buildTaggedError(code: string, message: string) {
  const error = new Error(message) as Error & { code: string };
  error.code = code;
  return error;
}

const DISPLAY_ID_PREFIX = "KV-";
const DISPLAY_ID_START = 100001;

function formatDisplayId(value: number) {
  return `${DISPLAY_ID_PREFIX}${String(value).padStart(6, "0")}`;
}

function parseDisplayId(displayId: string | null | undefined) {
  if (!displayId || !displayId.startsWith(DISPLAY_ID_PREFIX)) {
    return null;
  }

  const value = Number(displayId.slice(DISPLAY_ID_PREFIX.length));
  return Number.isInteger(value) ? value : null;
}

async function assignDisplayId(userId: string) {
  const existingUser = await prisma.user.findUnique({
    where: { id: userId },
    select: { id: true, displayId: true },
  });

  if (!existingUser) {
    throw new Error("User not found while assigning displayId");
  }

  if (existingUser.displayId) {
    return existingUser.displayId;
  }

  for (let attempt = 0; attempt < 10; attempt += 1) {
    const existingDisplayIds = await prisma.user.findMany({
      where: {
        displayId: {
          startsWith: DISPLAY_ID_PREFIX,
        },
      },
      select: { displayId: true },
      orderBy: { displayId: "desc" },
      take: 50,
    });

    const maxValue = existingDisplayIds.reduce((max, user) => {
      const parsedValue = parseDisplayId(user.displayId);
      return parsedValue && parsedValue > max ? parsedValue : max;
    }, DISPLAY_ID_START - 1);

    const nextDisplayId = formatDisplayId(maxValue + 1);

    try {
      const updatedUser = await prisma.user.update({
        where: { id: userId },
        data: { displayId: nextDisplayId },
        select: { displayId: true },
      });

      return updatedUser.displayId;
    } catch (error) {
      const errorCode =
        typeof error === "object" &&
        error !== null &&
        "code" in error &&
        typeof error.code === "string"
          ? error.code
          : null;

      if (errorCode === "P2002") {
        continue;
      }

      throw error;
    }
  }

  throw new Error("displayId assignment failed");
}

async function findAvailableUsername(base: string, userId: string) {
  let suffix = 0;

  while (suffix < 1000) {
    const suffixText = suffix === 0 ? "" : `_${suffix + 1}`;
    const trimmedBase = base.slice(0, USERNAME_MAX_LENGTH - suffixText.length);
    const candidate = `${trimmedBase}${suffixText}`;

    const existing = await prisma.user.findUnique({
      where: { username: candidate },
      select: { id: true },
    });

    if (!existing || existing.id === userId) {
      return candidate;
    }

    suffix += 1;
  }

  throw buildTaggedError(
    "USERNAME_RESOLUTION_FAILED",
    "username resolution failed"
  );
}

async function resolveUsername(input: {
  id: string;
  email?: string | null;
  username?: string | null;
  name?: string | null;
}) {
  if (input.username && input.username.trim().length > 0) {
    const validation = validateUsername(input.username);

    if (!validation.ok) {
      throw buildTaggedError("INVALID_USERNAME", validation.message);
    }

    const existing = await prisma.user.findUnique({
      where: { username: validation.value },
      select: { id: true },
    });

    if (existing && existing.id !== input.id) {
      throw buildTaggedError(
        "USERNAME_TAKEN",
        "このユーザー名はすでに使用されています。"
      );
    }

    return validation.value;
  }

  const candidates = buildFallbackUsernameCandidates({
    username: input.username,
    name: input.name,
    email: input.email,
    userId: input.id,
  });

  for (const candidate of candidates) {
    const available = await findAvailableUsername(candidate, input.id);
    if (available) {
      return available;
    }
  }

  return null;
}

export async function ensurePrismaUser({
  id,
  email,
  username,
  name,
  interests,
  ppConsentAt,
  ppConsentVersion,
}: EnsurePrismaUserInput) {
  const normalizedEmail = typeof email === "string" ? email.trim() : "";
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const normalizedInterests = Array.isArray(interests)
    ? interests.filter((item): item is string => typeof item === "string")
    : [];
  const resolvedUsername = await resolveUsername({
    id,
    email: normalizedEmail,
    username,
    name: normalizedName,
  });

  if (normalizedEmail.length > 0) {
    const savedUser = await prisma.user.upsert({
      where: { id },
      update: {
        email: normalizedEmail,
        username: resolvedUsername,
        interestCategories: normalizedInterests,
        ...(normalizedName ? { name: normalizedName } : {}),
        ...(ppConsentAt ? { ppConsentAt } : {}),
        ...(ppConsentVersion ? { ppConsentVersion } : {}),
      },
      create: {
        id,
        email: normalizedEmail,
        username: resolvedUsername,
        interestCategories: normalizedInterests,
        ...(normalizedName ? { name: normalizedName } : {}),
        ...(ppConsentAt ? { ppConsentAt } : {}),
        ...(ppConsentVersion ? { ppConsentVersion } : {}),
      },
      select: {
        id: true,
        displayId: true,
        email: true,
        username: true,
        name: true,
      },
    });

    if (!savedUser.displayId) {
      const displayId = await assignDisplayId(savedUser.id);
      savedUser.displayId = displayId;
    }

    await ensureNotificationPreference(id);
    return savedUser;
  }

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      displayId: true,
      email: true,
      username: true,
      name: true,
      interestCategories: true,
    },
  });

  if (!existingUser) {
    throw new Error("Prisma user sync failed: email is required for new user");
  }

  if (
    existingUser.username !== resolvedUsername ||
    (normalizedName && existingUser.name !== normalizedName) ||
    JSON.stringify(existingUser.interestCategories ?? []) !==
      JSON.stringify(normalizedInterests)
  ) {
      const savedUser = await prisma.user.update({
        where: { id },
        data: {
          username: resolvedUsername,
        interestCategories: normalizedInterests,
        ...(normalizedName ? { name: normalizedName } : {}),
        ...(ppConsentAt ? { ppConsentAt } : {}),
        ...(ppConsentVersion ? { ppConsentVersion } : {}),
      },
        select: {
          id: true,
          displayId: true,
          email: true,
          username: true,
          name: true,
        },
      });

      if (!savedUser.displayId) {
        const displayId = await assignDisplayId(savedUser.id);
        savedUser.displayId = displayId;
      }

      await ensureNotificationPreference(id);
      return savedUser;
    }

  if (!existingUser.displayId) {
    existingUser.displayId = await assignDisplayId(existingUser.id);
  }

  await ensureNotificationPreference(id);
  return existingUser;
}
