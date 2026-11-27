import { ATOM_COLORS } from "@repo/design-system/lib/material/atom";
import { Schema } from "effect";

/** The elements a molecular model can be built from. */
export const ElementSchema = Schema.Literals([
  "B",
  "Br",
  "C",
  "Ca",
  "Cl",
  "F",
  "Fe",
  "H",
  "I",
  "K",
  "Mg",
  "N",
  "Na",
  "O",
  "P",
  "S",
  "Si",
  "Zn",
]);
export type Element = typeof ElementSchema.Type;

/**
 * What a model needs to know of each element, in angstrom. `reach` is its
 * van der Waals radius, which a space-filling model draws in full: Bondi 1964
 * for the main group, Mantina 2009 for hydrogen, boron and calcium, which
 * Bondi leaves out or overstates, and Batsanov 2001 for iron and zinc.
 * `covalent` is its single-bond covalent radius (Cordero 2008, carbon as sp3
 * and iron as low spin), so two bonded atoms stand the sum of theirs apart.
 * `hydrogen` is the length of its bond to hydrogen, and `bonds` how many
 * covalent bonds a model fills it to with hydrogens: none for a metal, which
 * a model holds as an ion or by the bonds its author writes. `color` is its
 * CPK colour.
 */
export const ELEMENTS = {
  B: {
    bonds: 3,
    color: ATOM_COLORS.cpkBoron,
    covalent: 0.84,
    hydrogen: 1.19,
    reach: 1.92,
  },
  Br: {
    bonds: 1,
    color: ATOM_COLORS.cpkBromine,
    covalent: 1.2,
    hydrogen: 1.41,
    reach: 1.85,
  },
  C: {
    bonds: 4,
    color: ATOM_COLORS.cpkCarbon,
    covalent: 0.76,
    hydrogen: 1.09,
    reach: 1.7,
  },
  Ca: {
    bonds: 0,
    color: ATOM_COLORS.cpkCalcium,
    covalent: 1.76,
    hydrogen: 2.0,
    reach: 2.31,
  },
  Cl: {
    bonds: 1,
    color: ATOM_COLORS.cpkChlorine,
    covalent: 1.02,
    hydrogen: 1.27,
    reach: 1.75,
  },
  F: {
    bonds: 1,
    color: ATOM_COLORS.cpkFluorine,
    covalent: 0.57,
    hydrogen: 0.92,
    reach: 1.47,
  },
  Fe: {
    bonds: 0,
    color: ATOM_COLORS.cpkIron,
    covalent: 1.32,
    hydrogen: 1.59,
    reach: 2.05,
  },
  H: {
    bonds: 1,
    color: ATOM_COLORS.cpkHydrogen,
    covalent: 0.31,
    hydrogen: 0.74,
    reach: 1.1,
  },
  I: {
    bonds: 1,
    color: ATOM_COLORS.cpkIodine,
    covalent: 1.39,
    hydrogen: 1.61,
    reach: 1.98,
  },
  K: {
    bonds: 0,
    color: ATOM_COLORS.cpkPotassium,
    covalent: 2.03,
    hydrogen: 2.24,
    reach: 2.75,
  },
  Mg: {
    bonds: 0,
    color: ATOM_COLORS.cpkMagnesium,
    covalent: 1.41,
    hydrogen: 1.73,
    reach: 1.73,
  },
  N: {
    bonds: 3,
    color: ATOM_COLORS.cpkNitrogen,
    covalent: 0.71,
    hydrogen: 1.01,
    reach: 1.55,
  },
  Na: {
    bonds: 0,
    color: ATOM_COLORS.cpkSodium,
    covalent: 1.66,
    hydrogen: 1.89,
    reach: 2.27,
  },
  O: {
    bonds: 2,
    color: ATOM_COLORS.cpkOxygen,
    covalent: 0.66,
    hydrogen: 0.96,
    reach: 1.52,
  },
  P: {
    bonds: 5,
    color: ATOM_COLORS.cpkPhosphorus,
    covalent: 1.07,
    hydrogen: 1.42,
    reach: 1.8,
  },
  S: {
    bonds: 2,
    color: ATOM_COLORS.cpkSulfur,
    covalent: 1.05,
    hydrogen: 1.34,
    reach: 1.8,
  },
  Si: {
    bonds: 4,
    color: ATOM_COLORS.cpkSilicon,
    covalent: 1.11,
    hydrogen: 1.48,
    reach: 2.1,
  },
  Zn: {
    bonds: 0,
    color: ATOM_COLORS.cpkZinc,
    covalent: 1.22,
    hydrogen: 1.6,
    reach: 2.1,
  },
} as const satisfies Record<
  Element,
  Readonly<Record<"bonds" | "covalent" | "hydrogen" | "reach", number>> &
    Readonly<Record<"color", string>>
>;
