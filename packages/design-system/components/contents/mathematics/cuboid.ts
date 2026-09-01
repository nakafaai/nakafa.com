import type {
  CuboidLine,
  ResolvedLine,
} from "@repo/design-system/components/contents/mathematics/line/spec";
import { createCuboid } from "@repo/design-system/lib/geometry/cuboid";

/**
 * Resolves a mathematical cuboid into its twelve exact, axis-aligned edges.
 *
 * Length follows the x-axis, height follows the y-axis, and width follows the
 * z-axis. Every edge is a separate two-point line so the renderer can never
 * round a cuboid corner through curve interpolation.
 */
export function createCuboidLines({
  center,
  color,
  height,
  length,
  lineWidth,
  showPoints = false,
  width,
}: CuboidLine): ResolvedLine[] {
  const { edges } = createCuboid({ center, height, length, width });

  return edges.map(([start, end]) => ({
    color,
    lineWidth,
    points: [start, end],
    showPoints,
    smooth: false,
  }));
}
