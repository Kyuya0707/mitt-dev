export const MAX_ANSWER_DEADLINE_DAYS = 365;
export const MIN_ANSWER_DEADLINE_DAYS = 14;
export const QUESTION_CANCEL_GRACE_DAYS = 14;
const DAY_MS = 24 * 60 * 60 * 1000;

function isValidDate(date: Date) {
  return !Number.isNaN(date.getTime());
}

function parseDateTimeLocalAsJst(value: string) {
  const match = value.match(
    /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/
  );

  if (!match) {
    return new Date(value);
  }

  const [, year, month, day, hour, minute, second = "0"] = match;
  return new Date(
    Date.UTC(
      Number(year),
      Number(month) - 1,
      Number(day),
      Number(hour) - 9,
      Number(minute),
      Number(second)
    )
  );
}

export function getMinimumAnswerDeadline(
  now = new Date(),
  minimumDays = MIN_ANSWER_DEADLINE_DAYS
) {
  return new Date(now.getTime() + minimumDays * DAY_MS);
}

export function parseAnswerDeadlineInput(
  value: unknown,
  options: { now?: Date; minimumDays?: number } = {}
) {
  if (value === null || value === undefined || value === "") {
    return {
      ok: false as const,
      message: "回答期限を入力してください",
    };
  }

  if (typeof value !== "string") {
    return {
      ok: false as const,
      message: "回答期限は日時で入力してください",
    };
  }

  const parsed = parseDateTimeLocalAsJst(value);
  if (!isValidDate(parsed)) {
    return {
      ok: false as const,
      message: "回答期限の形式が正しくありません",
    };
  }

  const now = options.now ?? new Date();
  if (parsed.getTime() <= now.getTime()) {
    return {
      ok: false as const,
      message: "回答期限は現在時刻より後で設定してください",
    };
  }

  const minimumDays = options.minimumDays ?? MIN_ANSWER_DEADLINE_DAYS;
  const minimumDate = getMinimumAnswerDeadline(now, minimumDays);
  if (parsed.getTime() < minimumDate.getTime()) {
    return {
      ok: false as const,
      message: `回答期限は${minimumDays}日後以降で設定してください`,
    };
  }

  const maxDate = new Date(now);
  maxDate.setDate(maxDate.getDate() + MAX_ANSWER_DEADLINE_DAYS);
  if (parsed.getTime() > maxDate.getTime()) {
    return {
      ok: false as const,
      message: `回答期限は${MAX_ANSWER_DEADLINE_DAYS}日以内で設定してください`,
    };
  }

  return { ok: true as const, value: parsed };
}

export function toDatetimeLocalValue(
  value: string | Date | null | undefined
) {
  if (!value) {
    return "";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (!isValidDate(date)) {
    return "";
  }

  const offset = date.getTimezoneOffset() * 60_000;
  const local = new Date(date.getTime() - offset);
  return local.toISOString().slice(0, 16);
}

export function formatJapaneseDateTime(
  value: string | Date | null | undefined
) {
  if (!value) {
    return "";
  }

  const date = typeof value === "string" ? new Date(value) : value;
  if (!isValidDate(date)) {
    return "";
  }

  return date.toLocaleString("ja-JP", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: "Asia/Tokyo",
  });
}

export function getQuestionCancelAvailableAt(input: {
  createdAt: string | Date;
  answerDeadline: string | Date | null | undefined;
}) {
  if (input.answerDeadline) {
    const deadline =
      typeof input.answerDeadline === "string"
        ? new Date(input.answerDeadline)
        : input.answerDeadline;
    if (isValidDate(deadline)) {
      return deadline;
    }
  }

  const createdAt =
    typeof input.createdAt === "string"
      ? new Date(input.createdAt)
      : input.createdAt;
  const result = new Date(createdAt);
  result.setDate(result.getDate() + QUESTION_CANCEL_GRACE_DAYS);
  return result;
}

export function isQuestionCancelAvailable(input: {
  createdAt: string | Date;
  answerDeadline: string | Date | null | undefined;
}) {
  return getQuestionCancelAvailableAt(input).getTime() <= Date.now();
}

export function getQuestionDeadlineState(input: {
  answerDeadline: string | Date | null | undefined;
}) {
  if (!input.answerDeadline) {
    return "no_deadline" as const;
  }

  const deadline =
    typeof input.answerDeadline === "string"
      ? new Date(input.answerDeadline)
      : input.answerDeadline;
  if (!isValidDate(deadline)) {
    return "no_deadline" as const;
  }

  return deadline.getTime() <= Date.now()
    ? ("expired" as const)
    : ("open" as const);
}
