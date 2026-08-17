import { redirect } from "next/navigation";
import { getCurrentAdminUser } from "@/lib/admin";
import AdminNav from "../AdminNav";
import SupportTicketsTable from "./SupportTicketsTable";

export default async function AdminSupportTicketsPage() {
  const admin = await getCurrentAdminUser("OPERATIONS");
  if (!admin) redirect("/mypage?mfa=required");
  return <main className="mx-auto max-w-6xl p-6 text-black">
    <h1 className="mb-4 text-2xl font-bold">お問い合わせ管理</h1>
    <AdminNav current="support-tickets" />
    <SupportTicketsTable />
  </main>;
}
