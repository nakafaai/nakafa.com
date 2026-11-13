import { Array as Arr, Number as Num, Schema } from "effect";

/** The elements the mass-conservation labs need. */
const ElementSchema = Schema.Literals([
  "Ag",
  "C",
  "Cl",
  "Fe",
  "H",
  "Hg",
  "N",
  "Na",
  "O",
]);
type Element = typeof ElementSchema.Type;

/**
 * Standard atomic weights in g/mol, as the abridged values of the IUPAC
 * Commission on Isotopic Abundances and Atomic Weights (2021), the values
 * school tables print.
 */
const ATOMIC_WEIGHT = {
  Ag: 107.87,
  C: 12.011,
  Cl: 35.45,
  Fe: 55.845,
  H: 1.008,
  Hg: 200.59,
  N: 14.007,
  Na: 22.99,
  O: 15.999,
} satisfies Record<Element, number>;

/** A formula as each element with the count of its atoms, such as NaHCO₃. */
const FormulaSchema = Schema.Array(
  Schema.Tuple([ElementSchema, Schema.Int.check(Schema.isGreaterThan(0))])
);
type Formula = typeof FormulaSchema.Type;

/** The molar mass of a formula in g/mol: the sum of its atoms' weights. */
export function molarMass(formula: Formula) {
  return Num.sumAll(
    Arr.map(formula, ([element, count]) => ATOMIC_WEIGHT[element] * count)
  );
}

/** The compounds the mass-conservation labs weigh. */
export const COMPOUND = {
  agcl: [
    ["Ag", 1],
    ["Cl", 1],
  ],
  agno3: [
    ["Ag", 1],
    ["N", 1],
    ["O", 3],
  ],
  co2: [
    ["C", 1],
    ["O", 2],
  ],
  fe: [["Fe", 1]],
  nacl: [
    ["Na", 1],
    ["Cl", 1],
  ],
  nahco3: [
    ["Na", 1],
    ["H", 1],
    ["C", 1],
    ["O", 3],
  ],
  nano3: [
    ["Na", 1],
    ["N", 1],
    ["O", 3],
  ],
  o: [["O", 1]],
} satisfies Record<string, Formula>;

/**
 * Baking soda in vinegar: NaHCO₃ + CH₃COOH → CH₃COONa + H₂O + CO₂. Every
 * mole of baking soda frees one mole of carbon dioxide, so `soda` grams of it
 * free soda·M(CO₂)/M(NaHCO₃) grams of gas, with the vinegar in excess.
 */
export function carbonDioxideFrom(soda: number) {
  return (soda * molarMass(COMPOUND.co2)) / molarMass(COMPOUND.nahco3);
}

/**
 * How far a fizzing reaction has gone after `time` seconds: it starts fast
 * and slows as the baking soda runs out, 1 − e^(−t/τ). The lab's model takes
 * τ = 4 s.
 */
export const FIZZ_TIME = 4;
export function fizzProgress(time: number) {
  return time <= 0 ? 0 : 1 - Math.exp(-time / FIZZ_TIME);
}

/**
 * Steel wool burning in air: 3Fe + 2O₂ → Fe₃O₄. Each gram of iron that burns
 * takes 2·M(O₂)/(3·M(Fe)) grams of oxygen out of the air, so the wool gets
 * heavier. Flinn Scientific's "Steely Wools of Fire" names magnetite as the
 * product; the Royal Society of Chemistry's "The combustion of iron wool"
 * shows the gain on a balance.
 */
export function oxygenTakenBy(iron: number) {
  return (iron * 4 * molarMass(COMPOUND.o)) / (3 * molarMass(COMPOUND.fe));
}

/**
 * Silver nitrate meets salt: AgNO₃ + NaCl → AgCl(s) + NaNO₃. The lab mixes
 * 50.00 g of water holding 0.0050 mol of each salt, so 0.0050 mol of white
 * silver chloride falls out, and nothing leaves the beakers.
 */
export const PRECIPITATE = {
  amount: 0.005,
  water: 50,
} as const;

/** The mass of one beaker's salt in the precipitation lab, in grams. */
export function saltMass(formula: Formula) {
  return PRECIPITATE.amount * molarMass(formula);
}

/** The silver chloride that forms in the precipitation lab, in grams. */
export function precipitateMass() {
  return saltMass(COMPOUND.agcl);
}

/**
 * Lavoisier's twelve days of heating mercury in air, as his "Elements of
 * Chemistry" (1789; Kerr's translation, 1790, Part I, Chapter III) reports:
 * about 50 cubic inches of air shrank to between 42 and 43 while 45 grains of
 * red calx formed, and heating that calx again gave back 41½ grains of
 * mercury and 7 or 8 cubic inches of the gas. The lab takes the middle of
 * each range he gives.
 */
export const LAVOISIER = {
  airAfter: 42.5,
  airBefore: 50,
  calx: 45,
  days: 12,
  gasBack: 7.5,
  mercuryBack: 41.5,
} as const;

/**
 * The air left under the bell jar after `day` days, in cubic inches. The
 * lab's model lets the air shrink fastest while the mercury surface is fresh
 * and level off as Lavoisier saw it stop, reaching his 42.5 on day twelve.
 */
export function airAfterDays(day: number) {
  const clamped = Math.min(LAVOISIER.days, Math.max(0, day));
  const shape =
    (1 - Math.exp(-clamped / 4)) / (1 - Math.exp(-LAVOISIER.days / 4));
  return (
    LAVOISIER.airBefore - (LAVOISIER.airBefore - LAVOISIER.airAfter) * shape
  );
}

/** The red calx formed after `day` days, in grains, in step with the air lost. */
export function calxAfterDays(day: number) {
  return (
    (LAVOISIER.calx * (LAVOISIER.airBefore - airAfterDays(day))) /
    (LAVOISIER.airBefore - LAVOISIER.airAfter)
  );
}

/** The mass the calx gains over its mercury: the gas it took from the air. */
export function oxygenInCalx() {
  return LAVOISIER.calx - LAVOISIER.mercuryBack;
}

/** One cubic inch in cubic metres: (0.0254 m)³, exact by the inch's definition. */
export const CUBIC_INCH = 0.0254 ** 3;

/**
 * How far the mercury climbs inside a bell jar of inner radius `radius`
 * metres once `day` days of calcination have taken air from it: the lost
 * volume spread over the jar's cross section, ΔV / (πr²).
 */
export function mercuryRiseAfterDays(day: number, radius: number) {
  const lost = (LAVOISIER.airBefore - airAfterDays(day)) * CUBIC_INCH;
  return lost / (Math.PI * radius ** 2);
}
