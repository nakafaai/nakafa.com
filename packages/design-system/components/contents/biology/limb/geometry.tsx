import { Array as Arr } from "effect";
import {
  CatmullRomCurve3,
  LatheGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

/** Lathe outline for a realistic flared long bone shaft with rounded condyle epiphysis. */
export function buildLongBoneGeometry(length: number, radius: number) {
  const pts = [
    new Vector2(0.001, 0),
    new Vector2(radius * 1.48, 0.025),
    new Vector2(radius * 1.62, 0.08),
    new Vector2(radius * 1.38, 0.15),
    new Vector2(radius * 0.92, 0.24),
    new Vector2(radius * 0.76, length * 0.5),
    new Vector2(radius * 0.88, length * 0.82),
    new Vector2(radius * 1.35, length * 0.93),
    new Vector2(radius * 1.22, length * 0.985),
    new Vector2(0.001, length),
  ];
  return new LatheGeometry(pts, 36);
}

/** Organic curved ligament or tendon strap along a 3D spline. */
export function buildBandGeometry(
  points: readonly (readonly [number, number, number])[],
  radius: number
) {
  const curve = new CatmullRomCurve3(
    Arr.map(points, ([x, y, z]) => new Vector3(x, y, z))
  );
  return new TubeGeometry(curve, 28, radius, 14, false);
}
