import { Skeleton } from "@repo/design-system/components/ui/skeleton";

/** The square box that loading and loaded weather share, so the grid does not move. */
export function WeatherCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex aspect-square flex-col justify-between overflow-hidden rounded-md border bg-linear-to-br from-[color-mix(in_oklch,var(--secondary)_19%,var(--card))] to-[color-mix(in_oklch,var(--primary)_19%,var(--card))] p-3 text-card-foreground shadow-xs">
      {children}
    </div>
  );
}

export function WeatherCardHeader({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex items-start justify-between gap-2">{children}</div>
  );
}

/**
 * The cell of weather that cannot be read. It keeps the box of the card and
 * shows nothing, so the other card of the grid stays in its own column.
 */
export function WeatherGap() {
  return <div aria-hidden="true" className="aspect-square" />;
}

/** The loading state, drawn in the same box as the loaded widget. */
export function WeatherSkeleton() {
  return (
    <WeatherCard>
      <div className="flex flex-col gap-2">
        <WeatherCardHeader>
          <Skeleton className="h-6 w-16" />
          <Skeleton className="size-6" />
        </WeatherCardHeader>
        <Skeleton className="h-3 w-20" />
      </div>

      <Skeleton className="h-3 w-24" />
    </WeatherCard>
  );
}
