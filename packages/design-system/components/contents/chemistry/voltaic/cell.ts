import { Schema } from "effect";

/** The metals a half-cell can be made of, each dipped in a solution of its own ions. */
const MetalSchema = Schema.Literals([
  "magnesium",
  "zinc",
  "iron",
  "copper",
  "silver",
]);
export type Metal = typeof MetalSchema.Type;

/** One half-cell's data: its standard electrode potential, its ion's charge, and its metal's molar mass. */
const HalfCellSchema = Schema.Struct({
  charge: Schema.Int,
  ion: Schema.String,
  molarMass: Schema.Finite,
  potential: Schema.Finite,
  symbol: Schema.String,
});
type HalfCell = typeof HalfCellSchema.Type;

/**
 * Standard electrode potentials in volts at 25 °C, as the SPM data page
 * gives them, the charge of each metal's ion, and the relative atomic mass
 * the paper prints.
 */
const HALF_CELLS = {
  copper: {
    charge: 2,
    ion: "\\mathrm{Cu^{2+}}",
    molarMass: 64,
    potential: 0.34,
    symbol: "\\mathrm{Cu}",
  },
  iron: {
    charge: 2,
    ion: "\\mathrm{Fe^{2+}}",
    molarMass: 56,
    potential: -0.44,
    symbol: "\\mathrm{Fe}",
  },
  magnesium: {
    charge: 2,
    ion: "\\mathrm{Mg^{2+}}",
    molarMass: 24,
    potential: -2.38,
    symbol: "\\mathrm{Mg}",
  },
  silver: {
    charge: 1,
    ion: "\\mathrm{Ag^+}",
    molarMass: 108,
    potential: 0.8,
    symbol: "\\mathrm{Ag}",
  },
  zinc: {
    charge: 2,
    ion: "\\mathrm{Zn^{2+}}",
    molarMass: 65,
    potential: -0.76,
    symbol: "\\mathrm{Zn}",
  },
} satisfies Record<Metal, HalfCell>;

/** One half-cell's data. */
export function halfCell(metal: Metal) {
  return HALF_CELLS[metal];
}

/**
 * The two half-cells in the roles they take: the metal with the more
 * negative potential is oxidised at the negative terminal, the other's ions
 * are reduced at the positive terminal, and the voltage is the difference.
 */
export function cellOf(first: Metal, second: Metal) {
  const [negative, positive] =
    HALF_CELLS[first].potential <= HALF_CELLS[second].potential
      ? [first, second]
      : [second, first];
  return {
    negative,
    positive,
    voltage: HALF_CELLS[positive].potential - HALF_CELLS[negative].potential,
  };
}

/** The half-equation at the negative terminal, where the metal dissolves. */
export function oxidation(metal: Metal) {
  const { charge, ion, symbol } = HALF_CELLS[metal];
  return `${symbol} \\rightarrow ${ion} + ${charge === 1 ? "" : String(charge)}e^-`;
}

/** The half-equation at the positive terminal, where the metal deposits. */
export function reduction(metal: Metal) {
  const { charge, ion, symbol } = HALF_CELLS[metal];
  return `${ion} + ${charge === 1 ? "" : String(charge)}e^- \\rightarrow ${symbol}`;
}

/** The mass in grams of a metal that dissolves or deposits when `electrons` moles of electrons pass. */
export function massFor(metal: Metal, electrons: number) {
  const { charge, molarMass } = HALF_CELLS[metal];
  return (electrons / charge) * molarMass;
}
