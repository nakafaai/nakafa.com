import { Array as Arr } from "effect";
import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
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

/** Kidney-shaped vertebral body cross section for the cartilaginous disc joint. */
export function buildCentrumGeometry(radius: number, height: number) {
  const shape = new Shape();
  shape.moveTo(0, -radius * 0.82);
  shape.bezierCurveTo(
    radius * 1.15,
    -radius * 0.95,
    radius * 1.18,
    radius * 0.75,
    0,
    radius * 0.72
  );
  shape.bezierCurveTo(
    -radius * 1.18,
    radius * 0.75,
    -radius * 1.15,
    -radius * 0.95,
    0,
    -radius * 0.82
  );
  const geo = new ExtrudeGeometry(shape, {
    bevelEnabled: true,
    bevelSegments: 4,
    bevelSize: 0.022,
    bevelThickness: 0.022,
    depth: height,
  });
  geo.rotateX(Math.PI / 2);
  geo.translate(0, height / 2, 0);
  return geo;
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

/** Fusiform striated skeletal muscle belly tapering smoothly into tendons. */
export function buildMuscleBellyGeometry() {
  const pts = Arr.map(Arr.range(0, 16), (step) => {
    const t = step / 16;
    const r = Math.max(0.004, Math.sin(t * Math.PI) ** 0.78 * 0.082);
    return new Vector2(r, (t - 0.5) * 0.56);
  });
  return new LatheGeometry(pts, 28);
}

/** Interlocking cranial suture tooth curve. */
export function buildSutureSeamGeometry() {
  const pts = Arr.map(Arr.range(0, 16), (step) => {
    const t = step / 16;
    const y = 0.24 + t * 0.62;
    const x = (step % 2 === 0 ? 1 : -1) * 0.032;
    const z = Math.sin(t * Math.PI) * 0.32;
    return new Vector3(x, y, z);
  });
  return new TubeGeometry(new CatmullRomCurve3(pts), 48, 0.015, 10, false);
}
