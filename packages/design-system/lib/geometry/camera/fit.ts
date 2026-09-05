import { type Box3, MathUtils, Matrix4, Vector3 } from "three";

const VIEWPORT_EDGE_SPACE = 24;

/**
 * Fits finite world bounds along the existing viewing direction. The camera
 * moves; the mathematical geometry and its proportions stay unchanged.
 *
 * Perspective fitting checks every box corner against both frustum planes.
 * Orthographic fitting uses the same projected envelope in world units.
 */
export function resolveCameraFit({
  bounds,
  fov,
  height,
  position,
  target,
  width,
}: {
  bounds: Box3;
  fov: number;
  height: number;
  position: Vector3;
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
  let viewHeight = radius * 0.02;

  for (const x of [bounds.min.x, bounds.max.x]) {
    for (const y of [bounds.min.y, bounds.max.y]) {
      for (const z of [bounds.min.z, bounds.max.z]) {
        const point = new Vector3(x, y, z).sub(center);
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
}

/** Keeps panning focused on the finite lesson content without changing orbit. */
export function resolveCameraPanOffset(bounds: Box3, target: Vector3) {
  return target.clone().clamp(bounds.min, bounds.max).sub(target);
}
