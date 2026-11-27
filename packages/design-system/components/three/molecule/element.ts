import { ATOM_COLORS } from "@repo/design-system/lib/material/atom";
import { Schema } from "effect";

/** The elements a molecular model can be built from. */
export const ElementSchema = Schema.Literals(["C", "H", "N", "O", "P", "S"]);
export type Element = typeof ElementSchema.Type;

/**
 * What a model needs to know of each element, in angstrom: its van der Waals
 * radius (Bondi 1964), which a space-filling model draws in full, the length
 * of its bond to hydrogen, how many bonds it makes, and its CPK colour.
 */
export const ELEMENTS = {
  C: { bonds: 4, color: ATOM_COLORS.cpkCarbon, hydrogen: 1.09, reach: 1.7 },
  H: { bonds: 1, color: ATOM_COLORS.cpkHydrogen, hydrogen: 0.74, reach: 1.1 },
  N: { bonds: 3, color: ATOM_COLORS.cpkNitrogen, hydrogen: 1.01, reach: 1.55 },
  O: { bonds: 2, color: ATOM_COLORS.cpkOxygen, hydrogen: 0.96, reach: 1.52 },
  P: { bonds: 5, color: ATOM_COLORS.cpkPhosphorus, hydrogen: 1.42, reach: 1.8 },
  S: { bonds: 2, color: ATOM_COLORS.cpkSulfur, hydrogen: 1.34, reach: 1.8 },
} as const satisfies Record<
  Element,
  Readonly<Record<"bonds" | "hydrogen" | "reach", number>> &
    Readonly<Record<"color", string>>
>;
