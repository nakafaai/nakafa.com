import { Schema } from "effect";

/**
 * An amount of every building material: what a harvest gives and what some
 * stages cost besides Stars (ADR 0042, D13). Materials are never Stars, so
 * learning stays the only source of the currency.
 */
export const Materials = Schema.Struct({
  petals: Schema.Int,
  wood: Schema.Int,
});

/** No material at all, what an island holds before its first harvest. */
export const NO_MATERIALS: typeof Materials.Type = { petals: 0, wood: 0 };
