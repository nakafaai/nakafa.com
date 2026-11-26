import type { EsterId } from "@repo/design-system/components/contents/chemistry/ester/model";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr, Match } from "effect";
import {
  CatmullRomCurve3,
  ExtrudeGeometry,
  LatheGeometry,
  Shape,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

export const AXIS_X = 0.02;
export const AXIS_Z = 0.03;
const BULB_CY = 0.13;
const BULB_R = 0.042;
const BULB_INNER_R = 0.0396;
export const ROD_X = -0.145;
export const ROD_Z = -0.02;

/** Returns a subtle ester-specific fruity tint for the floating organic layer. */
export function esterTint(ester: EsterId): string {
  return Match.value(ester).pipe(
    Match.when("ethylEthanoate", () => ORGANIC_COLORS.esterRose),
    Match.when("propylEthanoate", () => ORGANIC_COLORS.keroseneOrange),
    Match.when("butylEthanoate", () => ORGANIC_COLORS.petrolYellow),
    Match.exhaustive
  );
}

export function createHotplateBody() {
  const side = new Shape();
  side.moveTo(-0.086, 0);
  side.lineTo(0.086, 0);
  side.lineTo(0.086, 0.018);
  side.lineTo(0.046, 0.048);
  side.lineTo(-0.086, 0.048);
  side.closePath();
  const geometry = new ExtrudeGeometry(side, {
    bevelEnabled: true,
    bevelSegments: 3,
    bevelSize: 0.0035,
    bevelThickness: 0.0035,
    depth: 0.15,
  });
  geometry.translate(0, 0, -0.075);
  return geometry;
}

export function createWaterBathGeometry() {
  const profile = Arr.map(
    [
      [0.001, 0],
      [0.054, 0],
      [0.058, 0.004],
      [0.058, 0.064],
      [0.0615, 0.068],
      [0.0605, 0.0695],
      [0.056, 0.065],
      [0.056, 0.004],
      [0.052, 0.002],
      [0.001, 0.002],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry(profile, 64);
}

export function createRoundFlaskGeometry() {
  const bulbPoints = Arr.makeBy(19, (step) => {
    const theta = -Math.PI / 2 + (step / 18) * (Math.PI * 0.89);
    const r = Math.max(0.001, Math.cos(theta) * BULB_R);
    const y = BULB_CY + Math.sin(theta) * BULB_R;
    return new Vector2(r, y);
  });
  const neckPoints = Arr.map(
    [
      [0.0155, 0.174],
      [0.0145, 0.184],
      [0.0145, 0.214],
      [0.0168, 0.232],
      [0.0182, 0.233],
      [0.0152, 0.233],
      [0.0132, 0.214],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return new LatheGeometry([...bulbPoints, ...neckPoints], 56);
}

export function createSphericalBandGeometry(yMin: number, yMax: number) {
  const clampedMin = Math.max(BULB_CY - BULB_INNER_R + 0.001, yMin);
  const clampedMax = Math.min(BULB_CY + BULB_INNER_R - 0.003, yMax);
  const steps = 14;
  const topDy = clampedMax - BULB_CY;
  const topR = Math.sqrt(
    Math.max(0.000_01, BULB_INNER_R * BULB_INNER_R - topDy * topDy)
  );
  const pts = [
    new Vector2(0.0008, clampedMin),
    ...Arr.makeBy(steps + 1, (step) => {
      const y = clampedMin + ((clampedMax - clampedMin) * step) / steps;
      const dy = y - BULB_CY;
      const r = Math.sqrt(
        Math.max(0.000_01, BULB_INNER_R * BULB_INNER_R - dy * dy)
      );
      return new Vector2(r, y);
    }),
    new Vector2(topR * 0.88, clampedMax - 0.0008),
    new Vector2(0.0008, clampedMax - 0.001),
  ];
  return new LatheGeometry(pts, 44);
}

export function createCondenserGeometries() {
  const inletCurve = new CatmullRomCurve3([
    new Vector3(AXIS_X - 0.036, 0.27, AXIS_Z),
    new Vector3(AXIS_X - 0.078, 0.258, AXIS_Z - 0.02),
    new Vector3(AXIS_X - 0.135, 0.16, AXIS_Z - 0.12),
    new Vector3(AXIS_X - 0.175, 0.045, AXIS_Z - 0.21),
    new Vector3(AXIS_X - 0.195, 0.01, AXIS_Z - 0.29),
  ]);
  const outletCurve = new CatmullRomCurve3([
    new Vector3(AXIS_X + 0.036, 0.416, AXIS_Z),
    new Vector3(AXIS_X + 0.088, 0.405, AXIS_Z - 0.02),
    new Vector3(AXIS_X + 0.142, 0.26, AXIS_Z - 0.1),
    new Vector3(AXIS_X + 0.17, 0.075, AXIS_Z - 0.2),
    new Vector3(AXIS_X + 0.185, 0.01, AXIS_Z - 0.29),
  ]);
  const innerProfile = Arr.map(
    [
      [0.0072, 0.204],
      [0.0072, 0.464],
      [0.0094, 0.47],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  const jacketProfile = Arr.map(
    [
      [0.0085, 0.244],
      [0.0198, 0.256],
      [0.0202, 0.428],
      [0.0085, 0.44],
    ] as const,
    ([r, y]) => new Vector2(r, y)
  );
  return {
    inletHoseGeo: new TubeGeometry(inletCurve, 44, 0.0044, 12, false),
    innerGeo: new LatheGeometry(innerProfile, 32),
    jacketGeo: new LatheGeometry(jacketProfile, 44),
    outletHoseGeo: new TubeGeometry(outletCurve, 48, 0.0044, 12, false),
  };
}
