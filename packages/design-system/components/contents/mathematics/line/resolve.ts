import {
  createCircleArcLine,
  createCircleChordPoints,
  createCircleOutlinePoints,
  createCircleRadiusPoints,
  createCircleSegmentBoundaryLines,
} from "@repo/design-system/components/contents/mathematics/circle";
import { createCuboidLines } from "@repo/design-system/components/contents/mathematics/cuboid";
import {
  IntervalSchema,
  intervalOf,
} from "@repo/design-system/components/contents/mathematics/interval";
import { sampleCurve } from "@repo/design-system/components/contents/mathematics/line/curve";
import type {
  AuthoredLine,
  CurveLine,
  ResolvedLine,
} from "@repo/design-system/components/contents/mathematics/line/spec";
import { Array as Arr, Option, Schema } from "effect";

/**
 * Expands one curve into one resolved line per branch. Every branch keeps the
 * style of the curve, and its labels go on the middle branch in x order, so a
 * tangent with several branches labels its central one.
 */
function resolveCurveLine({ curve, ...line }: CurveLine): ResolvedLine[] {
  const { labels, ...style } = line;
  const branches = sampleCurve(curve);
  const middle = Math.floor(branches.length / 2);
  return Arr.map(branches, (points, index) => ({
    ...style,
    ...(index === middle && labels !== undefined ? { labels } : {}),
    points,
    smooth: false,
  }));
}

/** Expands one declarative circle line into the concrete WebGL contract. */
function resolveLine(line: AuthoredLine): ResolvedLine[] {
  if ("curve" in line) {
    return resolveCurveLine(line);
  }
  if (!("kind" in line)) {
    return [line];
  }

  if (line.kind === "circle-outline") {
    const { kind: _kind, radius, ...props } = line;
    return [
      {
        ...props,
        points: createCircleOutlinePoints(radius),
        smooth: false,
      },
    ];
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
        smooth: false,
      },
    ];
  }

  if (line.kind === "circle-radius") {
    const { degrees, kind: _kind, radius, ...props } = line;
    return [
      {
        ...props,
        points: createCircleRadiusPoints({ degrees, radius }),
        smooth: false,
      },
    ];
  }

  if (line.kind === "circle-arc") {
    const { kind: _kind, ...arc } = line;
    return [createCircleArcLine(arc)];
  }

  if (line.kind === "cuboid") {
    return createCuboidLines(line);
  }

  const { kind: _kind, ...segment } = line;
  return createCircleSegmentBoundaryLines(segment);
}

/** Resolves authored line primitives while preserving their declared order. */
export function resolveAuthoredLines(lines: readonly AuthoredLine[]) {
  return Arr.flatMap(lines, resolveLine);
}

const DEFAULT_CAMERA_POSITION: [number, number, number] = [10, 6, 10];

/** Resolves one authored line card into the scene configuration its parts read. */
export function resolveLineScene({
  cameraPosition = DEFAULT_CAMERA_POSITION,
  cameraTarget,
  data,
  showZAxis = true,
}: {
  cameraPosition?: [number, number, number] | undefined;
  cameraTarget?: [number, number, number] | undefined;
  data: readonly AuthoredLine[];
  showZAxis?: boolean | undefined;
}) {
  return {
    cameraPosition,
    ...(cameraTarget === undefined ? {} : { cameraTarget }),
    lines: resolveAuthoredLines(data),
    showZAxis,
  };
}

/** The scene configuration that one line-equation card shares with its parts. */
export type LineSceneConfig = ReturnType<typeof resolveLineScene>;

/** What a line scene draws: its number of lines, and the interval its points span on each axis. */
const LineSummarySchema = Schema.Struct({
  count: Schema.Int,
  x: IntervalSchema,
  y: IntervalSchema,
  z: IntervalSchema,
});

/** What a line scene draws. */
type LineSummary = typeof LineSummarySchema.Type;

/** Summarizes the points of resolved lines, or returns none when the lines have no points. */
export function summarizeLines(
  lines: readonly ResolvedLine[]
): Option.Option<LineSummary> {
  const points = Arr.flatMap(lines, (line) => line.points);
  if (!Arr.isReadonlyArrayNonEmpty(points)) {
    return Option.none();
  }
  return Option.some({
    count: lines.length,
    x: intervalOf(Arr.map(points, (point) => point.x)),
    y: intervalOf(Arr.map(points, (point) => point.y)),
    z: intervalOf(Arr.map(points, (point) => point.z)),
  });
}
