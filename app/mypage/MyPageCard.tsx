import type { ReactNode } from "react";

type MyPageCardProps = {
  title: string;
  description?: string;
  children: ReactNode;
  actions?: ReactNode;
  className?: string;
  collapsible?: boolean;
  defaultOpen?: boolean;
};

export default function MyPageCard({
  title,
  description,
  children,
  actions,
  className = "",
  collapsible = false,
  defaultOpen = false,
}: MyPageCardProps) {
  if (collapsible) {
    return (
      <details
        open={defaultOpen ? true : undefined}
        className={`group rounded-2xl border border-gray-200 bg-white shadow-sm ${className}`.trim()}
      >
        <summary className="flex cursor-pointer list-none items-center justify-between gap-4 p-5 transition hover:bg-gray-50 sm:p-6 [&::-webkit-details-marker]:hidden">
          <div>
            <h2 className="text-lg font-semibold text-gray-950">{title}</h2>
            {description && (
              <p className="mt-1 text-sm leading-6 text-gray-600">{description}</p>
            )}
          </div>
          <span
            aria-hidden="true"
            className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-gray-100 text-lg text-gray-600 transition group-open:rotate-180"
          >
            ⌄
          </span>
        </summary>
        <div className="border-t border-gray-100 p-5 sm:p-6">
          {actions && <div className="mb-4 flex justify-end">{actions}</div>}
          {children}
        </div>
      </details>
    );
  }

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
