import type { ReactNode } from "react";

// Section title: uppercase display heading, optional key-styled meta, actions.
export default function SectionHeader({
  title,
  meta,
  actions,
  className = "mb-5",
}: {
  title: ReactNode;
  meta?: ReactNode;
  actions?: ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-baseline justify-between gap-x-4 gap-y-2 ${className}`}>
      <div className="flex min-w-0 flex-wrap items-baseline gap-x-4 gap-y-1">
        <h2 className="sam-head">{title}</h2>
        {meta && <span className="sam-key">{meta}</span>}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
    </div>
  );
}
