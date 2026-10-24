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
import {
  type CurveBranch,
  CurveError,
  CurveSchema,
  sampleCurve,
} from "@repo/design-system/components/contents/mathematics/line/curve";
import type {
  AuthoredLine,
  CurveLine,
  ResolvedLine,
  ResolvedLineLabel,
} from "@repo/design-system/components/contents/mathematics/line/spec";
import { Array as Arr, Effect, Option, Schema } from "effect";

/**
 * Places one label on a drawn branch, returning the branch's position with the label. An
 * anchor indexes the curve's grid, so it lands on the branch that holds that grid sample,
 * re-based to the branch's own points. A label without an anchor sits on the middle branch.
 * An anchor that no drawn branch holds fails, so a label is never dropped in silence.
 */
const placeLabel = Effect.fn("line.placeCurveLabel")(function* (
  branches: readonly CurveBranch[],
  label: ResolvedLineLabel
) {
  const anchor = label.at;
  if (anchor === undefined) {
    if (branches.length === 0) {
      return yield* new CurveError({
        message: "A label needs a drawn branch, and this curve draws none.",
      });
    }
    return [Math.floor(branches.length / 2), label] satisfies [
      number,
      ResolvedLineLabel,
    ];
  }
  const holders = Arr.flatMap(branches, (branch, branchIndex) =>
    Option.toArray(
      Option.map(
        Arr.findFirstIndex(branch.indices, (index) => index === anchor),
        (local) =>
          [branchIndex, { ...label, at: local }] satisfies [
            number,
            ResolvedLineLabel,
          ]
      )
    )
  );
  const holder = Arr.head(holders);
  if (Option.isNone(holder)) {
    return yield* new CurveError({
      message: `A label anchor at grid index ${anchor} is on no drawn branch of the curve.`,
    });
  }
  return holder.value;
});

/**
 * Expands one curve into one resolved line per drawn branch. The declaration is decoded first,
 * so an invalid curve fails before it is sampled. Every branch keeps the style of the curve,
 * and each label rides on the branch that draws its anchor.
 */
const resolveCurveLine = Effect.fn("line.resolveCurve")(function* ({
  curve,
  ...line
}: CurveLine) {
  const { labels = [], ...style } = line;
  const declared = yield* Schema.decodeEffect(CurveSchema)(curve).pipe(
    Effect.mapError((error) => new CurveError({ message: error.message }))
  );
  const branches = sampleCurve(declared);
  const placed = yield* Effect.forEach(labels, (label) =>
    placeLabel(branches, label)
  );
  return Arr.map(branches, (branch, index) => {
    const branchLabels = Arr.map(
      Arr.filter(placed, ([branchIndex]) => branchIndex === index),
      ([, label]) => label
    );
    return {
      ...style,
      ...(branchLabels.length > 0 ? { labels: branchLabels } : {}),
      points: branch.points,
      smooth: false,
    };
  });
});

/** Expands one declarative circle line into the concrete WebGL contract. */
function resolvePrimitiveLine(
  line: Exclude<AuthoredLine, CurveLine>
): ResolvedLine[] {
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

/** Resolves one authored line: a curve expands into its branches, and every other primitive resolves on its own. */
const resolveLine = Effect.fn("line.resolveLine")(function* (
  line: AuthoredLine
) {
  if ("curve" in line) {
    return yield* resolveCurveLine(line);
  }
  return resolvePrimitiveLine(line);
});

/** Resolves authored line primitives while preserving their declared order. A curve that cannot be drawn fails. */
export const resolveAuthoredLines = Effect.fn("line.resolveAuthoredLines")(
  function* (lines: readonly AuthoredLine[]) {
    return Arr.flatten(yield* Effect.forEach(lines, resolveLine));
  }
);

const DEFAULT_CAMERA_POSITION: [number, number, number] = [10, 6, 10];

/** Resolves one authored line card into the scene configuration its parts read. */
export const resolveLineScene = Effect.fn("line.resolveScene")(function* ({
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
    lines: yield* resolveAuthoredLines(data),
    showZAxis,
  };
});

/** The scene configuration that one line-equation card shares with its parts. */
export type LineSceneConfig = Effect.Success<
  ReturnType<typeof resolveLineScene>
>;

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
