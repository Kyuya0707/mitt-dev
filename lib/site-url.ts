function trimTrailingSlash(value: string) {
  return value.replace(/\/$/, "");
}

export function getBaseUrl() {
  const configured =
    process.env.NEXT_PUBLIC_SITE_URL || process.env.SITE_URL;

  if (configured && configured.trim().length > 0) {
    return trimTrailingSlash(configured.trim());
  }

  if (process.env.NODE_ENV === "production") {
    return "https://knowvalue.jp";
  }

  return "http://localhost:3000";
}
