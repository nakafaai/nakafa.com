import {
  BOILING_TUBE,
  capacity,
  innerRadius,
  levelOf,
} from "@repo/design-system/components/contents/biology/yeast/tube";

/**
 * The cardinal temperatures of Saccharomyces cerevisiae, in °C: below the
 * minimum and above the maximum it does nothing, and at the optimum it works
 * fastest. The species means of ten strains fitted with the cardinal
 * temperature model (Salvadó et al. 2011, Appl. Environ. Microbiol.
 * 77:2292, Table 3).
 */
export const CARDINAL = {
  maximum: 45.39,
  minimum: 2.84,
  optimum: 32.27,
} as const;

/**
 * How fast baker's yeast ferments glucose at 30 °C: 20.5 mmol of ethanol, and
 * so of carbon dioxide, per gram of dry yeast per hour (van Hoek, van Dijken
 * and Pronk 1998, Appl. Environ. Microbiol. 64:4226, fermentative capacity
 * assayed anaerobically at 30 °C).
 */
const CAPACITY = 20.5;

/** The temperature of that assay, in °C. */
const ASSAY = 30;

/**
 * What the yeast tube holds in the KSSM Form 4 activity on fermentation
 * (Biology, Chapter 7, Activity 7.3): 15 mL of boiled and cooled glucose
 * solution, 5 mL of a 5% yeast suspension, and a layer of paraffin oil, here
 * 2 mL. The control holds the same glucose and oil, without yeast.
 */
export const SETUP = {
  glucose: 15,
  oil: 2,
  strength: 5,
  suspension: 5,
} as const;

/** The molar mass of glucose, C₆H₁₂O₆, in g/mol. */
const GLUCOSE_MOLAR_MASS = 180.156;

/** The molar gas constant, in J/(mol K) (CODATA 2018). */
export const GAS_CONSTANT = 8.314_462_618;

/** One standard atmosphere, in pascals. */
const ATMOSPHERE = 101_325;

/** Zero on the Celsius scale, in kelvin. */
const ICE_POINT = 273.15;

/**
 * Henry's law solubility of carbon dioxide in water: 3.3 × 10⁻⁴ mol m⁻³ Pa⁻¹
 * at 25 °C, falling with temperature as d ln H / d(1/T) = 2400 K (Sander
 * 2015, Atmos. Chem. Phys. 15:4399, the recommended value for CO₂).
 */
export const HENRY = { reference: 3.3e-4, slope: 2400 } as const;

/** The temperature Henry's constant is quoted at, in kelvin. */
const HENRY_REFERENCE = 298.15;

/**
 * The rubber bung, a size 4 that fits a 25 mm boiling tube: a taper 25 mm
 * tall from 20 mm across at its foot to 26 mm at its top (Eisco CH0321G2H),
 * its radii and height in metres. It seals where it is as wide as the tube's
 * bore.
 */
export const BUNG = { foot: 0.01, height: 0.025, top: 0.013 } as const;

/** The thermometer's glass stem, 6 mm across, in metres. */
export const STEM = 0.003;

/**
 * The delivery tube: glass tubing 6 mm across with a 4 mm bore, about 34 cm
 * of it from the bung over the bath's rim into the limewater, in metres.
 */
export const DELIVERY = { bore: 0.002, length: 0.34, outer: 0.003 } as const;

/** A temperature in kelvin. */
export function kelvin(celsius: number) {
  return celsius + ICE_POINT;
}

/**
 * How fast the yeast works at `celsius`, as a share of its fastest: the
 * cardinal temperature model with inflection (Rosso et al. 1993, J. Theor.
 * Biol. 162:447). It is slow in the cold, fastest at the optimum, and falls
 * steeply to nothing at the maximum, where heat denatures the enzymes. The
 * growth curve of the species stands for the fermentation of the same yeast.
 */
export function activity(celsius: number) {
  const { maximum, minimum, optimum } = CARDINAL;
  if (celsius <= minimum || celsius >= maximum) {
    return 0;
  }
  const numerator = (celsius - maximum) * (celsius - minimum) ** 2;
  const denominator =
    (optimum - minimum) *
    ((optimum - minimum) * (celsius - optimum) -
      (optimum - maximum) * (optimum + minimum - 2 * celsius));
  return numerator / denominator;
}

/** The yeast in the tube, in grams: 5 mL of a 5% suspension. */
export function yeastMass() {
  return (SETUP.suspension * SETUP.strength) / 100;
}

/**
 * How fast the yeast tube makes carbon dioxide at `celsius`, in millimoles a
 * minute: the yeast's capacity at 30 °C, scaled by its activity. The yeast is
 * counted as fresh, fully active cells; dried yeast that has not yet woken up
 * runs slower at first.
 */
export function productionRate(celsius: number) {
  return (CAPACITY * yeastMass() * activity(celsius)) / activity(ASSAY) / 60;
}

/** The glucose in 15 mL of a `percent` (w/v) solution, in millimoles. */
export function glucoseStock(percent: number) {
  return ((SETUP.glucose * percent) / 100 / GLUCOSE_MOLAR_MASS) * 1000;
}

/**
 * After how many minutes the yeast has fermented all the glucose: each
 * glucose gives two carbon dioxide, C₆H₁₂O₆ → 2 C₂H₅OH + 2 CO₂. A yeast that
 * does not work never runs out.
 */
export function exhaustedAt(celsius: number, percent: number) {
  return (2 * glucoseStock(percent)) / productionRate(celsius);
}

/**
 * The carbon dioxide, and as much ethanol, that the yeast has made after
 * `minutes`, in millimoles: it runs at a steady pace until the glucose is
 * gone.
 */
export function madeAt(celsius: number, percent: number, minutes: number) {
  return Math.min(productionRate(celsius) * minutes, 2 * glucoseStock(percent));
}

/**
 * How much carbon dioxide the 20 mL in the yeast tube take up before gas
 * leaves it, in millimoles: the solution saturated under one atmosphere of
 * carbon dioxide at `celsius`. Warm water holds less, so gas leaves sooner.
 */
export function dissolvedCapacity(celsius: number) {
  const solubility =
    HENRY.reference *
    Math.exp(HENRY.slope * (1 / kelvin(celsius) - 1 / HENRY_REFERENCE));
  const litres = (SETUP.glucose + SETUP.suspension) / 1e6;
  return solubility * ATMOSPHERE * litres * 1000;
}

/** How many millilitres a millimole of gas fills at `celsius` and one atmosphere. */
export function molarVolume(celsius: number) {
  return ((GAS_CONSTANT * kelvin(celsius)) / ATMOSPHERE) * 1000;
}

/**
 * The gas that has left the yeast tube after `minutes`, in millilitres at
 * the bath's temperature: what the yeast made beyond what the solution holds.
 */
export function gasOut(celsius: number, percent: number, minutes: number) {
  const left = madeAt(celsius, percent, minutes) - dissolvedCapacity(celsius);
  return Math.max(0, left) * molarVolume(celsius);
}

/**
 * How fast gas leaves the yeast tube after `minutes`, in millilitres a
 * minute: nothing while the solution is still taking up carbon dioxide or
 * once the glucose is gone, and the yeast's pace in between.
 */
export function gasFlow(celsius: number, percent: number, minutes: number) {
  const saturated =
    madeAt(celsius, percent, minutes) > dissolvedCapacity(celsius);
  const fermenting = minutes < exhaustedAt(celsius, percent);
  return saturated && fermenting
    ? productionRate(celsius) * molarVolume(celsius)
    : 0;
}

/** How deep the bung sits in the boiling tube, in metres: down to where it is as wide as the bore. */
export function plugDepth() {
  const bore = innerRadius(BOILING_TUBE);
  return (BUNG.height * (bore - BUNG.foot)) / (BUNG.top - BUNG.foot);
}

/**
 * How fast gas leaves the yeast tube, as a share of the fastest it ever
 * leaves, at the optimum: what the froth and the fizz in the tube show.
 */
export function flowShare(celsius: number, percent: number, minutes: number) {
  const fastest =
    productionRate(CARDINAL.optimum) * molarVolume(CARDINAL.optimum);
  return gasFlow(celsius, percent, minutes) / fastest;
}

/**
 * The air the gas must push out before pure carbon dioxide reaches the
 * limewater, in millilitres: the boiling tube above the oil and below the
 * bung's tapered plug, less the thermometer's stem, and the bore of the
 * delivery tube.
 */
export function deadVolume() {
  const radius = innerRadius(BOILING_TUBE);
  const filled = SETUP.glucose + SETUP.suspension + SETUP.oil;
  const depth = plugDepth();
  const plug =
    ((Math.PI * depth) / 3) *
    (BUNG.foot ** 2 + BUNG.foot * radius + radius ** 2) *
    1e6;
  const below = BOILING_TUBE.length - BOILING_TUBE.wall - depth;
  const stem = Math.PI * STEM ** 2 * (below - levelOf(BOILING_TUBE, filled));
  const bore = Math.PI * DELIVERY.bore ** 2 * DELIVERY.length;
  return capacity(BOILING_TUBE) - filled - plug + (bore - stem) * 1e6;
}

/**
 * The carbon dioxide that has reached the limewater once `gas` millilitres
 * have left the tube: the gas mixes with the air above the oil, so what comes
 * out turns from air to carbon dioxide as 1 − e^(−V/V₀) and the carbon
 * dioxide delivered is V − V₀(1 − e^(−V/V₀)), V₀ the dead volume.
 */
export function carbonDioxideOut(gas: number) {
  const dead = deadVolume();
  return gas - dead * (1 - Math.exp(-gas / dead));
}
