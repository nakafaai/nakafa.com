import type {
  Energy,
  GasProcess,
} from "@repo/design-system/components/contents/physics/thermodynamics/gas-process/gas";

/**
 * How the lab writes the energy of a process: each bar's sign and length on
 * the lab's one scale, the rule each process keeps, and the first law with
 * the numbers in, as KaTeX that reads the same in every language.
 */

/** How small an energy is, against the lab's largest, to count as none: what float error leaves of a zero. */
const NONE = 1e-9;

/** Whether an energy is positive, negative or none, on the lab's scale. */
export function signOf(value: number, scale: number) {
  if (Math.abs(value) <= scale * NONE) {
    return 0;
  }
  return value > 0 ? 1 : -1;
}

/** How far a bar reaches from the zero line, 0 to 1 of its half, for an energy on the lab's scale. */
export function barShare(value: number, scale: number) {
  return signOf(value, scale) === 0 ? 0 : Math.min(1, Math.abs(value) / scale);
}

/**
 * The rule each process keeps, as the textbook writes it: first the quantity
 * the process holds fixed, then what that means for the energies. Each of
 * two results is one group, the comma and its space ending the first, so a
 * narrow footer wraps between them and never inside one.
 */
export const PROCESS_LAW: Readonly<Record<GasProcess, string>> = {
  adiabatic:
    "Q = 0 \\;\\Rightarrow\\; {\\Delta U = -W,\\quad}\\allowbreak{p_1V_1^{\\gamma} = p_2V_2^{\\gamma}}",
  isobaric: "p_1 = p_2 \\;\\Rightarrow\\; W = p\\,(V_2 - V_1)",
  isochoric:
    "V_1 = V_2 \\;\\Rightarrow\\; {W = 0,\\quad}\\allowbreak{\\Delta U = Q}",
  isothermal:
    "T_1 = T_2 \\;\\Rightarrow\\; {\\Delta U = 0,\\quad}\\allowbreak{Q = W = nRT\\ln\\frac{V_2}{V_1}}",
};

/** One energy as a sign alone, such as Q > 0, for a card that keeps its numbers for the learner. */
export function signTex(symbol: string, value: number, scale: number) {
  const sign = signOf(value, scale);
  if (sign === 0) {
    return `${symbol} = 0`;
  }
  return `${symbol} ${sign > 0 ? ">" : "<"} 0`;
}

/** One energy with its number, such as Q = +415,7 J, the number already written in the reader's locale by `number`, a zero without a sign. */
export function valueTex(
  symbol: string,
  value: number,
  scale: number,
  number: (value: number) => string
) {
  return `${symbol} = ${number(signOf(value, scale) === 0 ? 0 : value)}\\text{ J}`;
}

/**
 * The first law with the numbers in: ΔU = Q − W = q − w = u J, each
 * number already written in the reader's locale by `number`, a negative
 * one in brackets where it is taken away.
 */
export function firstLawTex(
  energy: Energy,
  scale: number,
  number: (value: number) => string
) {
  const written = (value: number) =>
    number(signOf(value, scale) === 0 ? 0 : value);
  const work =
    signOf(energy.work, scale) < 0
      ? `(${written(energy.work)})`
      : written(energy.work);
  return `\\Delta U = Q - W = ${written(energy.heat)} - ${work} = ${written(energy.internal)}\\text{ J}`;
}
