import type { CoordinateFrame } from "@repo/design-system/components/three/frame";
import { BigDecimal } from "effect";

import type {
  SpacePoint,
  SpaceVisual,
} from "@/lib/content/renderer/client/base/visual/scene";

const WORLD_EXTENT = 10;
const TWO = BigDecimal.fromBigInt(2n);

interface ExactRange {
  readonly max: BigDecimal.BigDecimal;
  readonly min: BigDecimal.BigDecimal;
}

export interface SpaceProjection {
  readonly center: readonly [
    BigDecimal.BigDecimal,
    BigDecimal.BigDecimal,
    BigDecimal.BigDecimal,
  ];
  readonly extent: BigDecimal.BigDecimal;
}

function decimal(value: number) {
  return BigDecimal.fromNumberUnsafe(value);
}

function exactRange(min: number, max: number): ExactRange {
  return { max: decimal(max), min: decimal(min) };
}

function include(range: ExactRange, value: number): ExactRange {
  const candidate = decimal(value);
  return {
    max: BigDecimal.max(range.max, candidate),
    min: BigDecimal.min(range.min, candidate),
  };
}

function span(range: ExactRange) {
  return BigDecimal.subtract(range.max, range.min);
}

function midpoint(range: ExactRange) {
  return BigDecimal.divideUnsafe(BigDecimal.sum(range.min, range.max), TWO);
}

function viewPoints(scene: SpaceVisual) {
  if (scene.view.kind === "camera") {
    return [scene.view.position, scene.view.target];
  }
  if (scene.view.kind === "isometric" && scene.view.target) {
    return [scene.view.target];
  }
  return [];
}

/** Resolves one uniform affine map from authored space into safe GPU units. */
export function resolveSpaceProjection(scene: SpaceVisual): SpaceProjection {
  const padding = scene.view.kind === "fit" ? (scene.view.padding ?? 0) : 0;
  const ranges = [scene.frame.x, scene.frame.y, scene.frame.z].map((range) => ({
    max: BigDecimal.sum(decimal(range.max), decimal(padding)),
    min: BigDecimal.subtract(decimal(range.min), decimal(padding)),
  }));

  for (const point of viewPoints(scene)) {
    ranges[0] = include(ranges[0] ?? exactRange(point.x, point.x), point.x);
    ranges[1] = include(ranges[1] ?? exactRange(point.y, point.y), point.y);
    ranges[2] = include(ranges[2] ?? exactRange(point.z, point.z), point.z);
  }

  const x = ranges[0] ?? exactRange(scene.frame.x.min, scene.frame.x.max);
  const y = ranges[1] ?? exactRange(scene.frame.y.min, scene.frame.y.max);
  const z = ranges[2] ?? exactRange(scene.frame.z.min, scene.frame.z.max);
  return {
    center: [midpoint(x), midpoint(y), midpoint(z)],
    extent: BigDecimal.max(span(x), BigDecimal.max(span(y), span(z))),
  };
}

function projectCoordinate(
  value: number,
  center: BigDecimal.BigDecimal,
  extent: BigDecimal.BigDecimal
) {
  return BigDecimal.toNumberUnsafe(
    BigDecimal.divideUnsafe(
      BigDecimal.multiply(
        BigDecimal.subtract(decimal(value), center),
        decimal(WORLD_EXTENT)
      ),
      extent
    )
  );
}

/** Projects one authored point with the scene's uniform affine transform. */
export function projectSpacePoint(
  point: SpacePoint,
  projection: SpaceProjection
): SpacePoint {
  return {
    x: projectCoordinate(point.x, projection.center[0], projection.extent),
    y: projectCoordinate(point.y, projection.center[1], projection.extent),
    z: projectCoordinate(point.z, projection.center[2], projection.extent),
  };
}

/** Projects one positive authored measure with the same uniform scale. */
export function projectSpaceMeasure(
  measure: number,
  projection: SpaceProjection
) {
  if (measure === 0) {
    return 0;
  }
  const projected = BigDecimal.toNumberUnsafe(
    BigDecimal.divideUnsafe(
      BigDecimal.multiply(decimal(measure), decimal(WORLD_EXTENT)),
      projection.extent
    )
  );
  return Math.max(projected, Number.EPSILON);
}

/** Projects the authored Cartesian frame without changing axis proportions. */
export function projectSpaceFrame(
  frame: SpaceVisual["frame"],
  projection: SpaceProjection
): CoordinateFrame {
  return {
    x: {
      max: projectCoordinate(
        frame.x.max,
        projection.center[0],
        projection.extent
      ),
      min: projectCoordinate(
        frame.x.min,
        projection.center[0],
        projection.extent
      ),
    },
    y: {
      max: projectCoordinate(
        frame.y.max,
        projection.center[1],
        projection.extent
      ),
      min: projectCoordinate(
        frame.y.min,
        projection.center[1],
        projection.extent
      ),
    },
    z: {
      max: projectCoordinate(
        frame.z.max,
        projection.center[2],
        projection.extent
      ),
      min: projectCoordinate(
        frame.z.min,
        projection.center[2],
        projection.extent
      ),
    },
  };
}

/** Returns the longest frame side, saturating only beyond Number's range. */
export function getSpaceFrameExtent(scene: SpaceVisual) {
  const exact = BigDecimal.max(
    BigDecimal.subtract(decimal(scene.frame.x.max), decimal(scene.frame.x.min)),
    BigDecimal.max(
      BigDecimal.subtract(
        decimal(scene.frame.y.max),
        decimal(scene.frame.y.min)
      ),
      BigDecimal.subtract(
        decimal(scene.frame.z.max),
        decimal(scene.frame.z.min)
      )
    )
  );
  const numeric = BigDecimal.toNumberUnsafe(exact);
  return Number.isFinite(numeric) ? numeric : Number.MAX_VALUE;
}
