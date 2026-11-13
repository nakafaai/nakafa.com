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
  /** The color of a physical molecular model kit, as chemists read it. */
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
export type ElementProperties = typeof ElementPropertiesSchema.Type;

/**
 * Every element's model color, radii, and relative atomic mass. Carbon is
 * graphite black and hydrogen white, as in a teaching model kit, so a
 * molecule reads like the real model a teacher holds up.
 */
export const ELEMENTS = {
  H: {
    color: "#eef0f2",
    covalent: 31,
    mass: 1,
    number: 1,
    radius: 120,
  },
  He: {
    color: "#c7eef2",
    covalent: 28,
    mass: 4,
    number: 2,
    radius: 140,
  },
  Li: {
    color: "#b07fd9",
    covalent: 128,
    mass: 7,
    number: 3,
    radius: 182,
  },
  C: {
    color: "#2f3236",
    covalent: 76,
    mass: 12,
    number: 6,
    radius: 170,
  },
  N: {
    color: "#2f5bd8",
    covalent: 71,
    mass: 14,
    number: 7,
    radius: 155,
  },
  O: {
    color: "#d8312c",
    covalent: 66,
    mass: 16,
    number: 8,
    radius: 152,
  },
  F: {
    color: "#8fcf5a",
    covalent: 57,
    mass: 19,
    number: 9,
    radius: 147,
  },
  Ne: {
    color: "#a9d8ea",
    covalent: 58,
    mass: 20,
    number: 10,
    radius: 154,
  },
  Na: {
    color: "#8c5bd0",
    covalent: 166,
    mass: 23,
    number: 11,
    radius: 227,
  },
  Mg: {
    color: "#6bbf3a",
    covalent: 141,
    mass: 24,
    number: 12,
    radius: 173,
  },
  Al: {
    color: "#b8a9a9",
    covalent: 121,
    mass: 27,
    number: 13,
    radius: 184,
  },
  S: {
    color: "#e8c22e",
    covalent: 105,
    mass: 32,
    number: 16,
    radius: 180,
  },
  Cl: {
    color: "#35b866",
    covalent: 102,
    mass: 35.5,
    number: 17,
    radius: 175,
  },
  Ar: {
    color: "#7fc4d6",
    covalent: 106,
    mass: 40,
    number: 18,
    radius: 188,
  },
  K: {
    color: "#7d3fc4",
    covalent: 203,
    mass: 39,
    number: 19,
    radius: 275,
  },
  Ca: {
    color: "#4fb83a",
    covalent: 176,
    mass: 40,
    number: 20,
    radius: 231,
  },
  Fe: {
    color: "#c96a3a",
    covalent: 132,
    mass: 56,
    number: 26,
    radius: 204,
  },
  Cu: {
    color: "#c47a3c",
    covalent: 132,
    mass: 63.5,
    number: 29,
    radius: 140,
  },
  Zn: {
    color: "#8c90b4",
    covalent: 122,
    mass: 65,
    number: 30,
    radius: 139,
  },
  Sr: {
    color: "#3fae3a",
    covalent: 195,
    mass: 88,
    number: 38,
    radius: 249,
  },
  Ag: {
    color: "#c4c7cc",
    covalent: 145,
    mass: 108,
    number: 47,
    radius: 172,
  },
  Ba: {
    color: "#2fa64a",
    covalent: 215,
    mass: 137,
    number: 56,
    radius: 268,
  },
} as const satisfies Record<ElementSymbol, ElementProperties>;
