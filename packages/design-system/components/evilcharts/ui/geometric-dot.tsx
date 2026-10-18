import { Schema } from "effect";
import { createContext, use } from "react";

/** The center and the paint of one shape of a geometric dot. */
const GeometricShapeSchema = Schema.Struct({
  cx: Schema.Finite, // horizontal center of the shape
  cy: Schema.Finite, // vertical center of the shape
  fill: Schema.String, // fill of the shape: a gradient reference or a color
  fillOpacity: Schema.UndefinedOr(Schema.Finite), // opacity of the fill, absent for the border
});

/** Provided by the geometric dot for each of its shapes, read by the shape that draws it. */
const GeometricDotContext = createContext<
  typeof GeometricShapeSchema.Type | null
>(null);

// Selects the center and paint of one shape, throwing a helpful error when used outside a geometric dot
function useGeometricDot<T>(
  selector: (shape: typeof GeometricShapeSchema.Type) => T
) {
  const value = use(GeometricDotContext);

  if (!value) {
    throw new Error("GeometricShape must be used within a geometric dot");
  }

  return selector(value);
}

/** Renders a solid or active outlined square, diamond, or triangle of a chart dot. */
function GeometricShape({ radius, shape }: { radius: number; shape: string }) {
  const { cx, cy, fill, fillOpacity } = useGeometricDot(
    (geometric) => geometric
  );

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

export { GeometricDotContext, GeometricShape };
