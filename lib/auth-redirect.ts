const DEFAULT_AUTH_REDIRECT = "/mypage";

function isSafeInternalPath(value: string | null | undefined) {
  return typeof value === "string" && value.startsWith("/") && !value.startsWith("//");
}

export function resolveAuthRedirect(
  values: Array<string | null | undefined>,
  fallback = DEFAULT_AUTH_REDIRECT
) {
  for (const value of values) {
    if (isSafeInternalPath(value)) {
      return value;
    }
  }

  return fallback;
}

export { DEFAULT_AUTH_REDIRECT };
