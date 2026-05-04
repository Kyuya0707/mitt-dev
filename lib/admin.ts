import { getCurrentUser } from "@/lib/auth";

function getAdminEmails() {
  return (process.env.ADMIN_EMAILS ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter((email) => email.length > 0);
}

export function isAdminEmail(email?: string | null) {
  if (!email) {
    return false;
  }

  return getAdminEmails().includes(email.trim().toLowerCase());
}

export async function getCurrentAdminUser() {
  const user = await getCurrentUser();

  if (!user || !isAdminEmail(user.email)) {
    return null;
  }

  return user;
}

export async function getCurrentUserAdminStatus() {
  const user = await getCurrentUser();

  return {
    user,
    isAdmin: isAdminEmail(user?.email),
  };
}
