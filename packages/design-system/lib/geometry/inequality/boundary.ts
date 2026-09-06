import { GRAPH_BOUNDARY_SEGMENTS } from "@repo/design-system/components/three/helpers/quality";
import type { InequalitySampling } from "@repo/design-system/lib/geometry/inequality/region";

type Point = [number, number, number];

/** Samples the linear boundary or surface wireframe using the region's existing grid. */
export function sampleInequalityBoundary(
  sampling: InequalitySampling
): Point[] {
  const resolution = Math.min(sampling.resolution, GRAPH_BOUNDARY_SEGMENTS);
  const options = { ...sampling, resolution };
  if (sampling.is2D && sampling.boundaryLine2D) {
    return sampleLinearBoundary(options, sampling.boundaryLine2D);
  }
  if (!sampling.boundaryFunction) {
    return [];
  }
  return [
    ...sampleSurfaceEdges(options, sampling.boundaryFunction, "x"),
    ...sampleSurfaceEdges(options, sampling.boundaryFunction, "y"),
  ];
}

function sampleLinearBoundary(
  { resolution, xRange, yRange, zRange }: InequalitySampling,
  [a, b, c]: Point
): Point[] {
  const alongX = Math.abs(b) > 1e-10;
  if (!alongX && Math.abs(a) <= 1e-10) {
    return [];
  }
  const range = alongX ? xRange : yRange;
  const otherRange = alongX ? yRange : xRange;
  const step = (range[1] - range[0]) / resolution;
  const project = (value: number) =>
    alongX ? (-a * value - c) / b : (-b * value - c) / a;
  const point = (value: number, other: number, z: number): Point =>
    alongX ? [value, other, z] : [other, value, z];
  const points: Point[] = [];

  for (let index = 1; index <= resolution; index += 1) {
    const value = range[0] + index * step;
    const other = project(value);
    const previousValue = range[0] + (index - 1) * step;
    const previousOther = project(previousValue);
    if (!(inRange(other, otherRange) && inRange(previousOther, otherRange))) {
      continue;
    }
    points.push(
      point(previousValue, previousOther, zRange[0]),
      point(value, other, zRange[0])
    );
    points.push(
      point(previousValue, previousOther, zRange[1]),
      point(value, other, zRange[1])
    );
  }

  // The x sweep retains the existing vertical connectors; the y sweep has edge pairs only.
  if (alongX) {
    const connectorStep = Math.max(1, Math.floor(resolution / 4));
    for (let index = 0; index <= resolution; index += connectorStep) {
      const value = range[0] + index * step;
      const other = project(value);
      if (inRange(other, otherRange)) {
        points.push(
          point(value, other, zRange[0]),
          point(value, other, zRange[1])
        );
      }
    }
  }
  return points;
}

function inRange(value: number, range: [number, number]) {
  return value >= range[0] && value <= range[1];
}

function sampleSurfaceEdges(
  { resolution, xRange, yRange, zRange }: InequalitySampling,
  boundary: NonNullable<InequalitySampling["boundaryFunction"]>,
  axis: "x" | "y"
): Point[] {
  const xStep = (xRange[1] - xRange[0]) / resolution;
  const yStep = (yRange[1] - yRange[0]) / resolution;
  const gridStep = Math.max(1, Math.floor(resolution / 10));
  const point = (fixed: number, moving: number): Point => {
    const x = xRange[0] + (axis === "x" ? moving : fixed) * xStep;
    const y = yRange[0] + (axis === "y" ? moving : fixed) * yStep;
    return [x, y, boundary(x, y)];
  };
  const points: Point[] = [];
  for (let fixed = 0; fixed <= resolution; fixed += gridStep) {
    for (let moving = 1; moving <= resolution; moving += 1) {
      const current = point(fixed, moving);
      const previous = point(fixed, moving - 1);
      if (inRange(current[2], zRange) && inRange(previous[2], zRange)) {
        points.push(previous, current);
      }
    }
  }
  return points;
}
