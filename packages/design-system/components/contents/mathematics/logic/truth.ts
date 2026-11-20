import { Schema } from "effect";

/**
 * The compound statements the circuit board wires. In "and" the switches for
 * p and q stand in series, so the lamp lights only when both are closed; in
 * "or" they stand side by side, so either one lights it; in "not" the switch
 * for p lies across the lamp, so closing it shorts the lamp and puts it out.
 */
export const LogicModeSchema = Schema.Literals(["and", "or", "not"]);
export type LogicMode = typeof LogicModeSchema.Type;

/** One case of the truth table: whether p is true and whether q is true. */
export const CaseSchema = Schema.Struct({
  p: Schema.Boolean,
  q: Schema.Boolean,
});
export type Case = typeof CaseSchema.Type;

/** Whether the compound reads q at all: not p reads p alone. */
export function usesQ(mode: LogicMode) {
  return mode !== "not";
}

/** The four cases of two statements, true before false, p changing slowest. */
const PAIRS: readonly Case[] = [
  { p: true, q: true },
  { p: true, q: false },
  { p: false, q: true },
  { p: false, q: false },
];

/** The two cases of one statement; q stays false, since not p never reads it. */
const SINGLES: readonly Case[] = [
  { p: true, q: false },
  { p: false, q: false },
];

/** The rows of the compound's truth table, in the order a textbook writes them. */
export function casesOf(mode: LogicMode) {
  return usesQ(mode) ? PAIRS : SINGLES;
}

/** The truth of the compound in one case, which is whether the lamp lights. */
export function truthOf(mode: LogicMode, { p, q }: Case) {
  if (mode === "and") {
    return p && q;
  }
  if (mode === "or") {
    return p || q;
  }
  return !p;
}

/**
 * The row of the truth table that one case fills: with true written before
 * false, p picks the half of the table and q the row within it. Not p reads
 * p alone.
 */
export function rowOf(mode: LogicMode, { p, q }: Case) {
  const half = p ? 0 : 1;
  if (!usesQ(mode)) {
    return half;
  }
  return half * 2 + (q ? 0 : 1);
}
