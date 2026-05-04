import AppHeader from "@/app/components/AppHeader";
import { getCurrentUserAdminStatus } from "@/lib/admin";
import AdminPayoutsTable from "./AdminPayoutsTable";
import AdminNav from "../AdminNav";

export default async function AdminPayoutsPage() {
  const { user, isAdmin } = await getCurrentUserAdminStatus();

  if (!user) {
    return (
      <div className="min-h-screen bg-white text-black">
        <AppHeader />
        <main className="px-6 py-6">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm text-gray-700">ログインしてください。</p>
          </div>
        </main>
      </div>
    );
  }

  if (!isAdmin) {
    return (
      <div className="min-h-screen bg-white text-black">
        <AppHeader />
        <main className="px-6 py-6">
          <div className="mx-auto max-w-5xl">
            <p className="text-sm text-red-700">管理者のみ閲覧できます。</p>
          </div>
        </main>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-white text-black">
      <AppHeader />
      <main className="px-6 py-6">
        <div className="mx-auto max-w-5xl">
          <AdminNav current="payouts" />
          <h1 className="mb-6 text-2xl font-bold">Payout 管理</h1>
          <AdminPayoutsTable />
        </div>
      </main>
    </div>
  );
}
