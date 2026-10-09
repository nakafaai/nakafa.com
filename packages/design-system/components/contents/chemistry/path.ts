import type { Vector3 } from "three";

/**
 * Generates a fixed-resolution 3D path from a continuous point function.
 */
export function createPath(
  pointCount: number,
  getPointAtProgress: (progress: number) => Vector3
) {
  return Array.from({ length: pointCount }, (_, index) => {
    const progress = index / (pointCount - 1);

    return getPointAtProgress(progress);
  });
}

/**
 * Generates a smooth quadratic path from start to end, bent toward control.
 */
export function createQuadraticPath(
  pointCount: number,
  start: Vector3,
  control: Vector3,
  end: Vector3
) {
  return createPath(pointCount, (progress) => {
    const startWeight = (1 - progress) ** 2;
    const controlWeight = 2 * (1 - progress) * progress;
    const endWeight = progress ** 2;

    return start
      .clone()
      .multiplyScalar(startWeight)
      .add(control.clone().multiplyScalar(controlWeight))
      .add(end.clone().multiplyScalar(endWeight));
  });
}
