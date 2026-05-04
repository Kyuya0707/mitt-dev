import Link from "next/link";
import AppHeader from "@/app/components/AppHeader";
import AppFooter from "@/app/components/AppFooter";

type LegalPageLayoutProps = {
  title: string;
  description?: string;
  children: React.ReactNode;
};

export default function LegalPageLayout({
  title,
  description,
  children,
}: LegalPageLayoutProps) {
  return (
    <div className="min-h-screen bg-white text-black">
      <AppHeader />
      <main className="px-6 py-10">
        <div className="mx-auto max-w-4xl">
          <div className="mb-8">
            <Link href="/" className="text-sm text-blue-600 underline">
              ← ホームへ戻る
            </Link>
            <h1 className="mt-4 text-3xl font-bold">{title}</h1>
            {description && (
              <p className="mt-3 text-sm leading-7 text-gray-600">
                {description}
              </p>
            )}
          </div>
          <div className="space-y-8">{children}</div>
        </div>
      </main>
      <AppFooter />
    </div>
  );
}
