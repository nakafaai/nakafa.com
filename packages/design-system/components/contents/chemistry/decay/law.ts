import { halton } from "@repo/design-system/components/contents/chemistry/orbital/wave";
import { Array as Arr, Order } from "effect";

/** The half-life of carbon-14 in years (Godwin 1962, the Cambridge value). */
export const CARBON_HALF_LIFE = 5730;

/**
 * When each of `count` nuclei decays, in the units of `halfLife`: the decay
 * law makes a nucleus survive to time t with probability (1/2)^(t / T), so a
 * share u of the way through that probability gives t = -T log2(1 - u). The
 * shares come from a Halton sequence, which spreads them evenly, so the count
 * that survives follows the law closely on every device.
 */
export function decayTimes(count: number, halfLife: number) {
  return Arr.map(Arr.range(1, count), (index) => {
    const share = halton(index, 2);
    return -halfLife * Math.log2(1 - share);
  });
}

/** How many nuclei have not decayed by `time`. */
export function survivors(times: readonly number[], time: number) {
  return Arr.filter(times, (decay) => decay > time).length;
}

/** How many the decay law expects to survive: N0 (1/2)^(t / T). */
export function expectedSurvivors(
  count: number,
  time: number,
  halfLife: number
) {
  return count * 0.5 ** (time / halfLife);
}

/** The golden ratio's fractional part, whose multiples spread most evenly over a circle. */
const GOLDEN = (Math.sqrt(5) - 1) / 2;

/**
 * The order the sites of a sample receive the decay times in: sites sorted by
 * the fractional part of their index times the golden ratio. Neighbouring
 * decay times then land far apart, so the decayed nuclei scatter across the
 * sample the way a real one looks, with no rows or stripes.
 */
export function scatterSites(count: number) {
  return Arr.sort(
    Arr.range(0, count - 1),
    Order.mapInput(Order.Number, (site: number) => (site * GOLDEN) % 1)
  );
}
