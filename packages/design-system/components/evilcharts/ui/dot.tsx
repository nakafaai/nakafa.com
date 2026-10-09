import { getChartSeriesId } from "@repo/design-system/components/evilcharts/ui/chart-config";
import { GeometricDot } from "@repo/design-system/components/evilcharts/ui/geometric-dot";
import type { ChartDotVariant } from "@repo/design-system/lib/charts/series-cue";
import { cn } from "cn";
import { Match } from "effect";
import { memo, useId } from "react";

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

  if (cx === undefined || cy === undefined) {
    return null;
  }

  return Match.value(type).pipe(
    Match.when("border", () => (
      <PrimaryBorderDot
        className={className}
        cx={cx}
        cy={cy}
        dotId={dotId}
        fillOpacity={fillOpacity}
        gradientUrl={gradientUrl}
        maskId={maskId}
      />
    )),
    Match.when("colored-border", () => (
      <ColoredBorderDot
        className={className}
        cx={cx}
        cy={cy}
        dotId={dotId}
        fillOpacity={fillOpacity}
        gradientUrl={gradientUrl}
        maskId={maskId}
      />
    )),
    Match.whenOr(
      "square",
      "square-border",
      "diamond",
      "diamond-border",
      "triangle",
      "triangle-border",
      (geometricType) => (
        <GeometricDot
          className={className}
          cx={cx}
          cy={cy}
          fillOpacity={fillOpacity}
          gradientUrl={gradientUrl}
          maskId={maskId}
          type={geometricType}
        />
      )
    ),
    Match.orElse(() => (
      <DefaultDot
        className={className}
        cx={cx}
        cy={cy}
        dotId={dotId}
        fillOpacity={fillOpacity}
        gradientUrl={gradientUrl}
        maskId={maskId}
      />
    ))
  );
});

interface DotVariantProps {
  className?: string | undefined;
  cx: number;
  cy: number;
  dotId: string;
  fillOpacity: number;
  gradientUrl: string;
  maskId?: string | undefined;
}

const DefaultDot = memo(
  ({
    cx,
    cy,
    dotId,
    fillOpacity,
    gradientUrl,
    className,
    maskId,
  }: DotVariantProps) => {
    const r = 3;
    return (
      <g className={className} mask={maskId ? `url(#${maskId})` : undefined}>
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
  }
);

DefaultDot.displayName = "DefaultDot";

const PrimaryBorderDot = memo(
  ({
    cx,
    cy,
    dotId,
    fillOpacity,
    gradientUrl,
    className,
    maskId,
  }: DotVariantProps) => {
    const r = 6;
    const strokeWidth = 5;
    return (
      <g
        className={cn(className, "text-background")}
        mask={maskId ? `url(#${maskId})` : undefined}
      >
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
  }
);

PrimaryBorderDot.displayName = "PrimaryBorderDot";

const ColoredBorderDot = memo(
  ({
    cx,
    cy,
    dotId,
    fillOpacity,
    gradientUrl,
    className,
    maskId,
  }: DotVariantProps) => {
    const r = 3;
    const strokeWidth = 1;
    return (
      <g
        className={cn(className, "text-background")}
        mask={maskId ? `url(#${maskId})` : undefined}
      >
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
  }
);

ColoredBorderDot.displayName = "ColoredBorderDot";

export { ChartDot };
