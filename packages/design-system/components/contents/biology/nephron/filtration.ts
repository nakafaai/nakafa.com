import { Schema } from "effect";

/** The solutes a nephron lab follows: glucose, which the tubule takes back, and urea, which it leaves in. */
const SoluteSchema = Schema.Literals(["glucose", "urea"]);
export type Solute = typeof SoluteSchema.Type;

/**
 * The glucose side of the lab: the most glucose the tubules can reabsorb, in
 * milligrams a minute, and the plasma concentration the lab opens at, in
 * milligrams per cubic centimetre.
 */
const GlucoseSchema = Schema.Struct({
  maximum: Schema.Finite,
  plasma: Schema.Finite,
});
export type Glucose = typeof GlucoseSchema.Type;

/**
 * The urea side of the lab: its concentration in the plasma and in the urine,
 * each in grams per 100 cubic centimetres.
 */
const UreaSchema = Schema.Struct({
  plasma: Schema.Finite,
  urine: Schema.Finite,
});
export type Urea = typeof UreaSchema.Type;

/** Minutes in a day. */
const DAY = 24 * 60;

/** The glucose filtered into the capsules a minute, in milligrams: filtrate keeps the plasma's concentration. */
export function filteredLoad(filtration: number, plasma: number) {
  return filtration * plasma;
}

/** The glucose the tubules take back a minute: all of it, up to their maximum. */
export function reabsorbed(load: number, maximum: number) {
  return Math.min(load, maximum);
}

/** The glucose left in the urine a minute: whatever the tubules cannot take back. */
export function excreted(load: number, maximum: number) {
  return Math.max(0, load - maximum);
}

/**
 * The renal threshold: the plasma concentration at which the filtered load
 * first equals the tubules' maximum, so glucose starts to reach the urine.
 */
export function threshold(maximum: number, filtration: number) {
  return maximum / filtration;
}

/**
 * The urine made a minute, in cubic centimetres. Urea is filtered freely and
 * neither reabsorbed nor secreted, so every gram filtered leaves in the
 * urine: filtration × plasma = urine flow × urine concentration.
 */
export function urineFlow(filtration: number, urea: Urea) {
  return (filtration * urea.plasma) / urea.urine;
}

/** How many times more concentrated the urine is than the plasma. */
export function concentrationFactor(urea: Urea) {
  return urea.urine / urea.plasma;
}

/** A flow in cubic centimetres a minute, as cubic decimetres a day. */
export function perDay(flow: number) {
  return (flow * DAY) / 1000;
}
