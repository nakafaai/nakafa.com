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

/** A reading whose value uses tabular numerals, so digits keep their width. */
function VisualFactTabular({
  label,
  value,
}: {
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="text-muted-foreground">{label}</dt>
      <dd className="wrap-break-word text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

/** A tabular reading whose label may start with a color dot. */
function VisualFactIndicator({
  indicatorColor,
  label,
  value,
}: {
  indicatorColor?: string | undefined;
  label: ReactNode;
  value: ReactNode;
}) {
  return (
    <div className="flex min-w-0 flex-col gap-1">
      <dt className="flex items-center gap-2 text-muted-foreground">
        {indicatorColor ? (
          <span
            aria-hidden="true"
            className="size-2 rounded-full"
            style={{ backgroundColor: indicatorColor }}
          />
        ) : null}
        {label}
      </dt>
      <dd className="wrap-break-word text-foreground tabular-nums">{value}</dd>
    </div>
  );
}

export { VisualFact, VisualFactIndicator, VisualFactTabular };
