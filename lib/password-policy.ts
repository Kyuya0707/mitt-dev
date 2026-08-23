export const MIN_PASSWORD_LENGTH = 12;

export const PASSWORD_REQUIREMENTS_TEXT =
  "12文字以上で、英小文字・英大文字・数字・記号をそれぞれ1文字以上含めてください。";

const PASSWORD_SYMBOLS = "!@#$%^&*()_+-=[]{};'\\:\"|<>?,./`~";

export function isPasswordValid(password: string): boolean {
  return (
    password.length >= MIN_PASSWORD_LENGTH &&
    /[a-z]/.test(password) &&
    /[A-Z]/.test(password) &&
    /[0-9]/.test(password) &&
    [...password].some((character) => PASSWORD_SYMBOLS.includes(character))
  );
}
