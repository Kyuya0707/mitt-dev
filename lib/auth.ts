// lib/auth.ts
import { supabaseServer } from "./supabase-server";
import prisma from "@/lib/prisma";

export async function getCurrentUser() {
  const supabase = await supabaseServer(); // ✅ await を付ける

  const { data, error } = await supabase.auth.getUser();
  if (error || !data.user) {
    console.warn("⚠️ Supabase getUser error:", error?.message);
    return null;
  }

  const supaUser = data.user;

  // 必要ならここで Prisma User 同期（前に書いた処理でOK）
  return supaUser;
}
