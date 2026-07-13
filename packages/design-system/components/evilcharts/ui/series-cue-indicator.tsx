import { getChartColorVariable } from "@repo/design-system/components/evilcharts/ui/chart-config";
import type {
  ChartDotVariant,
  ChartSeriesCue,
} from "@repo/design-system/lib/chart-series-cue";
import type { CSSProperties } from "react";

interface ChartSeriesCueIndicatorProps {
  cue: ChartSeriesCue;
  dataKey: string;
}

/** Renders the same non-color series cue used by a chart inside its legend. */
export function ChartSeriesCueIndicator({
  cue,
  dataKey,
}: ChartSeriesCueIndicatorProps) {
  const color = getChartColorVariable(dataKey, 0);

  if (cue.kind === "bar") {
    const style: CSSProperties = {
      backgroundColor: color,
      borderRadius: Math.min(cue.radius, 5),
    };

    if (cue.variant === "hatched") {
      style.backgroundImage =
        "repeating-linear-gradient(135deg, transparent 0 2px, var(--background) 2px 3.5px)";
    }

    return <span className="h-2.5 w-3 shrink-0" style={style} />;
  }

  if (cue.kind === "point") {
    return (
      <svg aria-hidden="true" height="12" viewBox="0 0 14 12" width="14">
        <LegendMarker color={color} variant={cue.dot} x={7} y={6} />
      </svg>
    );
  }

  return (
    <svg aria-hidden="true" height="12" viewBox="0 0 18 12" width="18">
      <line
        stroke={color}
        strokeDasharray={cue.strokeDasharray}
        strokeLinecap="round"
        strokeWidth="2"
        x1="1"
        x2="17"
        y1="6"
        y2="6"
      />
      <LegendMarker color={color} variant={cue.dot} x={9} y={6} />
    </svg>
  );
}

function LegendMarker({
  color,
  variant,
  x,
  y,
}: {
  color: string;
  variant: ChartDotVariant;
  x: number;
  y: number;
}) {
  const shape = variant.replace("-border", "");

  if (shape === "square") {
    return <rect fill={color} height="5" width="5" x={x - 2.5} y={y - 2.5} />;
  }

  if (shape === "diamond") {
    return (
      <polygon
        fill={color}
        points={`${x},${y - 3.5} ${x + 3.5},${y} ${x},${y + 3.5} ${x - 3.5},${y}`}
      />
    );
  }

  if (shape === "triangle") {
    return (
      <polygon
        fill={color}
        points={`${x},${y - 3.5} ${x + 3.5},${y + 3} ${x - 3.5},${y + 3}`}
      />
    );
  }

  return <circle cx={x} cy={y} fill={color} r="2.75" />;
}
