import type {
  CuboidLine,
  LinePoint,
  ResolvedLine,
} from "@repo/design-system/components/contents/mathematics/line/spec";

const ORIGIN: LinePoint = { x: 0, y: 0, z: 0 };

const EDGE_VERTEX_INDICES = [
  [0, 1],
  [1, 2],
  [2, 3],
  [3, 0],
  [4, 5],
  [5, 6],
  [6, 7],
  [7, 4],
  [0, 4],
  [1, 5],
  [2, 6],
  [3, 7],
] as const;

/**
 * Resolves a mathematical cuboid into its twelve exact, axis-aligned edges.
 *
 * Length follows the x-axis, height follows the y-axis, and width follows the
 * z-axis. Every edge is a separate two-point line so the renderer can never
 * round a cuboid corner through curve interpolation.
 */
export function createCuboidLines({
  center = ORIGIN,
  color,
  height,
  length,
  lineWidth,
  showPoints = false,
  width,
}: CuboidLine): ResolvedLine[] {
  const halfLength = length / 2;
  const halfHeight = height / 2;
  const halfWidth = width / 2;
  const { x, y, z } = center;
  const vertices: LinePoint[] = [
    { x: x - halfLength, y: y - halfHeight, z: z - halfWidth },
    { x: x + halfLength, y: y - halfHeight, z: z - halfWidth },
    { x: x + halfLength, y: y + halfHeight, z: z - halfWidth },
    { x: x - halfLength, y: y + halfHeight, z: z - halfWidth },
    { x: x - halfLength, y: y - halfHeight, z: z + halfWidth },
    { x: x + halfLength, y: y - halfHeight, z: z + halfWidth },
    { x: x + halfLength, y: y + halfHeight, z: z + halfWidth },
    { x: x - halfLength, y: y + halfHeight, z: z + halfWidth },
  ];

  return EDGE_VERTEX_INDICES.map(([startIndex, endIndex]) => ({
    color,
    lineWidth,
    points: [vertices[startIndex], vertices[endIndex]],
    showPoints,
    smooth: false,
  }));
}
