import type {
  CameraProjection,
  resolveCameraDistanceLimits,
  resolveOrthographicZoom,
} from "@repo/design-system/lib/geometry/camera";
import type { CameraPixelLabel } from "@repo/design-system/lib/geometry/camera/bounds";
import { Effect, Schema } from "effect";
import { type Box3, MathUtils, Matrix4, Vector3 } from "three";

const VIEWPORT_EDGE_SPACE = 24;

/** A fixed-size label cannot fit the supported viewport and content together. */
export class CameraLabelFitError extends Schema.TaggedError<CameraLabelFitError>()(
  "CameraLabelFitError",
  {
    axis: Schema.Literals(["horizontal", "vertical"]),
    availablePixels: Schema.Finite,
    projection: Schema.Literals(["perspective", "orthographic"]),
  }
) {}

interface AxisConstraint {
  readonly lower: { readonly offset: number; readonly rate: number };
  readonly upper: { readonly offset: number; readonly rate: number };
}

/**
 * Fits finite world bounds along the existing viewing direction. The camera
 * moves; the mathematical geometry and its proportions stay unchanged.
 *
 * Perspective fitting checks every box corner against both frustum planes.
 * Orthographic fitting uses the same projected envelope in world units.
 */
export const resolveCameraFit = Effect.fn("camera.resolveFit")(function* ({
  bounds,
  fov,
  height,
  labels = [],
  minimumViewHeight = 0,
  position,
  projection,
  target,
  width,
}: {
  bounds: Box3;
  fov: number;
  height: number;
  labels?: readonly CameraPixelLabel[];
  minimumViewHeight?: number;
  position: Vector3;
  projection: CameraProjection["kind"];
  target: Vector3;
  width: number;
}) {
  const center = bounds.getCenter(new Vector3());
  const basis = new Matrix4().lookAt(position, target, new Vector3(0, 1, 0));
  const right = new Vector3().setFromMatrixColumn(basis, 0);
  const up = new Vector3().setFromMatrixColumn(basis, 1);
  const backward = new Vector3().setFromMatrixColumn(basis, 2);
  const aspect = width / height;
  const usableWidth = Math.max(0.1, 1 - (2 * VIEWPORT_EDGE_SPACE) / width);
  const usableHeight = Math.max(0.1, 1 - (2 * VIEWPORT_EDGE_SPACE) / height);
  const verticalTangent = Math.tan(MathUtils.degToRad(fov) / 2);
  const horizontalTangent = verticalTangent * aspect;
  const radius = Math.max(bounds.getSize(new Vector3()).length() / 2, 0.01);
  let distance = radius;
  let viewHeight = Math.max(radius * 0.02, minimumViewHeight);
  const horizontal: AxisConstraint[] = [];
  const vertical: AxisConstraint[] = [];
  const pixelScale =
    projection === "perspective" ? height / (2 * verticalTangent) : height;
  const constrain = (
    point: Vector3,
    left = 0,
    rightEdge = 0,
    bottom = 0,
    top = 0
  ) => {
    const depth = projection === "perspective" ? point.dot(backward) : 0;
    horizontal.push(
      axisConstraint(
        point.dot(right),
        depth,
        left,
        rightEdge,
        width / 2 - VIEWPORT_EDGE_SPACE,
        pixelScale
      )
    );
    vertical.push(
      axisConstraint(
        point.dot(up),
        depth,
        bottom,
        top,
        height / 2 - VIEWPORT_EDGE_SPACE,
        pixelScale
      )
    );
  };

  for (const point of boxCorners(bounds)) {
    point.sub(center);
    constrain(point);
    const projectedX = Math.abs(point.dot(right));
    const projectedY = Math.abs(point.dot(up));
    const depth = point.dot(backward);
    distance = Math.max(
      distance,
      depth + projectedX / (horizontalTangent * usableWidth),
      depth + projectedY / (verticalTangent * usableHeight)
    );
    viewHeight = Math.max(
      viewHeight,
      (2 * projectedX) / (aspect * usableWidth),
      (2 * projectedY) / usableHeight
    );
  }

  if (labels.length > 0) {
    for (const label of labels) {
      for (const point of pixelAnchors(label, center, right, up)) {
        constrain(
          point,
          label.rectangle.min.x,
          label.rectangle.max.x,
          label.rectangle.min.y,
          label.rectangle.max.y
        );
      }
    }
    const fitted = yield* solvePixelConstraints({
      horizontal,
      vertical,
      minimum: projection === "perspective" ? distance : viewHeight,
      projection,
      width,
      height,
    });
    center.addScaledVector(right, fitted.x).addScaledVector(up, fitted.y);
    if (projection === "perspective") {
      distance = fitted.amount;
    } else {
      viewHeight = fitted.amount;
    }
  }

  return {
    distance,
    far: (distance + radius) * 4,
    near: radius / 10_000,
    position: center.clone().addScaledVector(backward, distance),
    radius,
    target: center,
    viewHeight,
  };
});

function* boxCorners(bounds: Box3) {
  for (const x of new Set([bounds.min.x, bounds.max.x])) {
    for (const y of new Set([bounds.min.y, bounds.max.y])) {
      for (const z of new Set([bounds.min.z, bounds.max.z])) {
        yield new Vector3(x, y, z);
      }
    }
  }
}

function* pixelAnchors(
  label: CameraPixelLabel,
  center: Vector3,
  right: Vector3,
  up: Vector3
) {
  for (const point of boxCorners(label.anchors)) {
    // Drei uses radial distance; the gap lies between zero and its
    // depth-projected world displacement. Both endpoints bound it.
    for (const gapScale of label.gap.x || label.gap.y ? [0, 1] : [0]) {
      yield point
        .clone()
        .sub(center)
        .addScaledVector(right, label.gap.x * gapScale)
        .addScaledVector(up, label.gap.y * gapScale);
    }
  }
}

function axisConstraint(
  point: number,
  depth: number,
  minimumPixel: number,
  maximumPixel: number,
  halfSize: number,
  pixelScale: number
): AxisConstraint {
  const lowerRate = (halfSize - maximumPixel) / pixelScale;
  const upperRate = (halfSize + minimumPixel) / pixelScale;
  return {
    lower: { offset: point + lowerRate * depth, rate: -lowerRate },
    upper: { offset: point - upperRate * depth, rate: upperRate },
  };
}

const solvePixelConstraints = Effect.fn("camera.solvePixelConstraints")(
  function* ({
    horizontal,
    vertical,
    minimum,
    projection,
    width,
    height,
  }: {
    horizontal: readonly AxisConstraint[];
    vertical: readonly AxisConstraint[];
    minimum: number;
    projection: CameraProjection["kind"];
    width: number;
    height: number;
  }) {
    let amount = minimum;
    let maximum = Number.POSITIVE_INFINITY;
    const dimensions = [
      {
        axis: "horizontal",
        constraints: horizontal,
        availablePixels: width - 2 * VIEWPORT_EDGE_SPACE,
      },
      {
        axis: "vertical",
        constraints: vertical,
        availablePixels: height - 2 * VIEWPORT_EDGE_SPACE,
      },
    ] satisfies readonly {
      axis: CameraLabelFitError["axis"];
      constraints: readonly AxisConstraint[];
      availablePixels: number;
    }[];
    for (const { axis, availablePixels, constraints } of dimensions) {
      for (const { lower } of constraints) {
        for (const { upper } of constraints) {
          const interval = constraintInterval(lower, upper);
          amount = Math.max(amount, interval.minimum);
          maximum = Math.min(maximum, interval.maximum);
          if (amount > maximum + 1e-10) {
            return yield* new CameraLabelFitError({
              axis,
              availablePixels,
              projection,
            });
          }
        }
      }
    }
    return {
      amount,
      x: targetOffset(horizontal, amount),
      y: targetOffset(vertical, amount),
    };
  }
);

function constraintInterval(
  lower: AxisConstraint["lower"],
  upper: AxisConstraint["upper"]
) {
  const rate = upper.rate - lower.rate;
  const offset = lower.offset - upper.offset;
  if (rate > 0) {
    return { minimum: offset / rate, maximum: Number.POSITIVE_INFINITY };
  }
  if (rate < 0) {
    return { minimum: Number.NEGATIVE_INFINITY, maximum: offset / rate };
  }
  return {
    minimum:
      offset > 1e-10 ? Number.POSITIVE_INFINITY : Number.NEGATIVE_INFINITY,
    maximum:
      offset > 1e-10 ? Number.NEGATIVE_INFINITY : Number.POSITIVE_INFINITY,
  };
}

function targetOffset(constraints: readonly AxisConstraint[], amount: number) {
  let minimumTarget = Number.NEGATIVE_INFINITY;
  let maximumTarget = Number.POSITIVE_INFINITY;
  for (const { lower, upper } of constraints) {
    minimumTarget = Math.max(minimumTarget, lower.offset + lower.rate * amount);
    maximumTarget = Math.min(maximumTarget, upper.offset + upper.rate * amount);
  }
  if (minimumTarget <= 1e-10 && maximumTarget >= -1e-10) {
    return 0;
  }
  return MathUtils.clamp(0, minimumTarget, maximumTarget);
}

/** Keeps panning focused on the finite lesson content without changing orbit. */
export function resolveCameraPanOffset(bounds: Box3, target: Vector3) {
  return target.clone().clamp(bounds.min, bounds.max).sub(target);
}

/** Preserves the learner's orbit, dolly, pan, and zoom ratio when content is refitted. */
export function resolveCameraRefit({
  authoredPosition,
  authoredTarget,
  currentPosition,
  currentTarget,
  currentZoom,
  fitted,
  initialZoom,
  limits,
  near,
  far,
  previous,
}: {
  authoredPosition: Vector3;
  authoredTarget: Vector3;
  currentPosition: Vector3;
  currentTarget: Vector3;
  currentZoom: number;
  fitted: Effect.Success<ReturnType<typeof resolveCameraFit>>;
  initialZoom: ReturnType<typeof resolveOrthographicZoom>;
  limits: ReturnType<typeof resolveCameraDistanceLimits>;
  near?: number;
  far?: number;
  previous: { distance: number; target: Vector3; zoom: number } | null;
}) {
  const position = (previous ? currentPosition : authoredPosition).clone();
  const target = (previous ? currentTarget : authoredTarget).clone();
  const distanceRatio = previous
    ? position.distanceTo(target) / previous.distance
    : 1;
  const distance = Math.min(
    limits.maxDistance,
    Math.max(limits.minDistance, fitted.distance * distanceRatio)
  );
  const direction = position.sub(target).normalize();
  const pan = previous
    ? target
        .sub(previous.target)
        .multiplyScalar(fitted.distance / previous.distance)
    : new Vector3();
  const nextTarget = fitted.target.clone().add(pan);
  const zoomRatio = previous ? currentZoom / previous.zoom : 1;
  return {
    near: near ?? fitted.near,
    far: Math.max(far ?? 0, fitted.far),
    position: nextTarget.clone().addScaledVector(direction, distance),
    target: nextTarget,
    zoom: Math.min(
      initialZoom.maxZoom,
      Math.max(initialZoom.minZoom, initialZoom.zoom * zoomRatio)
    ),
  };
}
