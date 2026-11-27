import { Array as Arr, Option } from "effect";

/**
 * The mass number of the most abundant natural isotope of each element from
 * hydrogen (1) to krypton (36), in order of atomic number (IUPAC isotopic
 * compositions of the elements, 2013).
 */
const COMMON = [
  1, 4, 7, 9, 11, 12, 14, 16, 19, 20, 23, 24, 27, 28, 31, 32, 35, 40, 39, 40,
  45, 48, 51, 52, 55, 56, 59, 58, 63, 64, 69, 74, 75, 80, 79, 84,
] as const;

/**
 * How many neutrons the most abundant isotope of the element with
 * `protons` protons has. Past krypton, where the table ends, it answers
 * the stable trend of about one and a half neutrons to a proton.
 */
export function neutronsOf(protons: number) {
  return Option.match(Arr.get(COMMON, protons - 1), {
    onNone: () => Math.max(0, Math.round(protons * 1.5)),
    onSome: (mass) => mass - protons,
  });
}
