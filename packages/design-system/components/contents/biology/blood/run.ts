import { Array as Arr } from "effect";

/**
 * The test as the card plays it, in seconds after Play. The hands work at
 * their own pace: one drop of each serum into the three cavities of the row,
 * one drop of blood into each, and a clean stick to mix each cavity, as the
 * slide method prescribes. Each list holds the times a tool reaches the
 * points of its route.
 *
 * @see J. Mitra & Co., "Combined ABD Monoclonal Antibodies" instructions for
 * use, slide method: a drop of anti-A, anti-B and anti-D, a drop of whole
 * blood to each, mixed with sticks, rocked, read within one minute,
 * https://jmitra.co.in/wp-content/uploads/2026/06/Manual-Combine-ABD-1.pdf
 */
export const STEPS = {
  /**
   * Each serum's dropper: drawn up out of its vial, carried over its cavity,
   * held while a drop forms and falls, raised, and put back.
   */
  droppers: [
    [0.3, 0.6, 1, 1.5, 1.85, 2.15],
    [1.6, 1.9, 2.3, 2.8, 3.15, 3.45],
    [2.9, 3.2, 3.6, 4.1, 4.45, 4.75],
  ],
  /** The blood pipette: drawn out of the tube, held over each cavity in turn, raised, and put back. */
  pipette: [4.6, 4.95, 5.4, 5.8, 6.2, 6.6, 7, 7.4, 7.8, 8.15],
  /** Each mixing stick: picked up, put in its cavity, stirring, lifted out, and laid down used. */
  stirrers: [
    [8.3, 8.8, 10, 10.3, 10.7],
    [9.8, 10.3, 11.5, 11.8, 12.2],
    [11.3, 11.8, 13, 13.3, 13.7],
  ],
} as const;

/** When each dropper lets its drop go: halfway through its hold over the cavity. */
export const SERUM_RELEASES = Arr.map(
  STEPS.droppers,
  (keys) => (keys[2] + keys[3]) / 2
);

/** When the pipette lets a drop of blood go over each cavity: halfway through each hold. */
export const BLOOD_RELEASES = [
  (STEPS.pipette[2] + STEPS.pipette[3]) / 2,
  (STEPS.pipette[4] + STEPS.pipette[5]) / 2,
  (STEPS.pipette[6] + STEPS.pipette[7]) / 2,
] as const;

/** When every tool is back on the bench and the cards only wait for the reaction. */
const HANDLED = STEPS.stirrers[2][4];

/**
 * How many seconds of the reaction pass in one second of the card once the
 * hands are done, so the minute the inserts wait before reading passes in
 * ten seconds.
 */
const PACE = 6;

/**
 * How long after mixing a slide test is read, in seconds.
 *
 * @see Rapid Biotec, "Monoclonal Blood Grouping Reagents" instructions for use
 * (Doc Ref CE ABO RB 04/2024), slide method: "Read macroscopically after 1
 * minute."
 */
export const READING = 60;

/**
 * The time constant of agglutination on the tile, in seconds: monoclonal IgM
 * antisera clump cells carrying the antigen within seconds, and the inserts
 * read after a minute, by which time the clumps have long finished forming.
 * With 12 s the clumps are 99 % formed at the reading.
 */
const CLUMPING = 12;

/** Standard gravity, in metres per second squared, for a falling drop. */
const GRAVITY = 9.806_65;

/** The seconds of the lab's own clock at `time` seconds of the card: real until the hands are done, then quickened. */
function labSeconds(time: number) {
  return time <= HANDLED ? time : HANDLED + (time - HANDLED) * PACE;
}

/** When each cavity's stick stops stirring, so its reaction starts. */
const MIXED = [
  STEPS.stirrers[0][2],
  STEPS.stirrers[1][2],
  STEPS.stirrers[2][2],
] as const;

/** The card time at which the last cavity has stood a full minute, so the test reads. */
export const FINISH =
  HANDLED + (labSeconds(MIXED[2]) + READING - HANDLED) / PACE;

/** How long the card holds the read tile before the run starts again. */
export const LOOP = FINISH + 4;

/** Clamps a share to 0 to 1. */
function share(value: number) {
  return Math.min(1, Math.max(0, value));
}

/** Eases a share in and out, so a hand starts and stops gently. */
function ease(value: number) {
  return value * value * (3 - 2 * value);
}

/**
 * Where a tool is along its route at `time`: the index of the last point it
 * reached plus how far, eased, it has come towards the next. Before the
 * first key it rests at point 0, after the last at the final point.
 */
export function routeAt(time: number, keys: readonly number[]) {
  const passed = Arr.reduce(keys, 0, (count, key) =>
    time >= key ? count + 1 : count
  );
  if (passed === 0) {
    return 0;
  }
  if (passed >= keys.length) {
    return keys.length - 1;
  }
  const from = keys[passed - 1];
  const to = keys[passed];
  return passed - 1 + ease(share((time - from) / (to - from)));
}

/** How far a drop has fallen `seconds` after it left a tip, in metres. */
export function fallen(seconds: number) {
  return 0.5 * GRAVITY * seconds ** 2;
}

/** How long a drop takes to fall `height` metres, in seconds. */
export function fallTime(height: number) {
  return Math.sqrt((2 * height) / GRAVITY);
}

/**
 * How far a drop that landed at `landed` has spread into its pool at
 * `time`, from 0 to 1: a drop on wet glaze settles within about a tenth of a
 * second.
 */
export function spreadAt(time: number, landed: number) {
  return time < landed ? 0 : 1 - Math.exp(-(time - landed) / 0.03);
}

/** How far the stick of cavity `index` has stirred its blood through the serum at `time`, from 0 to 1. */
export function mixAt(time: number, index: number) {
  const [, start, end] = STEPS.stirrers[index];
  return share((time - start) / (end - start));
}

/**
 * How far agglutination has gone in cavity `index` at `time`, from 0 to 1:
 * nothing before the stirring stops, then rising towards completion with
 * the reaction's time constant on the lab's clock.
 */
export function clumpingAt(time: number, index: number) {
  const seconds = labSeconds(time) - labSeconds(MIXED[index]);
  return seconds <= 0 ? 0 : 1 - Math.exp(-seconds / CLUMPING);
}

/** The reading clock at `time`: seconds since the last cavity was mixed, up to the minute the test is read at. */
export function readingAt(time: number) {
  return Math.min(
    READING,
    Math.max(0, labSeconds(time) - labSeconds(MIXED[2]))
  );
}
