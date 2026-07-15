import type { ChartDotVariant } from "@repo/design-system/lib/charts/series-cue";
import { cn } from "@repo/design-system/lib/utils";
import { memo } from "react";

type GeometricDotType = Extract<
  ChartDotVariant,
  | "square"
  | "square-border"
  | "diamond"
  | "diamond-border"
  | "triangle"
  | "triangle-border"
>;

interface GeometricDotProps {
  className?: string;
  cx: number;
  cy: number;
  fillOpacity: number;
  gradientUrl: string;
  maskId?: string;
  type: GeometricDotType;
}

/** Renders a solid or active outlined square, diamond, or triangle chart dot. */
export const GeometricDot = memo(function GeometricDot({
  className,
  cx,
  cy,
  fillOpacity,
  gradientUrl,
  maskId,
  type,
}: GeometricDotProps) {
  const isBorder = type.endsWith("-border");
  const shape = type.replace("-border", "");
  const outerRadius = isBorder ? 4.5 : 3.5;

  return (
    <g
      className={cn(className, isBorder && "text-background")}
      mask={maskId ? `url(#${maskId})` : undefined}
    >
      <GeometricShape
        cx={cx}
        cy={cy}
        fill={gradientUrl}
        fillOpacity={fillOpacity}
        radius={outerRadius}
        shape={shape}
      />
      {isBorder && (
        <GeometricShape
          cx={cx}
          cy={cy}
          fill="currentColor"
          radius={2.5}
          shape={shape}
        />
      )}
    </g>
  );
});

function GeometricShape({
  cx,
  cy,
  fill,
  fillOpacity,
  radius,
  shape,
}: {
  cx: number;
  cy: number;
  fill: string;
  fillOpacity?: number;
  radius: number;
  shape: string;
}) {
  if (shape === "square") {
    return (
      <rect
        fill={fill}
        fillOpacity={fillOpacity}
        height={radius * 2}
        width={radius * 2}
        x={cx - radius}
        y={cy - radius}
      />
    );
  }

  if (shape === "diamond") {
    return (
      <polygon
        fill={fill}
        fillOpacity={fillOpacity}
        points={`${cx},${cy - radius} ${cx + radius},${cy} ${cx},${cy + radius} ${cx - radius},${cy}`}
      />
    );
  }

  return (
    <polygon
      fill={fill}
      fillOpacity={fillOpacity}
      points={`${cx},${cy - radius} ${cx + radius},${cy + radius} ${cx - radius},${cy + radius}`}
    />
  );
}
