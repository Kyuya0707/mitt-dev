import prisma from "@/lib/prisma";
import { MAX_INTEREST_CATEGORIES } from "@/lib/category-options";
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
  ageGroup?: string | null;
  gender?: string | null;
  bio?: string | null;
  experienceCategory?: string | null;
  experienceYears?: number | null;
  ageConfirmedAt?: Date | null;
  ppConsentAt?: Date | null;
  ppConsentVersion?: string | null;
};

function areStringArraysEqual(a: string[], b: string[]) {
  if (a.length !== b.length) {
    return false;
  }

  return a.every((value, index) => value === b[index]);
}

function areDatesEqual(a?: Date | null, b?: Date | null) {
  if (!a && !b) {
    return true;
  }

  if (!a || !b) {
    return false;
  }

  return a.getTime() === b.getTime();
}

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
  ageGroup,
  gender,
  bio,
  experienceCategory,
  experienceYears,
  ageConfirmedAt,
  ppConsentAt,
  ppConsentVersion,
}: EnsurePrismaUserInput) {
  const normalizedEmail = typeof email === "string" ? email.trim() : "";
  const normalizedName = typeof name === "string" ? name.trim() : "";
  const requestedInterests = Array.isArray(interests)
    ? [...new Set(
        interests
          .filter((item): item is string => typeof item === "string")
          .map((item) => item.trim())
          .filter(Boolean)
      )]
    : [];
  const normalizedAgeGroup =
    typeof ageGroup === "string" && ageGroup.trim().length > 0
      ? ageGroup.trim()
      : undefined;
  const normalizedGender =
    typeof gender === "string" && gender.trim().length > 0
      ? gender.trim()
      : undefined;
  const normalizedBio = typeof bio === "string" ? bio.trim().slice(0, 1000) : undefined;
  const normalizedExperienceCategory =
    typeof experienceCategory === "string"
      ? experienceCategory.trim().slice(0, 100)
      : undefined;
  const normalizedExperienceYears =
    typeof experienceYears === "number" && Number.isInteger(experienceYears)
      ? Math.min(80, Math.max(0, experienceYears))
      : undefined;

  const existingUser = await prisma.user.findUnique({
    where: { id },
    select: {
      id: true,
      displayId: true,
      email: true,
      username: true,
      name: true,
      interestCategories: true,
      ageGroup: true,
      gender: true,
      bio: true,
      experienceCategory: true,
      experienceYears: true,
      deletedAt: true,
      ageConfirmedAt: true,
      ppConsentAt: true,
      ppConsentVersion: true,
      notificationPreference: {
        select: {
          id: true,
        },
      },
    },
  });

  if (existingUser) {
    if (existingUser.deletedAt) {
      throw buildTaggedError("ACCOUNT_DELETED", "このアカウントは退会済みです");
    }
    const normalizedInterests =
      requestedInterests.length > MAX_INTEREST_CATEGORIES
        ? existingUser.interestCategories
        : requestedInterests;
    const requestedUsername =
      typeof username === "string" && username.trim().length > 0
        ? username.trim()
        : null;
    const shouldResolveUsername =
      requestedUsername !== null
        ? requestedUsername !== existingUser.username
        : !existingUser.username;
    const emailChanged =
      normalizedEmail.length > 0 && existingUser.email !== normalizedEmail;
    const nameChanged = Boolean(
      normalizedName && existingUser.name !== normalizedName
    );
    const interestsChanged = !areStringArraysEqual(
      existingUser.interestCategories ?? [],
      normalizedInterests
    );
    const ageGroupChanged =
      normalizedAgeGroup !== undefined &&
      existingUser.ageGroup !== normalizedAgeGroup;
    const genderChanged =
      normalizedGender !== undefined && existingUser.gender !== normalizedGender;
    const bioChanged = normalizedBio !== undefined && existingUser.bio !== normalizedBio;
    const experienceCategoryChanged =
      normalizedExperienceCategory !== undefined &&
      existingUser.experienceCategory !== normalizedExperienceCategory;
    const experienceYearsChanged =
      normalizedExperienceYears !== undefined &&
      existingUser.experienceYears !== normalizedExperienceYears;
    const consentChanged = Boolean(
      ppConsentAt && !areDatesEqual(existingUser.ppConsentAt, ppConsentAt)
    );
    const consentVersionChanged = Boolean(
      ppConsentVersion && existingUser.ppConsentVersion !== ppConsentVersion
    );
    const ageConfirmationChanged = Boolean(
      ageConfirmedAt && !areDatesEqual(existingUser.ageConfirmedAt, ageConfirmedAt)
    );
    const needsUpdate =
      shouldResolveUsername ||
      emailChanged ||
      nameChanged ||
      interestsChanged ||
      ageGroupChanged ||
      genderChanged ||
      bioChanged ||
      experienceCategoryChanged ||
      experienceYearsChanged ||
      ageConfirmationChanged ||
      consentChanged ||
      consentVersionChanged;

    if (
      !needsUpdate &&
      existingUser.displayId &&
      existingUser.notificationPreference
    ) {
      return {
        id: existingUser.id,
        displayId: existingUser.displayId,
        email: existingUser.email,
        username: existingUser.username,
        name: existingUser.name,
        ageGroup: existingUser.ageGroup,
        gender: existingUser.gender,
      };
    }

    let nextUsername = existingUser.username;

    if (shouldResolveUsername) {
      nextUsername = await resolveUsername({
        id,
        email: normalizedEmail || existingUser.email,
        username,
        name: normalizedName || existingUser.name,
      });
    }

    let savedUser = {
      id: existingUser.id,
      displayId: existingUser.displayId,
      email: existingUser.email,
      username: nextUsername,
      name: existingUser.name,
      ageGroup: existingUser.ageGroup,
      gender: existingUser.gender,
    };

    if (needsUpdate) {
      savedUser = await prisma.user.update({
        where: { id },
        data: {
          ...(emailChanged ? { email: normalizedEmail } : {}),
          ...(nextUsername !== existingUser.username
            ? { username: nextUsername }
            : {}),
          ...(interestsChanged
            ? { interestCategories: normalizedInterests }
            : {}),
          ...(ageGroupChanged ? { ageGroup: normalizedAgeGroup } : {}),
          ...(genderChanged ? { gender: normalizedGender } : {}),
          ...(bioChanged ? { bio: normalizedBio } : {}),
          ...(experienceCategoryChanged
            ? { experienceCategory: normalizedExperienceCategory }
            : {}),
          ...(experienceYearsChanged
            ? { experienceYears: normalizedExperienceYears }
            : {}),
          ...(ageConfirmationChanged ? { ageConfirmedAt } : {}),
          ...(nameChanged ? { name: normalizedName } : {}),
          ...(consentChanged ? { ppConsentAt } : {}),
          ...(consentVersionChanged ? { ppConsentVersion } : {}),
        },
        select: {
          id: true,
          displayId: true,
          email: true,
          username: true,
          name: true,
          ageGroup: true,
          gender: true,
        },
      });
    }

    if (!savedUser.displayId) {
      savedUser.displayId = await assignDisplayId(savedUser.id);
    }

    if (!existingUser.notificationPreference) {
      await ensureNotificationPreference(id);
    }

    return savedUser;
  }

  if (normalizedEmail.length === 0) {
    throw new Error("Prisma user sync failed: email is required for new user");
  }

  const resolvedUsername = await resolveUsername({
    id,
    email: normalizedEmail,
    username,
    name: normalizedName,
  });

  const createdUser = await prisma.user.create({
    data: {
      id,
      email: normalizedEmail,
      username: resolvedUsername,
      interestCategories: requestedInterests.slice(0, MAX_INTEREST_CATEGORIES),
      ...(normalizedName ? { name: normalizedName } : {}),
      ...(normalizedAgeGroup ? { ageGroup: normalizedAgeGroup } : {}),
      ...(normalizedGender ? { gender: normalizedGender } : {}),
      ...(normalizedBio !== undefined ? { bio: normalizedBio } : {}),
      ...(normalizedExperienceCategory
        ? { experienceCategory: normalizedExperienceCategory }
        : {}),
      ...(normalizedExperienceYears !== undefined
        ? { experienceYears: normalizedExperienceYears }
        : {}),
      ...(ageConfirmedAt ? { ageConfirmedAt } : {}),
      ...(ppConsentAt ? { ppConsentAt } : {}),
      ...(ppConsentVersion ? { ppConsentVersion } : {}),
    },
    select: {
      id: true,
      displayId: true,
      email: true,
      username: true,
      name: true,
      ageGroup: true,
      gender: true,
    },
  });

  if (!createdUser.displayId) {
    createdUser.displayId = await assignDisplayId(createdUser.id);
  }

  await ensureNotificationPreference(id);

  return createdUser;
}
