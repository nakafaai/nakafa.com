import { Array as Arr } from "effect";
import {
  CatmullRomCurve3,
  LatheGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

/** Builds a smooth helical umbilical vessel curve connecting foetus to placenta. */
export function buildHelixTube(
  phaseOffset: number,
  radius: number,
  strandRadius: number
) {
  const pts = Arr.map(Arr.range(0, 28), (step) => {
    const t = step / 28;
    const angle = t * Math.PI * 5 + phaseOffset;
    const x = -0.14 + t * 0.44;
    const y = 0.04 - t * 0.18 + Math.sin(angle) * radius;
    const z = 0.04 + Math.cos(angle) * radius;
    return new Vector3(x, y, z);
  });
  return new TubeGeometry(
    new CatmullRomCurve3(pts),
    44,
    strandRadius,
    10,
    false
  );
}

/** Sculpted organic chorionic villus tree branch curve. */
export function buildVillusBranch(
  points: readonly (readonly [number, number, number])[],
  radius: number
) {
  return new TubeGeometry(
    new CatmullRomCurve3(Arr.map(points, ([x, y, z]) => new Vector3(x, y, z))),
    32,
    radius,
    14,
    false
  );
}

/** Biconcave red blood cell mesh for blocked blood-cell visualization. */
export function buildBiconcaveCellGeometry() {
  const pts = [
    new Vector2(0.001, -0.011),
    new Vector2(0.024, -0.012),
    new Vector2(0.044, -0.024),
    new Vector2(0.056, -0.012),
    new Vector2(0.058, 0),
    new Vector2(0.056, 0.012),
    new Vector2(0.044, 0.024),
    new Vector2(0.024, 0.012),
    new Vector2(0.001, 0.011),
  ];
  return new LatheGeometry(pts, 24);
}
