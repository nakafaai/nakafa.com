import type { ReactNode } from "react";

/** Renders the production summary card used by try-out section pages. */
export function TryoutPartSummary({ children }: { children: ReactNode }) {
  return (
    <section className="space-y-4 rounded-xl border bg-card p-5 shadow-sm">
      {children}
    </section>
  );
}

/** Stacks the summary lead metrics and CTAs. */
export function TryoutPartBody({ children }: { children: ReactNode }) {
  return <div className="flex flex-col gap-2">{children}</div>;
}

/** Holds the primary summary metrics. */
export function TryoutPartLead({ children }: { children: ReactNode }) {
  return <div className="flex flex-1 flex-col gap-5">{children}</div>;
}

/** Lays out the summary metric columns. */
export function TryoutPartStats({ children }: { children: ReactNode }) {
  return (
    <div className="grid w-full max-w-xl gap-x-8 gap-y-3 sm:grid-cols-2 sm:gap-x-10">
      {children}
    </div>
  );
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
    <div className="flex flex-col text-left">
      <span className="text-muted-foreground text-xs uppercase tracking-wide">
        {label}
      </span>
      {children}
    </div>
  );
}

/** Renders summary card CTAs with production spacing. */
export function TryoutPartCtas({ children }: { children: ReactNode }) {
  return <div className="flex flex-wrap gap-3">{children}</div>;
}
