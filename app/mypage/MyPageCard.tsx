import type { ReactNode } from "react";

type MyPageCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
};

export default function MyPageCard({
  title,
  description,
  children,
  actions,
  className = "",
}: MyPageCardProps) {
  return (
    <section
      className={`rounded-2xl border border-gray-200 bg-white p-5 shadow-sm sm:p-6 ${className}`.trim()}
    >
      <div className="mb-4 flex items-start justify-between gap-4">
        <div>
          <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
          {description && (
            <p className="mt-1 text-sm leading-6 text-gray-600">{description}</p>
          )}
        </div>
        {actions && <div className="shrink-0">{actions}</div>}
      </div>
      {children}
    </section>
  );
}
