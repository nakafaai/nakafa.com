import {
  createCircleArcLine,
  createCircleChordPoints,
  createCircleOutlinePoints,
  createCircleRadiusPoints,
  createCircleSegmentBoundaryLines,
} from "@repo/design-system/components/contents/mathematics/circle";
import type { LineEquation } from "@repo/design-system/components/three/line-equation";
import type { ComponentProps } from "react";

type RenderLine = ComponentProps<typeof LineEquation>;
type CircleLine = Omit<RenderLine, "points">;
interface CircleAngle {
  readonly radius: number;
  readonly startDegrees: number;
  readonly sweepDegrees: number;
}
type CircleArc = Parameters<typeof createCircleArcLine>[0];
interface CircleRadius {
  readonly degrees: number;
  readonly radius: number;
}

interface CircleOutlineLine extends CircleLine {
  readonly kind: "circle-outline";
  readonly radius: number;
}

interface CircleChordLine extends CircleAngle, CircleLine {
  readonly kind: "circle-chord";
}

interface CircleRadiusLine extends CircleLine, CircleRadius {
  readonly kind: "circle-radius";
}

interface CircleArcLine extends CircleArc {
  readonly kind: "circle-arc";
}

interface CircleSegmentLine extends CircleArc {
  readonly kind: "circle-segment";
}

/** Declarative or already-resolved line accepted by the mathematics renderer. */
export type AuthoredLine =
  | CircleArcLine
  | CircleChordLine
  | CircleOutlineLine
  | CircleRadiusLine
  | CircleSegmentLine
  | RenderLine;

/** Expands one declarative circle line into the concrete 3D line contract. */
function resolveLine(line: AuthoredLine): RenderLine[] {
  if (!("kind" in line)) {
    return [line];
  }

  if (line.kind === "circle-outline") {
    const { kind: _kind, radius, ...props } = line;
    return [{ ...props, points: createCircleOutlinePoints(radius) }];
  }

  if (line.kind === "circle-chord") {
    const { kind: _kind, radius, startDegrees, sweepDegrees, ...props } = line;
    return [
      {
        ...props,
        points: createCircleChordPoints({
          radius,
          startDegrees,
          sweepDegrees,
        }),
      },
    ];
  }

  if (line.kind === "circle-radius") {
    const { degrees, kind: _kind, radius, ...props } = line;
    return [
      {
        ...props,
        points: createCircleRadiusPoints({ degrees, radius }),
      },
    ];
  }

  if (line.kind === "circle-arc") {
    const { kind: _kind, ...arc } = line;
    return [createCircleArcLine(arc)];
  }

  const { kind: _kind, ...segment } = line;
  return createCircleSegmentBoundaryLines(segment);
}

/** Resolves authored line primitives while preserving their declared order. */
export function resolveAuthoredLines(lines: readonly AuthoredLine[]) {
  return lines.flatMap(resolveLine);
}
