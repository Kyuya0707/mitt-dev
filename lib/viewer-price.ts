export const MAX_VIEWER_PRICE_JPY = 100000;

type ViewerPriceValidationResult =
  | { ok: true; value: number }
  | { ok: false; message: string };

export function validateViewerPrice(raw: unknown): ViewerPriceValidationResult {
  if (raw === null || raw === undefined || raw === "") {
    return { ok: false, message: "BEST閲覧価格を入力してください" };
  }

  const value = typeof raw === "number" ? raw : Number(raw);

  if (!Number.isFinite(value)) {
    return { ok: false, message: "BEST閲覧価格は数値で入力してください" };
  }

  if (!Number.isInteger(value)) {
    return { ok: false, message: "BEST閲覧価格は整数で入力してください" };
  }

  if (value <= 0) {
    return { ok: false, message: "BEST閲覧価格は1円以上で入力してください" };
  }

  if (value > MAX_VIEWER_PRICE_JPY) {
    return {
      ok: false,
      message: `BEST閲覧価格は${MAX_VIEWER_PRICE_JPY.toLocaleString("ja-JP")}円以下で入力してください`,
    };
  }

  return { ok: true, value };
}
