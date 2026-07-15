interface VectorTooltipEntry {
  color?: string;
  name?: number | string;
  payload?: unknown;
  value?: unknown;
}

interface VectorChartTooltipProps {
  active?: boolean;
  payload?: readonly VectorTooltipEntry[];
}

/** Renders vector coordinates with their series names in the chart tooltip. */
export function VectorChartTooltip({
  active,
  payload,
}: VectorChartTooltipProps) {
  if (!(active && payload) || payload.length === 0) {
    return null;
  }

  const xValue = getXValue(payload[0]?.payload);

  return (
    <div className="grid min-w-32 items-start gap-1.5 rounded-lg border border-border/50 bg-background px-2.5 py-1.5 text-sm shadow-xl">
      {payload.map((entry) => {
        if (typeof entry.value !== "number") {
          return null;
        }

        const name = String(entry.name ?? "");

        return (
          <div
            className="flex items-center gap-2"
            key={`tooltip-${name}-${entry.value}`}
          >
            <div
              className="h-2 w-2 shrink-0 rounded-xs"
              style={{ backgroundColor: entry.color }}
            />
            <span className="font-medium">{name}</span>
            <span className="ml-auto font-mono tracking-tight">
              ({xValue}, {entry.value})
            </span>
          </div>
        );
      })}
    </div>
  );
}

function getXValue(payload: unknown) {
  if (!payload || typeof payload !== "object" || !("x" in payload)) {
    return "";
  }

  return typeof payload.x === "number" ? payload.x : "";
}
