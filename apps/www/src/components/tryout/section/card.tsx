import type { ReactNode } from "react";

/** Renders the production summary card used by try-out section pages. */
export function TryoutPartSummary({ children }: { children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm [--number-flow-mask-height:0.125em]">
      {children}
    </section>
  );
}

/** Lays out the summary metric columns. */
export function TryoutPartStats({ children }: { children: ReactNode }) {
  return <div className="grid w-full gap-6 sm:grid-cols-2">{children}</div>;
}

/** Renders one labeled summary metric. */
export function TryoutPartStat({
  children,
  label,
}: {
  children: ReactNode;
  label: ReactNode;
}) {
  return (
    <div className="flex flex-col gap-1 text-left">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </span>
      {children}
    </div>
  );
}
