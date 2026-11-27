import type { EsterId } from "@repo/design-system/components/contents/chemistry/ester/model";
import type { Path } from "@repo/design-system/components/three/form/path";
import { ORGANIC_COLORS } from "@repo/design-system/lib/material/organic";
import { Array as Arr, Match } from "effect";
import { ExtrudeGeometry, Shape } from "three";

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

/** The low-form water bath dish: along its base, up its outside, over its lip and back down its inside. */
export const WATER_BATH = [
  [0, 0],
  [0.054, 0],
  [0.058, 0.004],
  [0.058, 0.064],
  [0.0615, 0.068],
  [0.0605, 0.0695],
  [0.056, 0.065],
  [0.056, 0.004],
  [0.052, 0.002],
  [0, 0.002],
] as const;

/** The round-bottom flask: round its bulb from the bottom, up its neck, over its ground rim and back into its bore. */
export const FLASK = [
  ...Arr.makeBy(19, (step) => {
    const lean = -Math.PI / 2 + (step / 18) * (Math.PI * 0.89);
    return [
      step === 0 ? 0 : Math.cos(lean) * BULB_R,
      BULB_CY + Math.sin(lean) * BULB_R,
    ] as const;
  }),
  [0.0155, 0.174],
  [0.0145, 0.184],
  [0.0145, 0.214],
  [0.0168, 0.232],
  [0.0182, 0.233],
  [0.0152, 0.233],
  [0.0132, 0.214],
] as const;

/**
 * A layer of liquid in the flask's bulb between two heights: under it, up
 * the inside of the glass, and back across its top to the axis.
 */
export function layerOf(low: number, high: number) {
  const bottom = Math.max(BULB_CY - BULB_INNER_R + 0.001, low);
  const top = Math.min(BULB_CY + BULB_INNER_R - 0.003, high);
  const widthAt = (y: number) =>
    Math.sqrt(Math.max(0.000_01, BULB_INNER_R ** 2 - (y - BULB_CY) ** 2));
  return [
    [0, bottom] as const,
    ...Arr.makeBy(15, (step) => {
      const y = bottom + ((top - bottom) * step) / 14;
      return [widthAt(y), y] as const;
    }),
    [widthAt(top) * 0.88, top - 0.0008] as const,
    [0, top - 0.001] as const,
  ];
}

/** The condenser's inner vapour tube, up to its flared top. */
export const CONDENSER_TUBE = [
  [0.0072, 0.204],
  [0.0072, 0.464],
  [0.0094, 0.47],
] as const;

/** The condenser's water jacket, from its lower seal out and up to its upper seal. */
export const CONDENSER_JACKET = [
  [0.0085, 0.244],
  [0.0198, 0.256],
  [0.0202, 0.428],
  [0.0085, 0.44],
] as const;

/** The silicone hose that brings cold water to the jacket's lower nipple. */
export const INLET_HOSE: Path = [
  [AXIS_X - 0.036, 0.27, AXIS_Z],
  [AXIS_X - 0.078, 0.258, AXIS_Z - 0.02],
  [AXIS_X - 0.135, 0.16, AXIS_Z - 0.12],
  [AXIS_X - 0.175, 0.045, AXIS_Z - 0.21],
  [AXIS_X - 0.195, 0.01, AXIS_Z - 0.29],
];

/** The silicone hose that carries warmed water away from the jacket's upper nipple. */
export const OUTLET_HOSE: Path = [
  [AXIS_X + 0.036, 0.416, AXIS_Z],
  [AXIS_X + 0.088, 0.405, AXIS_Z - 0.02],
  [AXIS_X + 0.142, 0.26, AXIS_Z - 0.1],
  [AXIS_X + 0.17, 0.075, AXIS_Z - 0.2],
  [AXIS_X + 0.185, 0.01, AXIS_Z - 0.29],
];
