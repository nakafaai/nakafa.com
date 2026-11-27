import { Array as Arr } from "effect";

/**
 * Slotted masses: the cast iron discs of a school set, each with a slot to
 * its middle so it slides onto the rod of a hanger. A set comes in a few
 * weights, and a load is made up from the heaviest that still fit.
 */

/** The masses of a set, heaviest first: the weight of each in newtons and how thick its disc is. */
const SET = [
  { thick: 0.11, weight: 10 },
  { thick: 0.06, weight: 5 },
  { thick: 0.03, weight: 2 },
  { thick: 0.02, weight: 1 },
] as const;

/**
 * The stack of slotted masses that makes up `load`, to the nearest newton:
 * the heaviest discs lowest, each with the height its underside rests at
 * above the hanger's plate, and the height of the whole stack. A load of
 * nothing, or less, is an empty hanger.
 */
export function slottedStack(load: number) {
  const stack = Arr.reduce(
    SET,
    {
      height: 0,
      left: Math.max(0, Math.round(load)),
      masses: Arr.empty<{
        readonly base: number;
        readonly thick: number;
        readonly weight: number;
      }>(),
    },
    (under, mass) => {
      const count = Math.floor(under.left / mass.weight);
      const added = Arr.filter(
        Arr.makeBy(count, (index) => ({
          base: under.height + index * mass.thick,
          thick: mass.thick,
          weight: mass.weight,
        })),
        (_, index) => index < count
      );
      return {
        height: under.height + count * mass.thick,
        left: under.left - count * mass.weight,
        masses: [...under.masses, ...added],
      };
    }
  );
  return { height: stack.height, masses: stack.masses };
}
