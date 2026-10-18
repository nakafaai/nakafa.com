import type { ChartDotVariant } from "@repo/design-system/lib/charts/series-cue";
import { cn } from "cn";
import { Schema } from "effect";
import { createContext, memo, use, useMemo } from "react";

type GeometricDotType = Extract<
  ChartDotVariant,
  | "square"
  | "square-border"
  | "diamond"
  | "diamond-border"
  | "triangle"
  | "triangle-border"
>;

/** Where the dot is drawn. Every shape of the dot reads its center from here. */
const GeometricDotPositionSchema = Schema.Struct({
  cx: Schema.Finite, // horizontal center of the dot
  cy: Schema.Finite, // vertical center of the dot
});

const GeometricDotContext = createContext<
  typeof GeometricDotPositionSchema.Type | null
>(null);

// Selects one part of the dot position, throwing a helpful error when used outside <GeometricDot />
function useGeometricDot<T>(
  selector: (dot: typeof GeometricDotPositionSchema.Type) => T
) {
  const value = use(GeometricDotContext);

  if (!value) {
    throw new Error("GeometricShape must be used within <GeometricDot />");
  }

  return selector(value);
}

interface GeometricDotProps {
  className?: string | undefined;
  cx: number;
  cy: number;
  fillOpacity: number;
  gradientUrl: string;
  maskUrl?: string | undefined;
  type: GeometricDotType;
}

/** Renders a solid or active outlined square, diamond, or triangle chart dot. */
export const GeometricDot = memo(function GeometricDot({
  className,
  cx,
  cy,
  fillOpacity,
  gradientUrl,
  maskUrl,
  type,
}: GeometricDotProps) {
  const position = useMemo(() => ({ cx, cy }), [cx, cy]);
  const isBorder = type.endsWith("-border");
  const shape = type.replace("-border", "");
  const outerRadius = isBorder ? 4.5 : 3.5;

  return (
    <GeometricDotContext value={position}>
      <g
        className={cn(className, isBorder && "text-background")}
        mask={maskUrl}
      >
        <GeometricShape
          fill={gradientUrl}
          fillOpacity={fillOpacity}
          radius={outerRadius}
          shape={shape}
        />
        {isBorder && (
          <GeometricShape fill="currentColor" radius={2.5} shape={shape} />
        )}
      </g>
    </GeometricDotContext>
  );
});

function GeometricShape({
  fill,
  fillOpacity,
  radius,
  shape,
}: {
  fill: string;
  fillOpacity?: number;
  radius: number;
  shape: string;
}) {
  const cx = useGeometricDot((dot) => dot.cx);
  const cy = useGeometricDot((dot) => dot.cy);

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
