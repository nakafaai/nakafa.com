import type { ReactNode } from "react";

/** One labelled reading of a lesson visual: a term and its value. */
function VisualFact({ label, value }: { label: ReactNode; value: ReactNode }) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground text-sm">{label}</dt>
      <dd className="wrap-break-word text-foreground">{value}</dd>
    </div>
  );
}

export { VisualFact };
