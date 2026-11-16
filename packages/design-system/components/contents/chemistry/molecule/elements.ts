import { MATERIAL } from "@repo/design-system/lib/material";
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
  "Br",
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
 * Every element's model color, radii, and relative atomic mass. The colors are
 * the CPK convention as Jmol draws it (hydrogen white, carbon grey, oxygen red,
 * nitrogen blue, chlorine green), so a molecule or a crystal looks as it does
 * in a chemistry book's renders and in molecular software.
 */
export const ELEMENTS = {
  H: {
    color: MATERIAL.cpkHydrogen,
    covalent: 31,
    mass: 1,
    number: 1,
    radius: 120,
  },
  He: {
    color: MATERIAL.cpkHelium,
    covalent: 28,
    mass: 4,
    number: 2,
    radius: 140,
  },
  Li: {
    color: MATERIAL.cpkLithium,
    covalent: 128,
    mass: 7,
    number: 3,
    radius: 182,
  },
  C: {
    color: MATERIAL.cpkCarbon,
    covalent: 76,
    mass: 12,
    number: 6,
    radius: 170,
  },
  N: {
    color: MATERIAL.cpkNitrogen,
    covalent: 71,
    mass: 14,
    number: 7,
    radius: 155,
  },
  O: {
    color: MATERIAL.cpkOxygen,
    covalent: 66,
    mass: 16,
    number: 8,
    radius: 152,
  },
  F: {
    color: MATERIAL.cpkFluorine,
    covalent: 57,
    mass: 19,
    number: 9,
    radius: 147,
  },
  Ne: {
    color: MATERIAL.cpkNeon,
    covalent: 58,
    mass: 20,
    number: 10,
    radius: 154,
  },
  Na: {
    color: MATERIAL.cpkSodium,
    covalent: 166,
    mass: 23,
    number: 11,
    radius: 227,
  },
  Mg: {
    color: MATERIAL.cpkMagnesium,
    covalent: 141,
    mass: 24,
    number: 12,
    radius: 173,
  },
  Al: {
    color: MATERIAL.cpkAluminium,
    covalent: 121,
    mass: 27,
    number: 13,
    radius: 184,
  },
  S: {
    color: MATERIAL.cpkSulfur,
    covalent: 105,
    mass: 32,
    number: 16,
    radius: 180,
  },
  Cl: {
    color: MATERIAL.cpkChlorine,
    covalent: 102,
    mass: 35.5,
    number: 17,
    radius: 175,
  },
  Ar: {
    color: MATERIAL.cpkArgon,
    covalent: 106,
    mass: 40,
    number: 18,
    radius: 188,
  },
  K: {
    color: MATERIAL.cpkPotassium,
    covalent: 203,
    mass: 39,
    number: 19,
    radius: 275,
  },
  Ca: {
    color: MATERIAL.cpkCalcium,
    covalent: 176,
    mass: 40,
    number: 20,
    radius: 231,
  },
  Fe: {
    color: MATERIAL.cpkIron,
    covalent: 132,
    mass: 56,
    number: 26,
    radius: 204,
  },
  Cu: {
    color: MATERIAL.cpkCopper,
    covalent: 132,
    mass: 63.5,
    number: 29,
    radius: 140,
  },
  Zn: {
    color: MATERIAL.cpkZinc,
    covalent: 122,
    mass: 65,
    number: 30,
    radius: 139,
  },
  Br: {
    color: MATERIAL.cpkBromine,
    covalent: 120,
    mass: 80,
    number: 35,
    radius: 185,
  },
  Sr: {
    color: MATERIAL.cpkStrontium,
    covalent: 195,
    mass: 88,
    number: 38,
    radius: 249,
  },
  Ag: {
    color: MATERIAL.cpkSilver,
    covalent: 145,
    mass: 108,
    number: 47,
    radius: 172,
  },
  Ba: {
    color: MATERIAL.cpkBarium,
    covalent: 215,
    mass: 137,
    number: 56,
    radius: 268,
  },
} as const satisfies Record<ElementSymbol, ElementProperties>;
