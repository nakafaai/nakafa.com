import { seededUniforms } from "@repo/design-system/components/contents/mathematics/chance";
import type { BoardPoint } from "@repo/design-system/components/contents/mathematics/galton/board";
import {
  BALL_RADIUS,
  binCentre,
  contactPoint,
  MAX_ROWS,
  NECK,
  PITCH,
  ROW_GAP,
  stackPoint,
} from "@repo/design-system/components/contents/mathematics/galton/board";
import { Array as Arr, Option, Schema } from "effect";

/**
 * One run of the board: a hopper of balls let go one after another, each
 * bouncing right with probability p at every row of pins, and where and
 * when each comes to rest. The bounces come from a seeded stream, so every
 * learner sees the same run, and a ball keeps its bounces when the board
 * changes size or bias, as far as its rows go.
 */

/** How many balls the hopper holds. */
export const BALLS = 300;

/** The stream every run draws its bounces from. */
const SEED = 18_771_009;

/** The seconds a ball takes from one pin to the next: slow motion, so the eye can follow a bounce. */
export const HOP = 0.13;

/** How high a ball rises off a pin, as a share of the drop to the next row. */
const BOUNCE = 0.2;

/**
 * The gravity of the slow motion. A hop is a projectile that leaves the top
 * of one pin and lands on top of the next, half a pitch across and one row
 * down, in `HOP` seconds; every fall in the run keeps this same gravity.
 */
export const SLOW_GRAVITY = (2 * (1 + BOUNCE) * ROW_GAP) / HOP ** 2;

/** When the first ball leaves the hopper, the gap before the second, how fast the gaps shrink, and the smallest gap. */
const FIRST_RELEASE = 0.3;
const FIRST_GAP = 1.3;
const GAP_SHRINK = 0.8;

/** Half a hop between balls keeps two balls that meet at one pin more than a ball apart. */
const LEAST_GAP = HOP / 2;

/** Where a let-go ball starts: resting in the hopper's outlet. */
const OUTLET: BoardPoint = { x: 0, y: NECK + BALL_RADIUS };

/** One ball of a run: when it leaves the hopper, its bounces, its bin and where and when it comes to rest. */
const BallPlanSchema = Schema.Struct({
  bin: Schema.Int,
  land: Schema.Finite,
  release: Schema.Finite,
  rest: Schema.Struct({ x: Schema.Finite, y: Schema.Finite }),
  rights: Schema.Array(Schema.Boolean),
});
type BallPlan = typeof BallPlanSchema.Type;

/** When each ball leaves the hopper: slowly at first, then faster until half a hop apart. */
export function releaseTimes(count: number) {
  return Arr.scan(
    Arr.makeBy(count - 1, (index) =>
      Math.max(LEAST_GAP, FIRST_GAP * GAP_SHRINK ** index)
    ),
    FIRST_RELEASE,
    (time, gap) => time + gap
  );
}

/** The seconds a ball falls from rest in the outlet onto the first pin. */
const OUTLET_FALL = Math.sqrt(
  (2 * (OUTLET.y - contactPoint(0, 0).y)) / SLOW_GRAVITY
);

/** The speed a ball falls at as it leaves its last hop, downward. */
const HOP_END_SPEED = ((2 + BOUNCE) * ROW_GAP) / HOP;

/** The seconds a ball takes to fall `drop` metres from the speed it leaves its last hop with. */
function fallTime(drop: number) {
  return (
    (Math.sqrt(HOP_END_SPEED ** 2 + 2 * SLOW_GRAVITY * Math.max(drop, 0)) -
      HOP_END_SPEED) /
    SLOW_GRAVITY
  );
}

/** Where a ball is `elapsed` seconds into the hop from `from`, half a pitch toward `side`. */
function hopAt(from: BoardPoint, side: number, elapsed: number): BoardPoint {
  const share = elapsed / HOP;
  return {
    x: from.x + (side * PITCH * share) / 2,
    y: from.y + ROW_GAP * (BOUNCE * share - (1 + BOUNCE) * share * share),
  };
}

/** The bounces, bins, resting places and landing times of every ball of a board with `rows` rows and bias `p`. */
export function planRun(rows: number, p: number): readonly BallPlan[] {
  const draws = seededUniforms(SEED, BALLS * MAX_ROWS);
  const releases = releaseTimes(BALLS);
  const travel = OUTLET_FALL + rows * HOP;
  const bounces = Arr.makeBy(BALLS, (ball) =>
    Arr.makeBy(rows, (row) => Arr.getUnsafe(draws, ball * MAX_ROWS + row) < p)
  );
  const bins = Arr.map(bounces, (rights) =>
    Arr.reduce(rights, 0, (sum, right) => sum + (right ? 1 : 0))
  );
  return Arr.map(bounces, (rights, ball) => {
    const release = Arr.getUnsafe(releases, ball);
    const bin = Arr.getUnsafe(bins, ball);
    const order = Arr.filter(
      Arr.take(bins, ball),
      (each) => each === bin
    ).length;
    const rest = stackPoint(rows, bin, order);
    const drop = contactPoint(rows - 1, 0).y - ROW_GAP - rest.y;
    return {
      bin,
      land: release + travel + fallTime(drop),
      release,
      rest,
      rights,
    };
  });
}

/** Where a ball of a board with `rows` rows is at `time`, or none before it leaves the hopper. */
export function ballAt(plan: BallPlan, rows: number, time: number) {
  const elapsed = time - plan.release;
  if (elapsed < 0) {
    return Option.none<BoardPoint>();
  }
  if (time >= plan.land) {
    return Option.some(plan.rest);
  }
  if (elapsed < OUTLET_FALL) {
    return Option.some({
      x: OUTLET.x,
      y: OUTLET.y - (SLOW_GRAVITY * elapsed * elapsed) / 2,
    });
  }
  const hopping = elapsed - OUTLET_FALL;
  const row = Math.min(Math.floor(hopping / HOP), rows);
  const index = Arr.reduce(
    Arr.take(plan.rights, row),
    0,
    (sum, right) => sum + (right ? 1 : 0)
  );
  if (row < rows) {
    const side = plan.rights[row] === true ? 1 : -1;
    return Option.some(
      hopAt(contactPoint(row, index), side, hopping - row * HOP)
    );
  }
  const falling = hopping - rows * HOP;
  const start = contactPoint(rows - 1, 0).y - ROW_GAP;
  const share = falling / (plan.land - plan.release - OUTLET_FALL - rows * HOP);
  const centre = binCentre(rows, plan.bin);
  return Option.some({
    x: centre + (plan.rest.x - centre) * share,
    y: start - HOP_END_SPEED * falling - (SLOW_GRAVITY * falling * falling) / 2,
  });
}

/** How many balls have left the hopper by `time`. */
export function releasedBy(plans: readonly BallPlan[], time: number) {
  return Arr.filter(plans, (plan) => plan.release <= time).length;
}

/** How many balls have come to rest in a bin by `time`. */
export function landedBy(plans: readonly BallPlan[], time: number) {
  return Arr.filter(plans, (plan) => plan.land <= time).length;
}

/** The moment the last ball comes to rest, which ends the run. */
export function runEnd(plans: readonly BallPlan[]) {
  return Arr.reduce(plans, 0, (latest, plan) => Math.max(latest, plan.land));
}
