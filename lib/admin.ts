import { getCurrentUser } from "@/lib/auth";
import { supabaseServer } from "@/lib/supabase-server";

export type AdminRole = "OWNER" | "OPERATIONS" | "ACCOUNTING";

function parseEmails(value?: string) {
  return (value ?? "")
    .split(",")
    .map((email) => email.trim().toLowerCase())
    .filter(Boolean);
}

export function getAdminRole(email?: string | null): AdminRole | null {
  if (!email) return null;
  const normalized = email.trim().toLowerCase();
  const ownerEmails = new Set([
    ...parseEmails(process.env.ADMIN_OWNER_EMAILS),
    ...parseEmails(process.env.ADMIN_EMAILS),
  ]);
  if (ownerEmails.has(normalized)) return "OWNER";
  if (parseEmails(process.env.ADMIN_OPERATIONS_EMAILS).includes(normalized)) {
    return "OPERATIONS";
  }
  if (parseEmails(process.env.ADMIN_ACCOUNTING_EMAILS).includes(normalized)) {
    return "ACCOUNTING";
  }
  return null;
}

export function isAdminEmail(email?: string | null) {
  return getAdminRole(email) !== null;
}

export async function getCurrentAdminUser(requiredRole?: AdminRole) {
  const user = await getCurrentUser();
  const role = getAdminRole(user?.email);
  if (!user || !role) return null;
  const supabase = await supabaseServer();
  const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
  if (assurance?.currentLevel !== "aal2") return null;
  if (requiredRole && role !== "OWNER" && role !== requiredRole) return null;
  return user;
}

export async function getCurrentUserAdminStatus() {
  const user = await getCurrentUser();
  const role = getAdminRole(user?.email);
  let mfaVerified = false;
  if (user && role) {
    const supabase = await supabaseServer();
    const { data: assurance } = await supabase.auth.mfa.getAuthenticatorAssuranceLevel();
    mfaVerified = assurance?.currentLevel === "aal2";
  }
  return {
    user,
    role,
    isAdmin: role !== null && mfaVerified,
    mfaVerified,
    canManageOperations: mfaVerified && (role === "OWNER" || role === "OPERATIONS"),
    canManageAccounting: mfaVerified && (role === "OWNER" || role === "ACCOUNTING"),
    isOwner: mfaVerified && role === "OWNER",
  };
}
