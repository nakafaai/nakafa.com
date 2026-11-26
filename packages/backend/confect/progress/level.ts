/** The lifetime Stars from level 1 to level 2. */
const FIRST_STEP = 100;
/** How many more Stars each next level asks for than the one before it. */
const STEP_GROWTH = 50;
/**
 * How many times the step grows before it stays the same for good: from then
 * on every level asks for 1,000 Stars, about a week at the day's 150, so a
 * learner of any age on Nakafa still sees the next level come.
 */
const GROWING_STEPS = 18;

/**
 * The lifetime Stars that open a level. Levels never end: the step to the next
 * one grows by 50 Stars a level, eighteen times, and then stays at 1,000 Stars.
 */
export function opensAt(level: number) {
  const steps = level - 1;
  const growing = Math.min(steps, GROWING_STEPS);
  return (
    FIRST_STEP * steps +
    STEP_GROWTH *
      ((growing * (growing - 1)) / 2 + (steps - growing) * GROWING_STEPS)
  );
}

/** The level these lifetime Stars reach, counted up from the one given. */
function reached(lifetime: number, level: number): number {
  return opensAt(level + 1) <= lifetime ? reached(lifetime, level + 1) : level;
}

/** The first level whose step no longer grows, and the Stars of every step from it on. */
const STEADY_LEVEL = GROWING_STEPS + 1;
const STEADY_STEP = FIRST_STEP + STEP_GROWTH * GROWING_STEPS;

/**
 * How far a learner has grown with these lifetime Stars: their level from 1,
 * the lifetime Stars that opened it, and those that open the next one.
 */
export function growthOf(lifetime: number) {
  const steady = opensAt(STEADY_LEVEL);
  const level =
    lifetime < steady
      ? reached(lifetime, 1)
      : STEADY_LEVEL + Math.floor((lifetime - steady) / STEADY_STEP);
  return {
    from: opensAt(level),
    level,
    next: opensAt(level + 1),
  };
}
