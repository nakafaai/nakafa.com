import { ACTS, ActSchema } from "@repo/design-system/components/nina/act";
import { EDGES, EdgeSchema } from "@repo/design-system/components/nina/edge";
import {
  type Look,
  LookSchema,
  MoodSchema,
} from "@repo/design-system/components/nina/face";
import {
  compose,
  type Options,
  viewed,
} from "@repo/design-system/components/nina/figure";
import { homeOf, modeOf } from "@repo/design-system/components/nina/mode";
import { type Pose, REST } from "@repo/design-system/components/nina/pose";
import {
  followPeek,
  followWhole,
  peekNumbers,
  peekSprung,
  SpringsSchema,
  settle,
  wholeNumbers,
  wholeSprung,
} from "@repo/design-system/components/nina/spring";
import { Array as Arr, Match, Number as Num, Schema } from "effect";

/** An act of the whole figure, or one over an edge. */
const NameSchema = Schema.Union([ActSchema, EdgeSchema]);

/** A face that a press shows for a moment, and the time it is shown. */
const GladSchema = Schema.Struct({
  from: Schema.Finite,
  mood: MoodSchema,
  until: Schema.Finite,
});

/**
 * Her life: what she does now and what she goes back to, where she is in it,
 * the springs that her limbs hang on, where her eyes look, and the face that a
 * press has shown for a moment. All of it moves with one clock, `now`.
 */
export const LiveSchema = Schema.Struct({
  act: NameSchema,
  clicks: Schema.Finite,
  clock: Schema.Finite,
  gaze: LookSchema,
  glad: Schema.optionalKey(GladSchema),
  home: NameSchema,
  idle: Schema.Finite,
  next: Schema.Finite,
  now: Schema.Finite,
  springs: SpringsSchema,
  until: Schema.Finite,
});

export type Live = typeof LiveSchema.Type;

/** Every act she does, whole or over an edge. */
const BEHAVIORS = { ...ACTS, ...EDGES };

/** The faces of a tile, one for each press in turn. */
const FACES = ["tertawa", "kedip", "bangga"] as const;

/** What a press makes her do when all of her shows: a wave, a juggle, a cheer. */
const WHOLE_TURNS = [
  ["melambai", 1.7],
  ["main", 3],
  ["merayakan", 2.4],
] as const;

/** What a press makes her do over an edge, before the third press ducks her behind it. */
const EDGE_TURNS = [
  ["lambai", 1.5],
  ["ketuk", 1.1],
] as const;

/** The numbers of a pose that her springs follow, for the way she is shown. */
function numbersOf(options: Options, pose: Pose) {
  return Match.value(modeOf(options)).pipe(
    Match.when("whole", () => wholeNumbers(pose)),
    Match.when("peek", () => peekNumbers(pose)),
    Match.when("tile", () => []),
    Match.exhaustive
  );
}

/**
 * Begins her life on the moment that a picture of her shows, so the live
 * figure takes over from the still one without a jump. `draw` gives a number
 * from 0 up to 1, for the time until her first habit.
 */
export function start(options: Options, draw: () => number): Live {
  const home = homeOf(options);
  const clock = options.t ?? BEHAVIORS[home].still;
  return {
    act: home,
    clicks: 0,
    clock,
    gaze: options.look ?? [0, 0],
    home,
    idle: 0,
    next: 3 + draw() * 4,
    now: 0,
    springs: settle(numbersOf(options, BEHAVIORS[home].pose(clock))),
    until: 0,
  };
}

/** Does an act for a moment, then goes back to what she was doing. */
function play(live: Live, act: Live["act"], seconds: number): Live {
  return { ...live, act, clock: 0, until: seconds };
}

/** Shows a face from `delay` seconds from now, for `seconds`. */
function flash(
  live: Live,
  mood: typeof MoodSchema.Type,
  delay: number,
  seconds: number
): Live {
  return {
    ...live,
    glad: { from: live.now + delay, mood, until: live.now + delay + seconds },
  };
}

/** Goes back to the act that she was doing, once the act that she played is over. */
function resume(live: Live): Live {
  if (live.until === 0 || live.clock < live.until) {
    return live;
  }
  const { glad: _glad, ...rest } = live;
  return { ...rest, act: live.home, clock: 0, until: 0 };
}

/** Now and then she does one of her habits for a moment, by herself. */
function fidget(
  live: Live,
  options: Options,
  dt: number,
  draw: () => number
): Live {
  const habits = options.fidget ?? [];
  if (live.until > 0 || habits.length === 0) {
    return live;
  }
  const idle = live.idle + dt;
  if (idle <= live.next) {
    return { ...live, idle };
  }
  const next = 5 + draw() * 5;
  return play(
    { ...live, idle: 0, next },
    habits[Math.floor(draw() * habits.length)],
    modeOf(options) === "whole" ? 2.2 : 1.3
  );
}

/**
 * Moves her springs toward the act and her eyes toward the pointer. A frame
 * that took long is cut into small pieces, so a slow frame cannot throw a limb.
 */
function settled(
  live: Live,
  options: Options,
  dt: number,
  pointer: Look
): Live {
  const pieces = Math.max(1, Math.ceil(dt / 0.012));
  const slice = dt / pieces;
  const pose = BEHAVIORS[live.act].pose(live.clock);
  const mode = modeOf(options);
  const follow = mode === "whole" ? followWhole : followPeek;
  const reach = Math.min(1, slice * 9);
  // In a tile nothing but her face moves, so there are no springs to follow.
  const springs =
    mode === "tile"
      ? live.springs
      : Arr.reduce(Arr.range(1, pieces), live.springs, (held) =>
          follow(held, pose, slice)
        );
  return {
    ...live,
    gaze: [
      live.gaze[0] + (pointer[0] - live.gaze[0]) * reach,
      live.gaze[1] + (pointer[1] - live.gaze[1]) * reach,
    ],
    springs,
  };
}

/** Lets time go by: a frame of `dt` seconds, with the pointer at `pointer`. */
export function step(
  live: Live,
  options: Options,
  dt: number,
  pointer: Look,
  draw: () => number
): Live {
  const moved = resume({
    ...live,
    clock: live.clock + dt,
    now: live.now + dt,
  });
  return settled(fidget(moved, options, dt, draw), options, dt, pointer);
}

/** Changes what she does from now on, without a jump: her springs keep their place. */
export function retarget(live: Live, act: Live["act"]): Live {
  if (live.home === act) {
    return live;
  }
  return live.until > 0
    ? { ...live, home: act }
    : { ...live, act, clock: 0, home: act };
}

/**
 * What a press does. All of her shows: she waves, then juggles, then cheers,
 * and goes back to what she was doing. Over an edge: she waves, drums on the
 * edge, or ducks behind it (`duck`) and comes up with another face. In a tile:
 * another face each time.
 */
export function press(live: Live, options: Options) {
  const clicks = live.clicks + 1;
  const counted = { ...live, clicks };
  const turn = (clicks - 1) % 3;
  return Match.value(modeOf(options)).pipe(
    Match.when("whole", () => {
      const [act, seconds] = WHOLE_TURNS[turn];
      return { duck: false, live: play(counted, act, seconds) };
    }),
    Match.when("tile", () => ({
      duck: false,
      live: flash(counted, FACES[turn], 0, 1.1),
    })),
    Match.when("peek", () => {
      if (turn === 2) {
        return { duck: true, live: flash(counted, "kaget", 0.4, 1.3) };
      }
      const [act, seconds] = EDGE_TURNS[turn];
      return { duck: false, live: play(counted, act, seconds) };
    }),
    Match.exhaustive
  );
}

/** Whether she holds something now, which then arrives with a small pop. */
export function holding(live: Live) {
  return BEHAVIORS[live.act].pose(live.clock).held.length > 0;
}

/** What she looks like now, in her window. */
export function view(live: Live, options: Options) {
  const pose = BEHAVIORS[live.act].pose(live.clock);
  const glad =
    live.glad !== undefined &&
    live.now >= live.glad.from &&
    live.now < live.glad.until
      ? live.glad.mood
      : undefined;
  const mood = glad ?? options.mood ?? pose.mood ?? "halo";
  const mode = modeOf(options);
  if (mode === "whole") {
    return compose(
      options,
      wholeSprung(live.springs, pose),
      mood,
      pose.look ?? viewed(options.side, live.gaze)
    );
  }
  return compose(
    options,
    mode === "peek" ? peekSprung(live.springs, pose) : REST,
    mood,
    viewed(options.side, live.gaze)
  );
}

/** Where she should look to face the pointer, a few units at most, from where it is. */
export function gazeAt(
  [x, y]: readonly [number, number],
  box: Pick<DOMRectReadOnly, "height" | "left" | "top" | "width">
): Look {
  const reach = Math.max(box.width, 120) * 2.4;
  const toward = (distance: number) =>
    Num.clamp(distance / reach, { maximum: 1, minimum: -1 });
  return [
    toward(x - (box.left + box.width / 2)) * 4,
    toward(y - (box.top + box.height * 0.4)) * 3,
  ];
}
