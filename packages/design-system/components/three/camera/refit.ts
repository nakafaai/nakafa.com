import type {
  resolveCameraDistanceLimits,
  resolveOrthographicZoom,
} from "@repo/design-system/lib/geometry/camera";
import { Vector3 } from "three";

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
  fitted: {
    readonly distance: number;
    readonly far: number;
    readonly near: number;
    readonly target: Vector3;
  };
  initialZoom: ReturnType<typeof resolveOrthographicZoom>;
  limits: ReturnType<typeof resolveCameraDistanceLimits>;
  near?: number | undefined;
  far?: number | undefined;
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
