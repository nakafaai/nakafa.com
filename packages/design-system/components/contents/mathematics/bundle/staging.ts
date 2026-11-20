import {
  DivisionStepSchema,
  divisionLadder,
  numeralLength,
} from "@repo/design-system/components/contents/mathematics/bundle/digits";
import type { Point } from "@repo/design-system/components/contents/mathematics/bundle/layout";
import {
  boxOnTray,
  bundleInBox,
  HeapStickSchema,
  heapSticks,
  STICK,
  stickInBundle,
} from "@repo/design-system/components/contents/mathematics/bundle/layout";
import {
  deskZones,
  ZoneSchema,
  zoneSlot,
} from "@repo/design-system/components/contents/mathematics/bundle/zones";
import { Array as Arr, Option, Schema } from "effect";

/**
 * When everything on the bundling desk moves. Play runs up to three rounds,
 * each one division by the base: sticks into bundles, bundles into boxes,
 * boxes onto trays. In a round the groups go one after another, the things
 * of a group a moment apart, and the round rests before the next, so the
 * learner can read its division. What a round leaves behind already lies
 * where the finished desk shows it.
 */

/** How long the heap rests before the first round, in seconds. */
const OPENING = 0.8;

/** How long one thing takes to fly to its place. */
export const FLIGHT = 0.65;

/** How far behind each other the things of one group set off. */
const LAG = 0.05;

/** The longest gap between two groups, and how long a busy round's groups take to set off. */
const GAP = { most: 0.45, spread: 4 } as const;

/** How long the boxes or trays take to come down onto the desk before a round fills them. */
const SETTLE = 0.6;

/** How long a round rests once its last thing lands. */
const REST = 1.8;

/** How high a flying thing rises above the straight line to its place. */
const ARC = 0.05;

/** How high a box or a tray starts above its place as it comes down. */
const DROP = 0.12;

/** The highest any moving thing rises above where it lies: an arc of flight or a container coming down. */
export const LIFT = Math.max(ARC, DROP);

/** The seed of the heap, so every learner tips out the same heap. */
const HEAP_SEED = 20_261_120;

/** One round: the division it acts out, when it starts, when its groups set off, and when it ends. */
const RoundSchema = Schema.Struct({
  end: Schema.Finite,
  gap: Schema.Finite,
  lead: Schema.Finite,
  start: Schema.Finite,
  step: DivisionStepSchema,
});
type Round = typeof RoundSchema.Type;

/** Everything the desk needs to draw one count in one base at any time. */
const BundleRunSchema = Schema.Struct({
  base: Schema.Int,
  count: Schema.Int,
  duration: Schema.Finite,
  heap: Schema.Array(HeapStickSchema),
  length: Schema.Int,
  rounds: Schema.Array(RoundSchema),
  zones: Schema.Array(ZoneSchema),
});
type BundleRun = typeof BundleRunSchema.Type;

/** The rounds play acts out for `count` in `base`: the first always, then one for every quotient of at least `base`. */
function planRounds(count: number, base: number): readonly Round[] {
  const steps = Arr.filter(
    divisionLadder(count, base),
    (step, index) => index === 0 || step.dividend >= base
  );
  return Arr.reduce(steps, Arr.empty<Round>(), (rounds, step, index) => {
    const start = Option.match(Arr.last(rounds), {
      onNone: () => OPENING,
      onSome: (last) => last.end,
    });
    const groups = step.quotient + (index === 0 && step.remainder > 0 ? 1 : 0);
    const gap = Math.min(GAP.most, GAP.spread / Math.max(1, groups));
    const lead = index === 0 ? 0 : SETTLE;
    const end =
      start + lead + (groups - 1) * gap + (base - 1) * LAG + FLIGHT + REST;
    return [...rounds, { end, gap, lead, start, step }];
  });
}

/** Plans the run of `count` sticks in `base`. */
export function planRun(count: number, base: number): BundleRun {
  const rounds = planRounds(count, base);
  return {
    base,
    count,
    duration: Arr.reduce(rounds, OPENING, (_, round) => round.end),
    heap: heapSticks(count, HEAP_SEED),
    length: numeralLength(count, base),
    rounds,
    zones: deskZones(count, base),
  };
}

/** The number of the round under way at `time`, if play has reached one. */
export function roundIndexAt(run: BundleRun, time: number) {
  return Arr.findLastIndex(run.rounds, (round) => round.start <= time);
}

/** How far through its flight a thing is that sets off at `departs`, eased in and out, from 0 to 1. */
export function flightProgress(time: number, departs: number) {
  const linear = Math.min(1, Math.max(0, (time - departs) / FLIGHT));
  return linear * linear * (3 - 2 * linear);
}

/** When item `slot` of group `group` of round `round` sets off. */
function departure(run: BundleRun, round: number, group: number, slot: number) {
  const { gap, lead, start } = Arr.getUnsafe(run.rounds, round);
  return start + lead + group * gap + slot * LAG;
}

/** The point `share` of the way from `from` to `to`, raised on an arc. */
export function along(from: Point, to: Point, share: number): Point {
  return {
    x: from.x + (to.x - from.x) * share,
    y: from.y + (to.y - from.y) * share + ARC * Math.sin(Math.PI * share),
    z: from.z + (to.z - from.z) * share,
  };
}

/** `point` moved by `by`. */
function plus(point: Point, by: Point): Point {
  return { x: point.x + by.x, y: point.y + by.y, z: point.z + by.z };
}

/** A container coming down onto its place once its round starts, and hidden before it. */
function settled(place: Point, time: number, starts: number) {
  if (time < starts) {
    return Option.none<Point>();
  }
  const share = Math.min(1, (time - starts) / SETTLE);
  const drop = DROP * (1 - share) ** 2;
  return Option.some({ ...place, y: place.y + drop });
}

/** The quotient of round `round`, or 0 when play acts out no such round. */
function made(run: BundleRun, round: number) {
  return Option.match(Arr.get(run.rounds, round), {
    onNone: () => 0,
    onSome: (each) => each.step.quotient,
  });
}

/** Where tray `tray` stands at `time`, once the third round brings it: a count that reaches a third round has a tray zone. */
export function trayAt(run: BundleRun, tray: number, time: number) {
  return Option.flatMap(Arr.get(run.rounds, 2), (round) =>
    settled(zoneSlot(tray, Arr.getUnsafe(run.zones, 3)), time, round.start)
  );
}

/**
 * Where box `box` stands at `time`: it comes down into its zone when the
 * second round starts, and when the third round takes it, it flies onto its
 * tray. Boxes leave from the top of the stack first.
 */
export function boxAt(run: BundleRun, box: number, time: number) {
  const boxes = made(run, 1);
  const kept = boxes % run.base;
  const resting = Option.flatMap(Arr.get(run.rounds, 1), (round) =>
    settled(zoneSlot(box, Arr.getUnsafe(run.zones, 2)), time, round.start)
  );
  if (box < kept) {
    return resting;
  }
  const rank = boxes - 1 - box;
  const tray = Math.floor(rank / run.base);
  const slot = rank % run.base;
  const share = flightProgress(time, departure(run, 2, tray, slot));
  return Option.map(resting, (from) =>
    Option.match(trayAt(run, tray, time), {
      onNone: () => from,
      onSome: (on) => along(from, plus(on, boxOnTray(slot, run.base)), share),
    })
  );
}

/**
 * Where bundle `bundle` lies at `time`: in its zone once the first round
 * ties it, and, when the second round boxes it, flying into its box and
 * then riding with it. Bundles leave from the top of the pile first.
 */
export function bundleAt(run: BundleRun, bundle: number, time: number): Point {
  const place = zoneSlot(bundle, Arr.getUnsafe(run.zones, 1));
  const bundles = made(run, 0);
  const kept = bundles % run.base;
  if (bundle < kept) {
    return place;
  }
  const rank = bundles - 1 - bundle;
  const box = Math.floor(rank / run.base);
  const slot = rank % run.base;
  const share = flightProgress(time, departure(run, 1, box, slot));
  return Option.match(boxAt(run, box, time), {
    onNone: () => place,
    onSome: (at) => along(place, plus(at, bundleInBox(slot, run.base)), share),
  });
}

/** When bundle `bundle` is tied: as its last stick lands. */
export function bundleTied(run: BundleRun, bundle: number) {
  return departure(run, 0, bundle, run.base - 1) + FLIGHT;
}

/** Where stick `stick` lies at `time`, and how far it has turned from its heap pose to lie straight, from 0 to 1. */
export function stickAt(run: BundleRun, stick: number, time: number) {
  const heap = Arr.getUnsafe(run.heap, stick);
  const order = run.count - 1 - stick;
  const bundles = made(run, 0);
  const tied = order < bundles * run.base;
  const group = tied ? Math.floor(order / run.base) : bundles;
  const slot = tied ? order % run.base : order - bundles * run.base;
  const share = flightProgress(time, departure(run, 0, group, slot));
  const target = tied
    ? plus(bundleAt(run, group, time), stickInBundle(slot, run.base))
    : zoneSlot(slot, Arr.getUnsafe(run.zones, 0));
  const lift = { x: 0, y: STICK.thickness / 2, z: 0 };
  return {
    at: along(plus(heap, lift), plus(target, lift), share),
    heap,
    straight: share,
  };
}

/** The numbers from 0 below `count`, and none when `count` is 0. */
function below(count: number) {
  return count > 0 ? Arr.range(0, count - 1) : [];
}

/** Where every bundle tied by `time` lies, for its rubber band. */
export function tiedBundlesAt(run: BundleRun, time: number) {
  return Arr.map(
    Arr.filter(
      below(made(run, 0)),
      (bundle) => time >= bundleTied(run, bundle)
    ),
    (bundle) => bundleAt(run, bundle, time)
  );
}

/** Where every box on the desk stands at `time`. */
export function boxesAt(run: BundleRun, time: number) {
  return Arr.getSomes(
    Arr.map(below(made(run, 1)), (box) => boxAt(run, box, time))
  );
}

/** Where every tray on the desk stands at `time`. */
export function traysAt(run: BundleRun, time: number) {
  return Arr.getSomes(
    Arr.map(below(made(run, 2)), (tray) => trayAt(run, tray, time))
  );
}
