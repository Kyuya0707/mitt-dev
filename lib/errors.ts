type ErrorLike =
  | string
  | null
  | undefined
  | {
      error?: string;
      message?: string;
      code?: string;
    };

const ERROR_MAP: Array<{ match: string; message: string }> = [
  { match: "unauthorized", message: "ログインが必要です" },
  { match: "not authorized", message: "権限がありません" },
  { match: "forbidden", message: "権限がありません" },
  { match: "not allowed", message: "権限がありません" },
  { match: "not found", message: "データが見つかりません" },
  { match: "missing parameters", message: "必要な情報が不足しています" },
  { match: "invalid request", message: "入力内容を確認してください" },
  { match: "invalid_request_error", message: "リクエストが不正です" },
  { match: "balance_insufficient", message: "残高が不足しています" },
  { match: "server error", message: "予期しないエラーが発生しました" },
  {
    match: "internal server error",
    message: "予期しないエラーが発生しました",
  },
];

function extractMessage(input: ErrorLike) {
  if (typeof input === "string") {
    return input.trim();
  }

  if (!input) {
    return "";
  }

  return (input.error ?? input.message ?? input.code ?? "").trim();
}

function looksJapanese(message: string) {
  return /[\u3040-\u30ff\u3400-\u9fff]/.test(message);
}

export function toJapaneseErrorMessage(
  input: ErrorLike,
  fallback = "予期しないエラーが発生しました"
) {
  const message = extractMessage(input);

  if (!message) {
    return fallback;
  }

  if (looksJapanese(message)) {
    return message;
  }

  const lower = message.toLowerCase();

  for (const entry of ERROR_MAP) {
    if (lower.includes(entry.match)) {
      return entry.message;
    }
  }

  if (lower.includes("balance")) {
    return "残高が不足しています";
  }

  if (lower.includes("invalid")) {
    return "入力内容を確認してください";
  }

  return fallback;
}
