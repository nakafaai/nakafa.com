"use client";

import { Curve, type CurveProps } from "recharts";

// Buffer line

// Buffer line shape, renders the last segment as dashed while the rest stays solid.
// Renders a single <Curve> and uses a ref callback to measure the actual SVG path
// length via getTotalLength() + getPointAtLength(), then sets stroke-dasharray
// imperatively. Works correctly with any curve type (linear, natural, monotone, etc.).
type CurvePoint = NonNullable<NonNullable<CurveProps["points"]>[number]>;

type DrawableCurvePoint = CurvePoint & { x: number; y: number };

const isDrawableCurvePoint = (point: CurvePoint): point is DrawableCurvePoint =>
  typeof point.x === "number" && typeof point.y === "number";

const BUFFER_DASH_SIZE = 4;

const BUFFER_GAP_SIZE = 3;

// Binary-search the path to find the length at which path.x ≈ targetX,
// using the browser's native getPointAtLength for exact curve measurement.
const findLengthAtX = (
  path: SVGPathElement,
  totalLength: number,
  targetX: number
): number => {
  let lo = 0;
  let hi = totalLength;
  // ~0.5px precision is more than enough for a dasharray split
  while (hi - lo > 0.5) {
    const mid = (lo + hi) / 2;
    const pt = path.getPointAtLength(mid);
    if (pt.x < targetX) {
      lo = mid;
    } else {
      hi = mid;
    }
  }
  return (lo + hi) / 2;
};

export const bufferLineShape = (props: CurveProps) => {
  const { points, ...rest } = props;

  if (!points || points.length < 2) {
    return <Curve {...props} />;
  }

  const drawablePoints = points.filter(isDrawableCurvePoint);

  if (drawablePoints.length < 2) {
    return <Curve {...props} />;
  }

  // x coordinate of the second-to-last point, where solid meets dashed
  const splitPoint = drawablePoints.at(-2);
  if (!splitPoint) {
    return <Curve {...props} />;
  }
  const splitX = splitPoint.x;

  // Ref callback runs synchronously during React commit (before browser paint),
  // so there's no visible flash of an un-dashed line.
  const gRef = (g: SVGGElement | null) => {
    if (!g) {
      return;
    }
    const path = g.querySelector("path");
    if (!path) {
      return;
    }

    const totalLength = path.getTotalLength();
    const solidLength = findLengthAtX(path, totalLength, splitX);
    const lastSegmentLength = totalLength - solidLength;

    // Build dasharray: solid run, then repeating dash-gap for the buffer segment
    const reps =
      Math.ceil(lastSegmentLength / (BUFFER_DASH_SIZE + BUFFER_GAP_SIZE)) + 1;
    const dashedPart = Array.from(
      { length: reps },
      () => `${BUFFER_DASH_SIZE} ${BUFFER_GAP_SIZE}`
    ).join(" ");

    path.setAttribute("stroke-dasharray", `${solidLength} 0 ${dashedPart}`);
  };

  return (
    <g ref={gRef}>
      <Curve {...rest} points={drawablePoints} />
    </g>
  );
};
