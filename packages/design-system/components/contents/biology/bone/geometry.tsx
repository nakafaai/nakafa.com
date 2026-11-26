import { Array as Arr } from "effect";
import {
  CatmullRomCurve3,
  LatheGeometry,
  TubeGeometry,
  Vector2,
  Vector3,
} from "three";

export const TRABECULAR_STRUTS: readonly (readonly [
  readonly [number, number, number],
  readonly [number, number, number],
  readonly [number, number, number],
])[] = [
  [
    [-0.28, -0.2, 0.02],
    [-0.08, -0.02, 0.05],
    [0.22, 0.24, -0.02],
  ],
  [
    [-0.26, 0.18, -0.03],
    [0.02, 0.04, 0.04],
    [0.28, -0.18, 0.02],
  ],
  [
    [-0.22, -0.26, -0.04],
    [0.06, -0.1, 0.02],
    [0.26, 0.06, -0.03],
  ],
  [
    [-0.18, 0.26, 0.03],
    [-0.02, 0.14, -0.04],
    [0.18, 0.22, 0.02],
  ],
  [
    [-0.24, 0.02, 0.04],
    [0.0, -0.06, -0.03],
    [0.24, -0.04, 0.04],
  ],
  [
    [-0.12, -0.28, 0.03],
    [-0.06, 0.0, -0.04],
    [-0.08, 0.28, 0.02],
  ],
  [
    [0.12, -0.28, -0.02],
    [0.08, 0.02, 0.05],
    [0.1, 0.26, -0.03],
  ],
  [
    [-0.26, -0.1, -0.03],
    [-0.14, 0.1, 0.03],
    [0.04, 0.28, -0.02],
  ],
];

/** Sculpted femur shaft with realistic flared proximal/distal epiphyses. */
export function buildFemurGeometry(length: number) {
  const pts = [
    new Vector2(0.001, 0),
    new Vector2(0.046, 0.02),
    new Vector2(0.052, 0.06),
    new Vector2(0.03, 0.12),
    new Vector2(0.026, length * 0.5),
    new Vector2(0.03, length * 0.86),
    new Vector2(0.048, length * 0.94),
    new Vector2(0.038, length * 0.985),
    new Vector2(0.001, length),
  ];
  return new LatheGeometry(pts, 28);
}

/** Curved anatomical rib arch wrapping from thoracic spine to sternum. */
export function buildRibGeometry(side: -1 | 1, width: number) {
  const curve = new CatmullRomCurve3([
    new Vector3(0, 0, -0.06),
    new Vector3(side * width * 0.85, -0.02, -0.03),
    new Vector3(side * width, -0.04, 0.05),
    new Vector3(side * width * 0.48, -0.05, 0.1),
    new Vector3(side * 0.025, -0.05, 0.11),
  ]);
  return new TubeGeometry(curve, 24, 0.011, 10, false);
}

/** Organic curved trabecular bone strut with customizable thickness for healthy vs osteoporotic states. */
export function buildTrabeculaCurve(
  triple: readonly [
    readonly [number, number, number],
    readonly [number, number, number],
    readonly [number, number, number],
  ],
  radius: number
) {
  const curve = new CatmullRomCurve3(
    Arr.map(triple, ([x, y, z]) => new Vector3(x, y, z))
  );
  return new TubeGeometry(curve, 22, radius, 10, false);
}
