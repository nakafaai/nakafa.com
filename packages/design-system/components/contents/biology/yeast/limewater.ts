import {
  DELIVERY,
  GAS_CONSTANT,
  HENRY,
} from "@repo/design-system/components/contents/biology/yeast/ferment";
import {
  innerRadius,
  levelOf,
  TEST_TUBE,
} from "@repo/design-system/components/contents/biology/yeast/tube";
import { Array as Arr } from "effect";

/**
 * Water at 25 °C, where the limewater stands on the bench: its surface
 * tension in N/m, density in kg/m³, and viscosity in Pa s (CRC Handbook of
 * Chemistry and Physics, 97th ed., surface tension of water 71.99 mN/m,
 * density 0.997 05 g/cm³, viscosity 0.890 mPa s).
 */
const WATER = { density: 997.05, tension: 0.071_99, viscosity: 8.9e-4 };

/** Standard gravity, in m/s². */
const GRAVITY = 9.806_65;

/** The temperature of the bench, in kelvin, at which the water constants hold. */
const BENCH = 298.15;

/** The limewater in the test tube, in millilitres: half the tube. */
export const LIMEWATER = 10;

/** How far above the inside of the test tube's foot the delivery tube ends, in metres. */
export const OUTLET = 0.01;

/**
 * Saturated limewater: 1.73 g of calcium hydroxide in a litre at 20 °C (CRC
 * Handbook, aqueous solubility of inorganic compounds), whose molar mass is
 * 74.093 g/mol.
 */
const LIME = { molarMass: 74.093, solubility: 1.73 } as const;

/**
 * The rate constant of CO₂ + OH⁻ → HCO₃⁻, in L mol⁻¹ s⁻¹: log k = 13.635 −
 * 2895 / T (Pinsent, Pearson and Roughton 1956, Trans. Faraday Soc. 52:1512).
 */
function hydroxideRate(temperature: number) {
  return 10 ** (13.635 - 2895 / temperature);
}

/** How fast carbon dioxide diffuses through water at 25 °C, in m²/s (CRC Handbook, 1.91 × 10⁻⁵ cm²/s). */
const DIFFUSIVITY = 1.91e-9;

/**
 * Calcium carbonate as it comes out of limewater: grains about a micrometre
 * across (plain CO₂ bubbling gives micron-sized calcite: Altiner 2018,
 * Period. Polytech. Chem. Eng. 62:209), of calcite at 2710 kg/m³ (CRC
 * Handbook), each grain blocking about twice its own cross-section of light
 * (van de Hulst 1957, Light Scattering by Small Particles), and 100.087 g/mol.
 */
const CHALK = {
  density: 2710,
  extinction: 2,
  grain: 1e-6,
  molarMass: 100.087,
} as const;

/**
 * The gas in one bubble that leaves the delivery tube, in millilitres: at a
 * slow flow a bubble grows on the bore's rim until its lift beats surface
 * tension, V = 2πrσ / (ρg) (Davidson and Schüler 1960, Trans. Inst. Chem.
 * Eng. 38:144, the low-flow limit).
 */
export function bubbleVolume() {
  return (
    ((2 * Math.PI * DELIVERY.bore * WATER.tension) /
      (WATER.density * GRAVITY)) *
    1e6
  );
}

/** The diameter of a sphere of `volume` millilitres, in metres. */
export function sphereDiameter(volume: number) {
  return Math.cbrt((6 * volume) / 1e6 / Math.PI);
}

/**
 * How fast a bubble of `diameter` metres rises through still water, in m/s,
 * by Mendelson's wave analogy, U = √(2σ / (ρd) + gd / 2) (Mendelson 1967,
 * AIChE J. 13:250), which holds for bubbles of a few millimetres.
 */
export function riseSpeed(diameter: number) {
  return Math.sqrt(
    (2 * WATER.tension) / (WATER.density * diameter) + (GRAVITY * diameter) / 2
  );
}

/**
 * How fast a fine bubble of `diameter` metres rises, in m/s: buoyancy against
 * the drag of a small sphere, C_D = 24 / Re · (1 + 0.15 Re^0.687) (Schiller
 * and Naumann; Clift, Grace and Weber 1978, Bubbles, Drops, and Particles),
 * found by fixed-point iteration from Stokes' speed. A fine bubble in a
 * suspension behaves as a rigid sphere.
 */
export function fineRiseSpeed(diameter: number) {
  const { density, viscosity } = WATER;
  const stokes = (density * GRAVITY * diameter ** 2) / (18 * viscosity);
  return Arr.reduce(Arr.range(1, 40), stokes, (speed) => {
    const reynolds = (density * speed * diameter) / viscosity;
    const drag = (24 / reynolds) * (1 + 0.15 * reynolds ** 0.687);
    return Math.sqrt((4 * GRAVITY * diameter) / (3 * drag));
  });
}

/** How deep the delivery tube's end sits under the limewater's surface, in metres. */
export function outletDepth() {
  return levelOf(TEST_TUBE, LIMEWATER) - OUTLET;
}

/** The calcium in the limewater, in millimoles. */
export function calcium() {
  return (LIME.solubility / LIME.molarMass) * LIMEWATER;
}

/**
 * The share of the carbon dioxide in each bubble that the limewater takes up
 * as the bubble rises from the delivery tube to the surface. Each fresh patch
 * of the bubble's skin touches the water for d / U, so the water side takes
 * carbon dioxide up at k = 2√(D U / (π d)) (Higbie's penetration theory);
 * hydroxide ions react with it as it dissolves, which speeds that to
 * √(D k₁ + k²) (Danckwerts, Gas-Liquid Reactions, 1970), k₁ = k[OH⁻]. Over
 * the rise time the bubble keeps 1 − e^(−6 k H t / d) of it, H the
 * dimensionless solubility. The hydroxide is taken at its fresh strength.
 */
export function absorbedShare() {
  const diameter = sphereDiameter(bubbleVolume());
  const speed = riseSpeed(diameter);
  const contact = diameter / speed;
  const physical = 2 * Math.sqrt(DIFFUSIVITY / (Math.PI * contact));
  const hydroxide = (2 * LIME.solubility) / LIME.molarMass;
  const pseudo = hydroxideRate(BENCH) * hydroxide;
  const enhanced = Math.sqrt(DIFFUSIVITY * pseudo + physical ** 2);
  const solubility = HENRY.reference * GAS_CONSTANT * BENCH;
  const rise = outletDepth() / speed;
  return 1 - Math.exp((-6 * enhanced * solubility * rise) / diameter);
}

/**
 * The calcium carbonate in the limewater once `delivered` millimoles of
 * carbon dioxide have bubbled through it, in millimoles: Ca(OH)₂ + CO₂ →
 * CaCO₃ + H₂O, until every calcium ion has precipitated. Bubbling on long
 * after that slowly dissolves the chalk again as calcium hydrogen carbonate;
 * the practical stops at the milky limewater.
 */
export function chalkAt(delivered: number) {
  return Math.min(delivered * absorbedShare(), calcium());
}

/**
 * How milky the limewater looks, from 0 for clear to 1 for opaque: the light
 * a reader sees through the tube falls as e^(−τ), with the optical depth
 * τ = 3Qc L / (2ρd) of grains of diameter d at c kg/m³ across the tube's
 * bore L (the Beer–Lambert law for large particles).
 */
export function milkiness(chalk: number) {
  const concentration = (chalk * CHALK.molarMass) / LIMEWATER;
  const path = 2 * innerRadius(TEST_TUBE);
  const depth =
    (3 * CHALK.extinction * concentration * path) /
    (2 * CHALK.density * CHALK.grain);
  return 1 - Math.exp(-depth);
}

/** Whether a reader calls the limewater milky: once it stops half the light. */
export function isMilky(cloud: number) {
  return cloud >= 0.5;
}

/** How many bubbles leave the delivery tube in a minute when `flow` mL of gas a minute pass. */
export function bubbleRate(flow: number) {
  return flow / bubbleVolume();
}

/**
 * How far through its growth the bubble on the delivery tube's end is at
 * `seconds`, from 0 to 1, when `rate` bubbles a minute leave it: the gas
 * flows in steadily, so the bubble's volume grows in step with the clock.
 */
export function bubbleGrowth(rate: number, seconds: number) {
  if (rate <= 0) {
    return 0;
  }
  const interval = 60 / rate;
  return (seconds % interval) / interval;
}

/**
 * How high above the delivery tube's end the last bubble to leave has
 * risen at `seconds`, in metres, when `rate` bubbles a minute leave it; with
 * no bubbles, none is on its way.
 */
export function bubbleRisen(rate: number, seconds: number) {
  if (rate <= 0) {
    return Number.POSITIVE_INFINITY;
  }
  const speed = riseSpeed(sphereDiameter(bubbleVolume()));
  return (seconds % (60 / rate)) * speed;
}

/** A fine bubble that yeast gives off in the suspension, 0.6 mm across, in metres. */
export const FINE = 6e-4;

/**
 * How many fine bubbles cling to the glass at any moment while `flow` mL of
 * gas a minute leave a column `height` metres tall of inner radius `radius`:
 * the bubbles made each second, each rising half the column on average at
 * its fine rise speed, of which the shell one bubble deep against the glass,
 * 2d / r of the column, shows through the cloudy suspension.
 */
export function fizzCount(flow: number, height: number, radius: number) {
  const each = (Math.PI / 6) * FINE ** 3 * 1e6;
  const made = flow / 60 / each;
  const shown = (2 * FINE) / radius;
  return (made * height * shown) / (2 * fineRiseSpeed(FINE));
}
