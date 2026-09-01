export interface CuboidPoint {
  readonly x: number;
  readonly y: number;
  readonly z: number;
}

export interface CuboidDimensions {
  readonly center?: CuboidPoint;
  readonly height: number;
  readonly length: number;
  readonly width: number;
}

const ORIGIN: CuboidPoint = { x: 0, y: 0, z: 0 };

function halfMeasure(measure: number) {
  return Math.max(measure / 2, Number.MIN_VALUE);
}

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
 * Returns the eight vertices and twelve axis-aligned edges of a validated
 * cuboid. Runtime validation stays at the owning authored-content boundary.
 */
export function createCuboid({
  center = ORIGIN,
  height,
  length,
  width,
}: CuboidDimensions) {
  const halfLength = halfMeasure(length);
  const halfHeight = halfMeasure(height);
  const halfWidth = halfMeasure(width);
  const { x, y, z } = center;
  const vertices = [
    { x: x - halfLength, y: y - halfHeight, z: z - halfWidth },
    { x: x + halfLength, y: y - halfHeight, z: z - halfWidth },
    { x: x + halfLength, y: y + halfHeight, z: z - halfWidth },
    { x: x - halfLength, y: y + halfHeight, z: z - halfWidth },
    { x: x - halfLength, y: y - halfHeight, z: z + halfWidth },
    { x: x + halfLength, y: y - halfHeight, z: z + halfWidth },
    { x: x + halfLength, y: y + halfHeight, z: z + halfWidth },
    { x: x - halfLength, y: y + halfHeight, z: z + halfWidth },
  ] satisfies readonly CuboidPoint[];
  const edges = EDGE_VERTEX_INDICES.map(
    ([startIndex, endIndex]) =>
      [vertices[startIndex], vertices[endIndex]] as const
  );

  return { edges, vertices };
}
