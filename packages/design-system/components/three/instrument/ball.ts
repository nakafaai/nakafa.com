import { Array as Arr } from "effect";

/**
 * The outline of a pendulum bob: a turned ball with the eyelet stud its
 * thread is tied to. The author names the ball's radius and gets the outline
 * a lathe would cut, from the bottom of the ball up to the top of the stud,
 * as the radius and the height of each point from the ball's middle.
 */

/** The stud, in scene units: how wide its shoulder and its neck are, and how far each stands over its seat on the ball. */
const STUD = {
  neck: 0.016,
  rise: 0.062,
  shoulder: 0.028,
  wide: 0.034,
} as const;

/** How many chords the ball's outline is drawn with, from its bottom to the stud. */
const CHORDS = 16;

/** How high over the ball's middle the stud sits on it. */
function seatOf(radius: number) {
  return Math.sqrt(radius ** 2 - STUD.wide ** 2);
}

/**
 * How high the top of the stud stands over the middle of a ball of one
 * radius: where the thread ends.
 *
 * @param radius - The ball's radius, in scene units
 */
export function studTop(radius: number) {
  return seatOf(radius) + STUD.rise;
}

/**
 * The outline of a ball of one radius with its stud, from the bottom up, as
 * the radius and the height of each point from the ball's middle. It closes
 * on the axis at both ends.
 *
 * @param radius - The ball's radius, in scene units
 */
export function ballOutline(radius: number) {
  const seat = seatOf(radius);
  const cut = Math.asin(STUD.wide / radius);
  const ball = Arr.makeBy(CHORDS, (step) => {
    const angle = Math.PI - ((step + 1) / CHORDS) * (Math.PI - cut);
    return [radius * Math.sin(angle), radius * Math.cos(angle)] as const;
  });
  return [
    [0, -radius],
    ...ball,
    [STUD.wide, seat + STUD.shoulder],
    [STUD.neck, seat + STUD.shoulder + 0.004],
    [STUD.neck, seat + STUD.rise],
    [0, seat + STUD.rise],
  ] as const;
}
