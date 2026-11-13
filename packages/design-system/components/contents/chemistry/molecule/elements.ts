import { getColor } from "@repo/design-system/lib/color";
import { PLOT_COLORS } from "@repo/design-system/lib/plot";
import { Schema } from "effect";

/**
 * The elements the molecule, reaction, and crystal labs draw, by symbol, in
 * the order of their atomic numbers.
 */
export const ElementSymbolSchema = Schema.Literals([
  "H",
  "He",
  "Li",
  "C",
  "N",
  "O",
  "F",
  "Ne",
  "Na",
  "Mg",
  "Al",
  "S",
  "Cl",
  "Ar",
  "K",
  "Ca",
  "Fe",
  "Cu",
  "Zn",
  "Sr",
  "Ag",
  "Ba",
]);
export type ElementSymbol = typeof ElementSymbolSchema.Type;

const ElementPropertiesSchema = Schema.Struct({
  /** The color the element's atoms are drawn in. */
  color: Schema.String,
  /** The single-bond covalent radius in picometres (Cordero et al. 2008). */
  covalent: Schema.Finite,
  /** The relative atomic mass a school table rounds to. */
  mass: Schema.Finite,
  /** The atomic number. */
  number: Schema.Int,
  /** The van der Waals radius in picometres (Bondi 1964, Alvarez 2013). */
  radius: Schema.Finite,
});
type ElementProperties = typeof ElementPropertiesSchema.Type;

/**
 * Every element's model color, radii, and relative atomic mass. Carbon is
 * graphite and hydrogen white, as in a teaching model kit; the other elements
 * take the plot palette the chemistry labs share (oxygen teal, nitrogen
 * violet), which keeps red, green, and blue for the axes.
 */
export const ELEMENTS = {
  H: {
    color: getColor("ZINC", 100),
    covalent: 31,
    mass: 1,
    number: 1,
    radius: 120,
  },
  He: {
    color: getColor("SLATE", 200),
    covalent: 28,
    mass: 4,
    number: 2,
    radius: 140,
  },
  Li: {
    color: getColor("STONE", 600),
    covalent: 128,
    mass: 7,
    number: 3,
    radius: 182,
  },
  C: {
    color: getColor("NEUTRAL", 800),
    covalent: 76,
    mass: 12,
    number: 6,
    radius: 170,
  },
  N: {
    color: PLOT_COLORS.violet,
    covalent: 71,
    mass: 14,
    number: 7,
    radius: 155,
  },
  O: {
    color: PLOT_COLORS.teal,
    covalent: 66,
    mass: 16,
    number: 8,
    radius: 152,
  },
  F: {
    color: PLOT_COLORS.pink,
    covalent: 57,
    mass: 19,
    number: 9,
    radius: 147,
  },
  Ne: {
    color: getColor("SLATE", 300),
    covalent: 58,
    mass: 20,
    number: 10,
    radius: 154,
  },
  Na: {
    color: PLOT_COLORS.fuchsia,
    covalent: 166,
    mass: 23,
    number: 11,
    radius: 227,
  },
  Mg: {
    color: getColor("GRAY", 300),
    covalent: 141,
    mass: 24,
    number: 12,
    radius: 173,
  },
  Al: {
    color: getColor("SLATE", 400),
    covalent: 121,
    mass: 27,
    number: 13,
    radius: 184,
  },
  S: {
    color: PLOT_COLORS.amber,
    covalent: 105,
    mass: 32,
    number: 16,
    radius: 180,
  },
  Cl: {
    color: PLOT_COLORS.orange,
    covalent: 102,
    mass: 35.5,
    number: 17,
    radius: 175,
  },
  Ar: {
    color: getColor("SLATE", 400),
    covalent: 106,
    mass: 40,
    number: 18,
    radius: 188,
  },
  K: {
    color: PLOT_COLORS.pink,
    covalent: 203,
    mass: 39,
    number: 19,
    radius: 275,
  },
  Ca: {
    color: getColor("NEUTRAL", 300),
    covalent: 176,
    mass: 40,
    number: 20,
    radius: 231,
  },
  Fe: {
    color: getColor("STONE", 600),
    covalent: 132,
    mass: 56,
    number: 26,
    radius: 204,
  },
  Cu: {
    color: PLOT_COLORS.orange,
    covalent: 132,
    mass: 63.5,
    number: 29,
    radius: 140,
  },
  Zn: {
    color: getColor("SLATE", 600),
    covalent: 122,
    mass: 65,
    number: 30,
    radius: 139,
  },
  Sr: {
    color: getColor("GRAY", 300),
    covalent: 195,
    mass: 88,
    number: 38,
    radius: 249,
  },
  Ag: {
    color: getColor("SLATE", 200),
    covalent: 145,
    mass: 108,
    number: 47,
    radius: 172,
  },
  Ba: {
    color: getColor("GRAY", 700),
    covalent: 215,
    mass: 137,
    number: 56,
    radius: 268,
  },
} as const satisfies Record<ElementSymbol, ElementProperties>;
