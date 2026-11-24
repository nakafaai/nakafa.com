import { Array as Arr, Match, Schema } from "effect";

export const PROPERTIES = ["cohesion", "adhesion", "heat"] as const;
const PropertySchema = Schema.Literals(PROPERTIES);
export type Property = typeof PropertySchema.Type;

export const WATER_SPECIFIC_HEAT = 4.184;
export const ETHANOL_SPECIFIC_HEAT = 2.376;
const SURFACE_TENSION = 0.0728;
const WATER_DENSITY = 1000;
const GRAVITY = 9.81;
const HALF_HOH_RAD = ((104.5 / 2) * Math.PI) / 180;
const OH_BOND = 0.095;

const WaterMoleculeSchema = Schema.Struct({
  h1: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  h2: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
  oxygen: Schema.Tuple([Schema.Finite, Schema.Finite, Schema.Finite]),
});

export type WaterMolecule = typeof WaterMoleculeSchema.Type;

/**
 * Capillary rise of water in a hydrophilic xylem or glass tube of radius
 * `radiusUm` (micrometres), computed from Jurin's law in metres.
 */
export function capillaryRiseMeters(radiusUm: number): number {
  const radiusM = Math.max(1, radiusUm) * 1e-6;
  return (2 * SURFACE_TENSION) / (WATER_DENSITY * GRAVITY * radiusM);
}

/** Temperature rise (degrees C) for `heatJ` joules into `massG` grams of liquid. */
export function temperatureRise(
  heatJ: number,
  massG: number,
  specificHeat: number
): number {
  return heatJ / (Math.max(0.1, massG) * specificHeat);
}

/** Build one V-shaped H2O molecule (104.5 deg H-O-H bond angle) oriented by `tilt`. */
export function makeWater(
  cx: number,
  cy: number,
  cz: number,
  tilt: number
): WaterMolecule {
  const a1 = tilt + HALF_HOH_RAD;
  const a2 = tilt - HALF_HOH_RAD;
  return {
    h1: [cx + Math.cos(a1) * OH_BOND, cy + Math.sin(a1) * OH_BOND, cz],
    h2: [cx + Math.cos(a2) * OH_BOND, cy + Math.sin(a2) * OH_BOND, cz],
    oxygen: [cx, cy, cz],
  };
}

/**
 * Normalized visual column height (0.25..1.0) inside the 3D tube, inversely
 * proportional to tube radius.
 */
export function visualColumnHeight(
  radiusUm: number,
  minUm: number,
  maxUm: number
): number {
  const span = Math.max(1, maxUm - minUm);
  const ratio = Math.max(0, Math.min(1, (radiusUm - minUm) / span));
  return 1 - ratio * 0.68;
}

/** Arranged 3D water molecules for the active property mode. */
export function waterLattice(
  property: Property,
  columnHeight: number
): readonly WaterMolecule[] {
  return Match.value(property).pipe(
    Match.when("cohesion", () =>
      Arr.makeBy(7, (index) => {
        const y = 0.14 + (index / 6) * (columnHeight * 0.92);
        const x = index % 2 === 0 ? -0.06 : 0.06;
        return makeWater(
          x,
          y,
          0,
          Math.PI / 2 + (index % 2 === 0 ? -0.25 : 0.25)
        );
      })
    ),
    Match.when("adhesion", () =>
      Arr.makeBy(6, (index) => {
        const side = index % 2 === 0 ? -1 : 1;
        const row = Math.floor(index / 2);
        const y = 0.2 + row * 0.3 * columnHeight;
        return makeWater(side * 0.17, y, 0, side > 0 ? Math.PI : 0);
      })
    ),
    Match.when("heat", () =>
      Arr.makeBy(6, (index) => {
        const col = index % 3;
        const row = Math.floor(index / 3);
        return makeWater(-0.56 + col * 0.16, 0.22 + row * 0.22, 0, 0.5 * index);
      })
    ),
    Match.exhaustive
  );
}
