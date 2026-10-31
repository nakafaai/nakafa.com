/** The square box of the weather, which fades in over the cell that held its place. */
export function WeatherCard({ children }: { children: React.ReactNode }) {
  return (
    <div className="text-card-foreground flex aspect-square flex-col justify-between overflow-hidden rounded-md border bg-linear-to-br from-[color-mix(in_oklch,var(--secondary)_19%,var(--card))] to-[color-mix(in_oklch,var(--primary)_19%,var(--card))] p-3 shadow-xs transition-opacity duration-300 starting:opacity-0">
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
 * The cell of weather that has no reading: while its request runs, and when it
 * failed. It keeps the box of the card and draws nothing, so the page shows no
 * empty frame and the other card of the grid stays in its own column.
 */
export function WeatherGap() {
  return <div aria-hidden="true" className="aspect-square" />;
}
