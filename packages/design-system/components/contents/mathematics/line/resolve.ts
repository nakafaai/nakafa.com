import {
  createCircleArcLine,
  createCircleChordPoints,
  createCircleOutlinePoints,
  createCircleRadiusPoints,
  createCircleSegmentBoundaryLines,
} from "@repo/design-system/components/contents/mathematics/circle";
import { createCuboidLines } from "@repo/design-system/components/contents/mathematics/cuboid";
import type {
  AuthoredLine,
  ResolvedLine,
} from "@repo/design-system/components/contents/mathematics/line/spec";
import { Array as Arr } from "effect";

/** Expands one declarative circle line into the concrete WebGL contract. */
function resolveLine(line: AuthoredLine): ResolvedLine[] {
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
