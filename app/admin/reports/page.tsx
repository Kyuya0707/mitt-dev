import { redirect } from "next/navigation";
import { getCurrentAdminUser } from "@/lib/admin";
import AdminNav from "../AdminNav";
import AdminReportsTable from "./AdminReportsTable";

export default async function AdminReportsPage() {
  const admin = await getCurrentAdminUser("OPERATIONS");
  if (!admin) redirect("/login?redirectTo=/admin/reports");

  return (
    <div className="mx-auto max-w-6xl p-6 text-black">
      <h1 className="mb-4 text-2xl font-bold">通報・異議申立て審査</h1>
      <AdminNav current="reports" />
      <AdminReportsTable />
    </div>
  );
}
