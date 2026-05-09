export const AGE_GROUP_OPTIONS = [
  "10代",
  "20代",
  "30代",
  "40代",
  "50代",
  "60代",
  "70代以上",
  "回答しない",
] as const;

export type AgeGroup = (typeof AGE_GROUP_OPTIONS)[number];

export const GENDER_OPTIONS = [
  "男性",
  "女性",
  "その他",
  "回答しない",
] as const;

export type Gender = (typeof GENDER_OPTIONS)[number];

export function isAgeGroup(value: unknown): value is AgeGroup {
  return typeof value === "string" && (AGE_GROUP_OPTIONS as readonly string[]).includes(value);
}

export function isGender(value: unknown): value is Gender {
  return typeof value === "string" && (GENDER_OPTIONS as readonly string[]).includes(value);
}
