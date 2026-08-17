import AppHeader from "@/app/components/AppHeader";
import AdminNav from "../AdminNav";
import PayoutBatchesTable from "./PayoutBatchesTable";
import { getCurrentUserAdminStatus } from "@/lib/admin";

export default async function AdminPayoutBatchesPage() {
  const { user, canManageAccounting } = await getCurrentUserAdminStatus();
  if (!user || !canManageAccounting) {
    return <div className="p-6 text-sm text-red-700">閲覧権限がありません。</div>;
  }
  return (
    <div className="min-h-screen bg-white text-black">
      <AppHeader />
      <main className="mx-auto max-w-5xl px-6 py-6">
        <AdminNav current="payout-batches" />
        <h1 className="mb-6 text-2xl font-bold">月次一括振込</h1>
        <PayoutBatchesTable />
      </main>
    </div>
  );
}
