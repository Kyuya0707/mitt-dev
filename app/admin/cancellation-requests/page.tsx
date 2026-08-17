import AppHeader from "@/app/components/AppHeader";
import { getCurrentUserAdminStatus } from "@/lib/admin";
import AdminNav from "../AdminNav";
import AdminCancellationRequestsTable from "./AdminCancellationRequestsTable";

export default async function AdminCancellationRequestsPage() {
  const { user, canManageOperations } = await getCurrentUserAdminStatus();

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

  if (!canManageOperations) {
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
          <AdminNav current="cancellation-requests" />
          <h1 className="mb-6 text-2xl font-bold">キャンセル申請管理</h1>
          <AdminCancellationRequestsTable />
        </div>
      </main>
    </div>
  );
}
