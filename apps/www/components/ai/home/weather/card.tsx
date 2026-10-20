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

/** The frame of the widget at its final size, with nothing drawn in it until the widget loads. */
export function WeatherFrame() {
  return <WeatherCard>{null}</WeatherCard>;
}
