import { Array as Arr, Schema } from "effect";

/**
 * The aqueous electrolytes an electrolysis cell can hold: the solutions the
 * KSSM Form 4 chapter on electrochemistry works through, with selective
 * discharge decided by position in the electrochemical series and by
 * concentration.
 */
const ElectrolyteSchema = Schema.Literals([
  "copper-sulfate",
  "silver-nitrate",
  "sodium-chloride-dilute",
  "sodium-chloride-concentrated",
  "sulfuric-acid",
]);
type Electrolyte = typeof ElectrolyteSchema.Type;

/** The electrode materials: two inert, and two that dissolve as an anode in their own ions. */
const ElectrodeSchema = Schema.Literals([
  "carbon",
  "platinum",
  "copper",
  "silver",
]);
export type Electrode = typeof ElectrodeSchema.Type;

/** One cell: its electrolyte and the material of both its electrodes. */
const CellSchema = Schema.Struct({
  electrode: ElectrodeSchema,
  electrolyte: ElectrolyteSchema,
});
export type Cell = typeof CellSchema.Type;

/** An ion in an electrolyte, water's own hydrogen and hydroxide ions included. */
const IonSchema = Schema.Literals([
  "copper",
  "silver",
  "sodium",
  "hydrogen",
  "sulfate",
  "nitrate",
  "chloride",
  "hydroxide",
]);
export type Ion = typeof IonSchema.Type;

/** A substance an electrode makes or loses. */
const ProductSchema = Schema.Literals([
  "copper",
  "silver",
  "hydrogen",
  "oxygen",
  "chlorine",
]);
export type Product = typeof ProductSchema.Type;

/** How an electrode changes: a metal coats it, a gas bubbles off, or it dissolves. */
const ChangeSchema = Schema.Literals(["deposit", "gas", "dissolves"]);

/** The direction the pH of the electrolyte moves while the current flows. */
const TrendSchema = Schema.Literals(["falls", "rises", "steady"]);
export type Trend = typeof TrendSchema.Type;

/** What one electrode does: its change, its product, and the half-equation it follows. */
const ReactionSchema = Schema.Struct({
  change: ChangeSchema,
  /** The half-equation in LaTeX, as `\mathrm{Cu^{2+}} + 2e^- \rightarrow \mathrm{Cu}`. */
  equation: Schema.String,
  product: ProductSchema,
});
export type Reaction = typeof ReactionSchema.Type;

/** A product's molar mass in grams per mole and the electrons one mole of it takes or gives. */
const ProductDataSchema = Schema.Struct({
  electrons: Schema.Finite,
  molarMass: Schema.Finite,
});

/**
 * Each product's molar mass in grams per mole, from the relative atomic
 * masses the SPM paper prints (H 1, O 16, Cl 35.5, Cu 64, Ag 108), and the
 * moles of electrons that one mole of it takes or gives.
 */
const PRODUCTS = {
  chlorine: { electrons: 2, molarMass: 71 },
  copper: { electrons: 2, molarMass: 64 },
  hydrogen: { electrons: 2, molarMass: 2 },
  oxygen: { electrons: 4, molarMass: 32 },
  silver: { electrons: 1, molarMass: 108 },
} satisfies Record<Product, typeof ProductDataSchema.Type>;

/** The charge of each ion. */
export const ION_CHARGE = {
  chloride: -1,
  copper: 2,
  hydrogen: 1,
  hydroxide: -1,
  nitrate: -1,
  silver: 1,
  sodium: 1,
  sulfate: -2,
} satisfies Record<Ion, number>;

/** Each ion as LaTeX, for a scene label or a legend. */
export const ION_FORMULA = {
  chloride: "\\mathrm{Cl^-}",
  copper: "\\mathrm{Cu^{2+}}",
  hydrogen: "\\mathrm{H^+}",
  hydroxide: "\\mathrm{OH^-}",
  nitrate: "\\mathrm{NO_3^-}",
  silver: "\\mathrm{Ag^+}",
  sodium: "\\mathrm{Na^+}",
  sulfate: "\\mathrm{SO_4^{2-}}",
} satisfies Record<Ion, string>;

/** Each electrolyte as LaTeX, the label its beaker carries. */
export const ELECTROLYTE_FORMULA = {
  "copper-sulfate": "\\mathrm{CuSO_4(aq)}",
  "silver-nitrate": "\\mathrm{AgNO_3(aq)}",
  "sodium-chloride-concentrated": "\\mathrm{NaCl(aq)}",
  "sodium-chloride-dilute": "\\mathrm{NaCl(aq)}",
  "sulfuric-acid": "\\mathrm{H_2SO_4(aq)}",
} satisfies Record<Electrolyte, string>;

/** Each product as LaTeX. */
export const PRODUCT_FORMULA = {
  chlorine: "\\mathrm{Cl_2}",
  copper: "\\mathrm{Cu}",
  hydrogen: "\\mathrm{H_2}",
  oxygen: "\\mathrm{O_2}",
  silver: "\\mathrm{Ag}",
} satisfies Record<Product, string>;

/** The half-equations, one per way an electrode can change. */
const EQUATIONS = {
  chlorine: "2\\mathrm{Cl^-} \\rightarrow \\mathrm{Cl_2} + 2e^-",
  copperDeposit: "\\mathrm{Cu^{2+}} + 2e^- \\rightarrow \\mathrm{Cu}",
  copperDissolves: "\\mathrm{Cu} \\rightarrow \\mathrm{Cu^{2+}} + 2e^-",
  hydrogen: "2\\mathrm{H^+} + 2e^- \\rightarrow \\mathrm{H_2}",
  oxygen: "4\\mathrm{OH^-} \\rightarrow \\mathrm{O_2} + 2\\mathrm{H_2O} + 4e^-",
  silverDeposit: "\\mathrm{Ag^+} + e^- \\rightarrow \\mathrm{Ag}",
  silverDissolves: "\\mathrm{Ag} \\rightarrow \\mathrm{Ag^+} + e^-",
};

/** What an electrolyte holds and does: its ions, its two reactions, and its look. */
const ElectrolyteDataSchema = Schema.Struct({
  cathode: ReactionSchema,
  inertAnode: ReactionSchema,
  ions: Schema.Array(IonSchema),
  tint: Schema.Literals(["blue", "clear"]),
});

/**
 * Each electrolyte's ions, the cathode reaction, the reaction at an inert
 * anode, and the solution's look. The cathode discharges the cation lowest
 * in the electrochemical series, and sodium never discharges from water. An
 * inert anode discharges hydroxide, except chloride when it is concentrated.
 */
const ELECTROLYTES = {
  "copper-sulfate": {
    cathode: deposit("copper", EQUATIONS.copperDeposit),
    inertAnode: gas("oxygen", EQUATIONS.oxygen),
    ions: ["copper", "hydrogen", "sulfate", "hydroxide"],
    tint: "blue",
  },
  "silver-nitrate": {
    cathode: deposit("silver", EQUATIONS.silverDeposit),
    inertAnode: gas("oxygen", EQUATIONS.oxygen),
    ions: ["silver", "hydrogen", "nitrate", "hydroxide"],
    tint: "clear",
  },
  "sodium-chloride-concentrated": {
    cathode: gas("hydrogen", EQUATIONS.hydrogen),
    inertAnode: gas("chlorine", EQUATIONS.chlorine),
    ions: ["sodium", "hydrogen", "chloride", "hydroxide"],
    tint: "clear",
  },
  "sodium-chloride-dilute": {
    cathode: gas("hydrogen", EQUATIONS.hydrogen),
    inertAnode: gas("oxygen", EQUATIONS.oxygen),
    ions: ["sodium", "hydrogen", "chloride", "hydroxide"],
    tint: "clear",
  },
  "sulfuric-acid": {
    cathode: gas("hydrogen", EQUATIONS.hydrogen),
    inertAnode: gas("oxygen", EQUATIONS.oxygen),
    ions: ["hydrogen", "sulfate", "hydroxide"],
    tint: "clear",
  },
} satisfies Record<Electrolyte, typeof ElectrolyteDataSchema.Type>;

/** The ions an electrolyte holds, cations first. */
export function ionsOf(electrolyte: Electrolyte): readonly Ion[] {
  return ELECTROLYTES[electrolyte].ions;
}

/** Whether a solution shows a colour: copper(II) ions tint it blue. */
export function tintOf(electrolyte: Electrolyte) {
  return ELECTROLYTES[electrolyte].tint;
}

/** What the cathode of a cell does. */
export function cathodeOf(cell: Cell): Reaction {
  return ELECTROLYTES[cell.electrolyte].cathode;
}

/**
 * What the anode of a cell does. A copper or silver anode in a solution of
 * its own ions dissolves; every other anode behaves as an inert one.
 */
export function anodeOf(cell: Cell): Reaction {
  const ions = ionsOf(cell.electrolyte);
  if (cell.electrode === "copper" && Arr.contains(ions, "copper")) {
    return dissolve("copper", EQUATIONS.copperDissolves);
  }
  if (cell.electrode === "silver" && Arr.contains(ions, "silver")) {
    return dissolve("silver", EQUATIONS.silverDissolves);
  }
  return ELECTROLYTES[cell.electrolyte].inertAnode;
}

/** The ions an electrode discharges: none when the anode itself dissolves. */
export function dischargedIon(reaction: Reaction): Ion | null {
  if (reaction.change === "dissolves") {
    return null;
  }
  const ions = {
    chlorine: "chloride",
    copper: "copper",
    hydrogen: "hydrogen",
    oxygen: "hydroxide",
    silver: "silver",
  } satisfies Record<Product, Ion>;
  return ions[reaction.product];
}

/** Moles of a product made or lost when `electrons` moles of electrons pass. */
export function productMoles(reaction: Reaction, electrons: number) {
  return electrons / PRODUCTS[reaction.product].electrons;
}

/** The mass in grams of that product. */
export function productMass(reaction: Reaction, electrons: number) {
  return (
    productMoles(reaction, electrons) * PRODUCTS[reaction.product].molarMass
  );
}

/** The volume in cubic centimetres of that product as a gas, at a molar volume in cubic centimetres. */
export function gasVolume(
  reaction: Reaction,
  electrons: number,
  molarVolume: number
) {
  return productMoles(reaction, electrons) * molarVolume;
}

/**
 * How the pH of a cell moves. A dissolving anode replaces the cations the
 * cathode takes, so nothing changes. Discharging hydroxide while a metal
 * deposits leaves hydrogen ions behind, and discharging water from an acid
 * concentrates it, so the pH falls. Chlorine with hydrogen leaves hydroxide
 * ions behind, so the pH rises. Water alone from a salt leaves it steady.
 */
export function phTrend(cell: Cell): Trend {
  const anode = anodeOf(cell);
  const cathode = cathodeOf(cell);
  if (anode.change === "dissolves") {
    return "steady";
  }
  if (anode.product === "chlorine") {
    return "rises";
  }
  if (cathode.change === "deposit" || cell.electrolyte === "sulfuric-acid") {
    return "falls";
  }
  return "steady";
}

/** A metal that deposits at the cathode. */
function deposit(product: Product, equation: string): Reaction {
  return { change: "deposit", equation, product };
}

/** A gas that bubbles off an electrode. */
function gas(product: Product, equation: string): Reaction {
  return { change: "gas", equation, product };
}

/** An anode metal that goes into solution. */
function dissolve(product: Product, equation: string): Reaction {
  return { change: "dissolves", equation, product };
}
