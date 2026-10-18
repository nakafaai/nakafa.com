import { getChartSeriesId } from "@repo/design-system/components/evilcharts/ui/chart-config";
import {
  GeometricDotContext,
  GeometricShape,
} from "@repo/design-system/components/evilcharts/ui/geometric-dot";
import type { ChartDotVariant } from "@repo/design-system/lib/charts/series-cue";
import { cn } from "cn";
import { Match, Schema } from "effect";
import { createContext, memo, use, useId, useMemo } from "react";

export type DotVariant = ChartDotVariant;

interface ChartDotProps {
  chartId: string;
  className?: string;
  cx?: number;
  cy?: number;
  dataKey: string;
  fillOpacity?: number;
  /** Optional SVG <mask> id that lets the dot share an area's intro reveal wipe. */
  maskId?: string | undefined;
  type?: DotVariant | undefined;
}

/** The position and paint of one chart dot, shared by the parts that draw it. */
const ChartDotSchema = Schema.Struct({
  className: Schema.UndefinedOr(Schema.String), // extra classes of the dot
  cx: Schema.Finite, // horizontal center of the dot
  cy: Schema.Finite, // vertical center of the dot
  dotId: Schema.String, // id that keeps the clip paths of this dot apart
  fillOpacity: Schema.Finite, // opacity of the dot's fill
  gradientUrl: Schema.String, // reference to the gradient of the series
  maskUrl: Schema.UndefinedOr(Schema.String), // reference to the reveal mask, when the area has one
});

const ChartDotContext = createContext<typeof ChartDotSchema.Type | null>(null);

// Selects one part of the dot, throwing a helpful error when used outside <ChartDot />
function useChartDot<T>(selector: (dot: typeof ChartDotSchema.Type) => T) {
  const value = use(ChartDotContext);

  if (!value) {
    throw new Error("Dot parts must be used within <ChartDot />");
  }

  return selector(value);
}

const ChartDot = memo(function ChartDot({
  cx,
  cy,
  dataKey,
  chartId,
  className,
  fillOpacity = 1,
  type = "default",
  maskId,
}: ChartDotProps) {
  const dotId = useId().replace(/:/g, "");
  const gradientUrl = `url(#${getChartSeriesId(chartId, "colors", dataKey)})`;
  const maskUrl = maskId ? `url(#${maskId})` : undefined;
  const dot = useMemo(
    () =>
      cx === undefined || cy === undefined
        ? null
        : {
            className,
            cx,
            cy,
            dotId,
            fillOpacity,
            gradientUrl,
            maskUrl,
          },
    [className, cx, cy, dotId, fillOpacity, gradientUrl, maskUrl]
  );

  if (dot === null) {
    return null;
  }

  return (
    <ChartDotContext value={dot}>
      {Match.value(type).pipe(
        Match.when("border", () => <PrimaryBorderDot />),
        Match.when("colored-border", () => <ColoredBorderDot />),
        Match.whenOr(
          "square",
          "square-border",
          "diamond",
          "diamond-border",
          "triangle",
          "triangle-border",
          (geometricType) => <GeometricDot type={geometricType} />
        ),
        Match.orElse(() => <DefaultDot />)
      )}
    </ChartDotContext>
  );
});

const DefaultDot = memo(() => {
  const { className, cx, cy, dotId, fillOpacity, gradientUrl, maskUrl } =
    useChartDot((dot) => dot);
  const r = 3;
  return (
    <g className={className} mask={maskUrl}>
      <defs>
        <clipPath id={`dot-clip-${dotId}`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      {/* Full-width gradient rectangle clipped to dot shape */}
      <rect
        clipPath={`url(#dot-clip-${dotId})`}
        fill={gradientUrl}
        fillOpacity={fillOpacity}
        height={r * 2}
        width="100%"
        x="0"
        y={cy - r}
      />
    </g>
  );
});

DefaultDot.displayName = "DefaultDot";

const PrimaryBorderDot = memo(() => {
  const { className, cx, cy, dotId, fillOpacity, gradientUrl, maskUrl } =
    useChartDot((dot) => dot);
  const r = 6;
  const strokeWidth = 5;
  return (
    <g className={cn(className, "text-background")} mask={maskUrl}>
      <defs>
        <clipPath id={`dot-clip-${dotId}`}>
          <circle cx={cx} cy={cy} r={r} />
        </clipPath>
      </defs>
      {/* Background stroke (border) */}
      <circle cx={cx} cy={cy} fill="currentColor" r={r} />
      {/* Inner gradient circle clipped */}
      <rect
        clipPath={`url(#dot-clip-inner-${dotId})`}
        fill={gradientUrl}
        fillOpacity={fillOpacity}
        height={(r - strokeWidth / 2) * 2}
        width="100%"
        x="0"
        y={cy - (r - strokeWidth / 2)}
      />
      <defs>
        <clipPath id={`dot-clip-inner-${dotId}`}>
          <circle cx={cx} cy={cy} r={r - strokeWidth / 2} />
        </clipPath>
      </defs>
    </g>
  );
});

PrimaryBorderDot.displayName = "PrimaryBorderDot";

const ColoredBorderDot = memo(() => {
  const { className, cx, cy, dotId, fillOpacity, gradientUrl, maskUrl } =
    useChartDot((dot) => dot);
  const r = 3;
  const strokeWidth = 1;
  return (
    <g className={cn(className, "text-background")} mask={maskUrl}>
      <defs>
        <clipPath id={`dot-clip-${dotId}`}>
          <circle cx={cx} cy={cy} r={r + strokeWidth / 2} />
        </clipPath>
      </defs>
      {/* Gradient stroke (border) via clipped rect */}
      <rect
        clipPath={`url(#dot-clip-${dotId})`}
        fill={gradientUrl}
        fillOpacity={fillOpacity}
        height={(r + strokeWidth / 2) * 2}
        width="100%"
        x="0"
        y={cy - r - strokeWidth / 2}
      />
      {/* Inner solid fill */}
      <circle cx={cx} cy={cy} fill="currentColor" r={r - strokeWidth / 2} />
    </g>
  );
});

ColoredBorderDot.displayName = "ColoredBorderDot";

type GeometricDotType = Extract<
  ChartDotVariant,
  | "square"
  | "square-border"
  | "diamond"
  | "diamond-border"
  | "triangle"
  | "triangle-border"
>;

/** Renders a solid or active outlined square, diamond, or triangle chart dot. */
const GeometricDot = memo(function GeometricDot({
  type,
}: {
  type: GeometricDotType;
}) {
  const { className, cx, cy, fillOpacity, gradientUrl, maskUrl } = useChartDot(
    (dot) => dot
  );
  const fillShape = useMemo(
    () => ({ cx, cy, fill: gradientUrl, fillOpacity }),
    [cx, cy, fillOpacity, gradientUrl]
  );
  const borderShape = useMemo(
    () => ({ cx, cy, fill: "currentColor", fillOpacity: undefined }),
    [cx, cy]
  );
  const isBorder = type.endsWith("-border");
  const shape = type.replace("-border", "");
  const outerRadius = isBorder ? 4.5 : 3.5;

  return (
    <g className={cn(className, isBorder && "text-background")} mask={maskUrl}>
      <GeometricDotContext value={fillShape}>
        <GeometricShape radius={outerRadius} shape={shape} />
      </GeometricDotContext>
      {isBorder && (
        <GeometricDotContext value={borderShape}>
          <GeometricShape radius={2.5} shape={shape} />
        </GeometricDotContext>
      )}
    </g>
  );
});

export { ChartDot };
