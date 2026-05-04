import AppFooter from "@/app/components/AppFooter";
import AppHeader from "@/app/components/AppHeader";

export default function NotificationsLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-white text-black">
      <AppHeader />
      <main className="px-6 py-6">{children}</main>
      <AppFooter />
    </div>
  );
}
