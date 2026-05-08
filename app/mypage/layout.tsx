import AppHeader from "@/app/components/AppHeader";
import AppFooter from "@/app/components/AppFooter";

export default function MyPageLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="min-h-screen bg-gray-50 text-black">
      <AppHeader />
      <main className="mx-auto w-full max-w-7xl px-4 py-6 sm:px-6 sm:py-8">
        {children}
      </main>
      <AppFooter />
    </div>
  );
}
