import { Schema } from "effect";

/**
 * The oxygen a rice root and a dryland crop's root get in a paddy field, drained or
 * flooded, from the diffusion of oxygen through soil and through the air
 * channels of the root. Every value is relative to air saturation: 1 is the
 * oxygen of air, or of water in balance with air, and 0 is none.
 */

/** Whether the field is drained or flooded under standing water. */
export const WaterSchema = Schema.Literals(["drained", "flooded"]);
export type Water = typeof WaterSchema.Type;

/**
 * The two plants the lab grows: paddy rice (Oryza sativa), a wetland crop,
 * and a dryland crop, measured and drawn as maize (Zea mays), the dryland
 * cereal the aerenchyma studies compare rice with.
 */
export const PlantSchema = Schema.Literals(["rice", "dryland"]);
export type Plant = typeof PlantSchema.Type;

/**
 * How fast oxygen diffuses at 25 °C, in square metres a second: 0.176 cm²/s
 * in air and 2.10 × 10⁻⁵ cm²/s in water (CRC Handbook of Chemistry and
 * Physics, mass diffusivity of oxygen in air and in water). Oxygen moves
 * about 10 000 times more slowly in water than in air (Armstrong and Drew
 * 2002, as cited by Yamauchi et al. 2019, Front. Plant Sci. 10:259).
 */
export const DIFFUSION = { air: 1.76e-5, water: 2.1e-9 } as const;

/**
 * Air at 25 °C and one standard atmosphere: 20.95 % of its molecules are
 * oxygen (CRC Handbook, composition of dry air), the gas constant is
 * 8.314 462 618 J/(mol·K) (CODATA 2018).
 */
const AIR = {
  constant: 8.314_462_618,
  fraction: 0.2095,
  pressure: 101_325,
  temperature: 298.15,
} as const;

/**
 * Fresh water in balance with air at 25 °C and one atmosphere holds 8.26 mg
 * of oxygen a litre (Benson and Krause 1984, Limnol. Oceanogr. 29:620-632,
 * the USGS oxygen solubility tables); oxygen weighs 31.998 g/mol.
 */
const SATURATION = { grams: 8.26, molar: 31.998 } as const;

/**
 * Microsensors in flooded paddy soil read 140 µmol/L of oxygen where the
 * floodwater meets the soil and none from about 2.0 mm down (Lüdemann, Arth
 * and Liesack 2000, Appl. Environ. Microbiol. 66:754-762).
 */
export const FLOODED = { depth: 0.002, oxygen: 0.14 } as const;

/**
 * A loam in good condition for plants is half pore space, and when drained
 * half of that pore space holds air: 25 % air and 25 % water by volume
 * (Brady and Weil, The Nature and Properties of Soils, composition of a
 * loam surface soil).
 */
const SOIL = { air: 0.25, pores: 0.5 } as const;

/**
 * Lowland rice roots stay above the plough pan, which lies about 20 cm deep
 * (Frontiers in Plant Science 13:959784, 2022), in metres.
 */
export const ROOT_DEPTH = 0.2;

/**
 * The share of a root's cross-section that is air channels (aerenchyma),
 * 50 mm behind the tip of an adventitious root (Yamauchi et al. 2019, Front.
 * Plant Sci. 10:259, Fig. 3C): 0.42 for paddy rice grown in stagnant,
 * oxygen-free solution as a flooded paddy is, and 0.01 for maize grown in
 * aerated solution as a dryland field is, before any flood.
 */
const POROSITY = { dryland: 0.01, rice: 0.42 } as const;

/**
 * Root tissue takes up 2.5 nmol of oxygen per gram of fresh mass a second
 * 20 to 40 mm behind the tip (Insalud et al. 2006, Ann. Bot. 98:995-1004,
 * Table 5, rice). Both plants are given this rate, so the comparison turns
 * on their air channels alone. Living cells are mostly water, 10⁶ g/m³.
 */
const RESPIRATION = { density: 1e6, rate: 2.5e-9 } as const;

/**
 * Cytochrome c oxidase, which takes the oxygen at the end of aerobic
 * respiration, is half saturated at 0.14 µmol/L of oxygen (Drew 1997, Annu.
 * Rev. Plant Physiol. Plant Mol. Biol. 48:223-250).
 */
const HALF_SATURATION = 0.14e-3;

/** Fermentation yields 2 ATP from each glucose (OpenStax Biology 2e, 7.5). */
const FERMENTATION_ATP = 2;

/** Moles of oxygen in a cubic metre of air at 25 °C, from the ideal gas law. */
export function airOxygen() {
  return (AIR.fraction * AIR.pressure) / (AIR.constant * AIR.temperature);
}

/** Moles of oxygen in a cubic metre of water in balance with air at 25 °C. */
export function waterOxygen() {
  return SATURATION.grams / SATURATION.molar;
}

/**
 * How fast oxygen diffuses through the soil, in square metres a second, from
 * Millington and Quirk (1961, Trans. Faraday Soc. 57:1200-1207): the free
 * value times θ^(10/3) / φ², where θ is the share of the soil the gas
 * travels in and φ its pore space. A drained soil carries oxygen as gas
 * through its air-filled pores; a flooded one only dissolved, through pores
 * full of water.
 */
export function soilDiffusion(water: Water) {
  const share = water === "drained" ? SOIL.air : SOIL.pores;
  const free = water === "drained" ? DIFFUSION.air : DIFFUSION.water;
  return (free * share ** (10 / 3)) / SOIL.pores ** 2;
}

/**
 * How fast the soil uses oxygen, in moles a cubic metre a second, read from
 * the flooded profile. Oxygen diffusing down at `D` into soil that uses it at
 * a steady rate `Q` falls from `c₀` to nothing at depth `δ = √(2Dc₀/Q)`, so
 * the measured depth and surface value give `Q = 2Dc₀/δ²`.
 */
export function soilDemand() {
  return (2 * soilDiffusion("flooded") * FLOODED.oxygen) / FLOODED.depth ** 2;
}

/**
 * The depth, in metres, at which the soil's oxygen runs out: about 2 mm
 * under standing water, and tens of centimetres in a drained soil whose air
 * carries oxygen from the open air.
 */
export function oxicDepth(water: Water) {
  const surface = water === "drained" ? airOxygen() : FLOODED.oxygen;
  return Math.sqrt((2 * soilDiffusion(water) * surface) / soilDemand());
}

/** The soil's oxygen at its surface: the open air, or the floodwater over it. */
export function surfaceOxygen(water: Water) {
  return water === "drained" ? 1 : FLOODED.oxygen / waterOxygen();
}

/**
 * The soil's oxygen `depth` metres under its surface: `c₀(1 − z/δ)²`, the
 * profile of steady diffusion into soil that uses oxygen at a steady rate,
 * and none below the depth `δ` where it runs out.
 */
export function soilOxygen(water: Water, depth: number) {
  const left = Math.max(0, 1 - Math.max(0, depth) / oxicDepth(water));
  return surfaceOxygen(water) * left * left;
}

/**
 * How long a root can be and still carry air to its tip from the shoot, in
 * metres (Armstrong 1979, Adv. Bot. Res. 7:225-332): oxygen diffusing down
 * air channels of porosity ε, used by the living tissue around them, runs
 * out after `Λ = √(2·D·ε·c / R)`, where `c` is the oxygen of air and `R` the
 * tissue's uptake a cubic metre of root.
 */
export function aeratedLength(plant: Plant) {
  const porosity = POROSITY[plant];
  const uptake = RESPIRATION.rate * RESPIRATION.density * (1 - porosity);
  return Math.sqrt((2 * DIFFUSION.air * porosity * airOxygen()) / uptake);
}

/**
 * The oxygen inside a root `along` metres below its base, carried down its
 * air channels from the shoot, when the root grows `ROOT_DEPTH` long through
 * soil that gives it none. A root shorter than the length it can aerate
 * keeps air to its tip; a longer one runs out of oxygen beyond that length.
 */
export function channelOxygen(plant: Plant, along: number) {
  const reach = aeratedLength(plant);
  if (ROOT_DEPTH <= reach) {
    return 1 - (2 * ROOT_DEPTH * along - along * along) / (reach * reach);
  }
  const left = Math.max(0, 1 - along / reach);
  return left * left;
}

/**
 * The oxygen the cells of a root get `depth` metres down: from the soil
 * around it or down its own air channels, whichever gives more.
 */
export function rootOxygen(plant: Plant, water: Water, depth: number) {
  return Math.max(soilOxygen(water, depth), channelOxygen(plant, depth));
}

/**
 * The share of a cell's glucose respired aerobically at `oxygen`: a
 * Michaelis-Menten curve of the oxygen dissolved in the cell, half saturated
 * at cytochrome c oxidase's constant and scaled so a cell in air respires
 * every glucose aerobically. The rest is fermented.
 */
export function aerobicShare(oxygen: number) {
  const half = HALF_SATURATION / waterOxygen();
  return (oxygen * (half + 1)) / (half + oxygen);
}

/**
 * The share of a cell's ATP that fermentation makes when `aerobic` of its
 * glucose is respired with oxygen at `atp` ATP each and the rest is fermented
 * at 2 ATP each.
 */
export function fermentationEnergy(aerobic: number, atp: number) {
  const fermented = FERMENTATION_ATP * (1 - aerobic);
  return fermented / (fermented + atp * aerobic);
}

/**
 * Ethanol made per glucose the cell breaks down: alcoholic fermentation turns
 * each fermented glucose into 2 ethanol and 2 carbon dioxide.
 */
export function ethanolYield(aerobic: number) {
  return 2 * (1 - aerobic);
}

/**
 * Whether the root tips still get any oxygen at the bottom of the root zone.
 * Tips left with none die within a day: the root tips of maize survive 24 h
 * or less without oxygen at 25 °C (Johnson, Cobb and Drew 1989, Plant
 * Physiol. 91:837-841), while rice keeps air flowing to its tips.
 */
export function rootsSurvive(plant: Plant, water: Water) {
  return rootOxygen(plant, water, ROOT_DEPTH) > 0;
}

/** What a root's cells do at `depth`: their oxygen, aerobic share, and fermentation's share of their energy. */
export function rootState(
  plant: Plant,
  water: Water,
  depth: number,
  atp: number
) {
  const oxygen = rootOxygen(plant, water, depth);
  const aerobic = aerobicShare(oxygen);
  return {
    aerobic,
    energy: fermentationEnergy(aerobic, atp),
    ethanol: ethanolYield(aerobic),
    oxygen,
  };
}
