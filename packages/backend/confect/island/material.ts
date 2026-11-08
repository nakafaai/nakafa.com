import { Record, Schema } from "effect";

/**
 * An amount of every building material: what a harvest gives and what some
 * stages cost besides Stars (ADR 0042, D13). Materials are never Stars, so
 * learning stays the only source of the currency.
 */
export const Materials = Schema.Struct({
  petals: Schema.Int,
  wood: Schema.Int,
});
export type Materials = typeof Materials.Type;

/** No material at all, what an island holds before its first harvest. */
export const NO_MATERIALS: Materials = { petals: 0, wood: 0 };

/** Two amounts together. */
export function addMaterials(left: Materials, right: Materials): Materials {
  return Record.map(left, (amount, material) => amount + right[material]);
}

/** What is left of `left` after `right` is taken from it. */
export function lessMaterials(left: Materials, right: Materials): Materials {
  return Record.map(left, (amount, material) => amount - right[material]);
}

/** Whether `held` holds at least `needed` of every material. */
export function coversMaterials(held: Materials, needed: Materials) {
  return Record.every(needed, (amount, material) => held[material] >= amount);
}
