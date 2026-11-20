import {
  exhaustedAt,
  productionRate,
  SETUP,
} from "@repo/design-system/components/contents/biology/yeast/ferment";
import {
  BOILING_TUBE,
  levelOf,
  wettedArea,
} from "@repo/design-system/components/contents/biology/yeast/tube";

/**
 * Standard enthalpies of formation, in kJ/mol: α-D-glucose crystal, liquid
 * ethanol and carbon dioxide gas (CRC Handbook of Chemistry and Physics,
 * 97th ed., standard thermodynamic properties of chemical substances).
 */
const FORMATION = {
  carbonDioxide: -393.5,
  ethanol: -277.6,
  glucose: -1273.3,
} as const;

/**
 * Water at 300 K (Incropera and DeWitt, Fundamentals of Heat and Mass
 * Transfer, Table A.6): conductivity in W/(m K), density in kg/m³, specific
 * heat in J/(kg K), kinematic viscosity and thermal diffusivity in m²/s, and
 * expansion in 1/K.
 */
const WATER = {
  conductivity: 0.613,
  density: 997,
  diffusivity: 1.471e-7,
  expansion: 276.1e-6,
  heat: 4179,
  viscosity: 8.575e-7,
} as const;

/** Borosilicate 3.3 glass conducts 1.2 W/(m K) (SCHOTT DURAN data sheet). */
const GLASS_CONDUCTIVITY = 1.2;

/** Standard gravity, in m/s². */
const GRAVITY = 9.806_65;

/**
 * The heat that fermenting one mole of glucose gives off, in kJ/mol:
 * C₆H₁₂O₆ → 2 C₂H₅OH + 2 CO₂ releases 2(−277.6) + 2(−393.5) + 1273.3 =
 * −68.9 kJ, from the enthalpies of formation. The small heats of dissolving
 * glucose, ethanol and carbon dioxide are left out.
 */
export function fermentationHeat() {
  return -(
    2 * FORMATION.ethanol +
    2 * FORMATION.carbonDioxide -
    FORMATION.glucose
  );
}

/** The heat the yeast tube gives off at `celsius`, in watts. */
export function heatPower(celsius: number) {
  const glucose = productionRate(celsius) / 2 / 1000 / 60;
  return glucose * fermentationHeat() * 1000;
}

/** The suspension in the yeast tube, in millilitres. */
function suspension() {
  return SETUP.glucose + SETUP.suspension;
}

/**
 * How far above the bath the yeast tube settles while the yeast works at
 * `celsius`, in °C. The heat leaves through still water inside the tube, the
 * glass wall, and still water outside. Each water film passes heat by free
 * convection on a vertical wall, Nu = 0.59 Ra^¼ (Incropera, eq. 9.27), so
 * h = C ΔT^¼ and a film takes ΔT = (q / CA)^⅘; the wall takes q w / (kA).
 * The outside film is drawn on the same area as the inside one.
 */
export function steadyRise(celsius: number) {
  const power = heatPower(celsius);
  const area = wettedArea(BOILING_TUBE, suspension());
  const height = levelOf(BOILING_TUBE, suspension());
  const buoyancy =
    (GRAVITY * WATER.expansion) / (WATER.viscosity * WATER.diffusivity);
  const film = (0.59 * WATER.conductivity * buoyancy ** 0.25) / height ** 0.25;
  const across = (power / (film * area)) ** 0.8;
  const wall = (power * BOILING_TUBE.wall) / (GLASS_CONDUCTIVITY * area);
  return 2 * across + wall;
}

/**
 * How long the yeast tube takes to settle at its rise, in minutes: the heat
 * its 20 mL hold over the heat they lose for each degree above the bath.
 */
export function settling(celsius: number) {
  const capacity = (suspension() / 1e6) * WATER.density * WATER.heat;
  return (capacity * steadyRise(celsius)) / heatPower(celsius) / 60;
}

/**
 * How far above the bath the yeast tube stands after `minutes`, in °C: it
 * warms towards its steady rise while the yeast ferments and cools back once
 * the glucose is gone. The bath holds the control at its own temperature.
 */
export function riseAt(celsius: number, percent: number, minutes: number) {
  if (heatPower(celsius) <= 0) {
    return 0;
  }
  const lag = settling(celsius);
  const end = Math.min(minutes, exhaustedAt(celsius, percent));
  const warmed = steadyRise(celsius) * (1 - Math.exp(-end / lag));
  return warmed * Math.exp(-(minutes - end) / lag);
}
