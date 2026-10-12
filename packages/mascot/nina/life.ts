import { ACTS, ActSchema } from "@repo/mascot/nina/act";
import { EDGES, EdgeSchema } from "@repo/mascot/nina/edge";
import { type Look, LookSchema, MoodSchema } from "@repo/mascot/nina/face";
import { compose, type Options, viewed } from "@repo/mascot/nina/figure";
import { homeOf, modeOf } from "@repo/mascot/nina/mode";
import { type Pose, REST } from "@repo/mascot/nina/pose";
import {
  followPeek,
  followWhole,
  peekNumbers,
  peekSprung,
  SpringsSchema,
  settle,
  wholeNumbers,
  wholeSprung,
} from "@repo/mascot/nina/spring";
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
const LifeSchema = Schema.Struct({
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

export type Life = typeof LifeSchema.Type;

/** Where a person's pointer stands in relation to her: the box her picture fills on the screen. */
const BoxSchema = Schema.Struct({
  height: Schema.Finite,
  left: Schema.Finite,
  top: Schema.Finite,
  width: Schema.Finite,
});

/** Every act she does, whole or over an edge. */
const BEHAVIORS = { ...ACTS, ...EDGES };

/** The faces of a tile, one for each press in turn. */
const FACES = ["laughing", "winking", "proud"] as const;

/** What a press makes her do when all of her shows: a wave, a juggle, a cheer. */
const WHOLE_TURNS = [
  ["waving", 1.7],
  ["juggling", 3],
  ["cheering", 2.4],
] as const;

/** What a press makes her do over an edge, before the third press ducks her behind it. */
const EDGE_TURNS = [
  ["greeting", 1.5],
  ["drumming", 1.1],
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
export function start(options: Options, draw: () => number): Life {
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
function play(life: Life, act: Life["act"], seconds: number): Life {
  return { ...life, act, clock: 0, until: seconds };
}

/** Shows a face from `delay` seconds from now, for `seconds`. */
function flash(
  life: Life,
  mood: typeof MoodSchema.Type,
  delay: number,
  seconds: number
): Life {
  return {
    ...life,
    glad: { from: life.now + delay, mood, until: life.now + delay + seconds },
  };
}

/** Goes back to the act that she was doing, once the act that she played is over. */
function resume(life: Life): Life {
  if (life.until === 0 || life.clock < life.until) {
    return life;
  }
  const { glad: _glad, ...rest } = life;
  return { ...rest, act: life.home, clock: 0, until: 0 };
}

/** Now and then she does one of her habits for a moment, by herself. */
function fidget(
  life: Life,
  options: Options,
  dt: number,
  draw: () => number
): Life {
  const habits = options.fidget ?? [];
  if (life.until > 0 || habits.length === 0) {
    return life;
  }
  const idle = life.idle + dt;
  if (idle <= life.next) {
    return { ...life, idle };
  }
  const next = 5 + draw() * 5;
  return play(
    { ...life, idle: 0, next },
    habits[Math.floor(draw() * habits.length)],
    modeOf(options) === "whole" ? 2.2 : 1.3
  );
}

/**
 * Moves her springs toward the act and her eyes toward the pointer. A frame
 * that took long is cut into small pieces, so a slow frame cannot throw a limb.
 */
function settled(
  life: Life,
  options: Options,
  dt: number,
  pointer: Look
): Life {
  const pieces = Math.max(1, Math.ceil(dt / 0.012));
  const slice = dt / pieces;
  const pose = BEHAVIORS[life.act].pose(life.clock);
  const mode = modeOf(options);
  const follow = mode === "whole" ? followWhole : followPeek;
  const reach = Math.min(1, slice * 9);
  // In a tile nothing but her face moves, so there are no springs to follow.
  const springs =
    mode === "tile"
      ? life.springs
      : Arr.reduce(Arr.range(1, pieces), life.springs, (held) =>
          follow(held, pose, slice)
        );
  return {
    ...life,
    gaze: [
      life.gaze[0] + (pointer[0] - life.gaze[0]) * reach,
      life.gaze[1] + (pointer[1] - life.gaze[1]) * reach,
    ],
    springs,
  };
}

/** Lets time go by: a frame of `dt` seconds, with the pointer at `pointer`. */
export function step(
  life: Life,
  options: Options,
  dt: number,
  pointer: Look,
  draw: () => number
): Life {
  const moved = resume({
    ...life,
    clock: life.clock + dt,
    now: life.now + dt,
  });
  return settled(fidget(moved, options, dt, draw), options, dt, pointer);
}

/** Changes what she does from now on, without a jump: her springs keep their place. */
export function retarget(life: Life, act: Life["act"]): Life {
  if (life.home === act) {
    return life;
  }
  return life.until > 0
    ? { ...life, home: act }
    : { ...life, act, clock: 0, home: act };
}

/**
 * What a press does. All of her shows: she waves, then juggles, then cheers,
 * and goes back to what she was doing. Over an edge: she waves, drums on the
 * edge, or ducks behind it (`duck`) and comes up with another face. In a tile:
 * another face each time.
 */
export function press(life: Life, options: Options) {
  const clicks = life.clicks + 1;
  const counted = { ...life, clicks };
  const turn = (clicks - 1) % 3;
  return Match.value(modeOf(options)).pipe(
    Match.when("whole", () => {
      const [act, seconds] = WHOLE_TURNS[turn];
      return { duck: false, life: play(counted, act, seconds) };
    }),
    Match.when("tile", () => ({
      duck: false,
      life: flash(counted, FACES[turn], 0, 1.1),
    })),
    Match.when("peek", () => {
      if (turn === 2) {
        return { duck: true, life: flash(counted, "surprised", 0.4, 1.3) };
      }
      const [act, seconds] = EDGE_TURNS[turn];
      return { duck: false, life: play(counted, act, seconds) };
    }),
    Match.exhaustive
  );
}

/**
 * What she looks like now, in her window, and whether she holds something,
 * which then arrives with a small pop.
 */
export function view(life: Life, options: Options) {
  const pose = BEHAVIORS[life.act].pose(life.clock);
  const glad =
    life.glad !== undefined &&
    life.now >= life.glad.from &&
    life.now < life.glad.until
      ? life.glad.mood
      : undefined;
  const mood = glad ?? options.mood ?? pose.mood ?? "hello";
  const mode = modeOf(options);
  const holds = pose.held.length > 0;
  if (mode === "whole") {
    return {
      holds,
      picture: compose(
        options,
        wholeSprung(life.springs, pose),
        mood,
        pose.look ?? viewed(options.side, life.gaze)
      ),
    };
  }
  return {
    holds,
    picture: compose(
      options,
      mode === "peek" ? peekSprung(life.springs, pose) : REST,
      mood,
      viewed(options.side, life.gaze)
    ),
  };
}

/** Where she should look to face the pointer, a few units at most, from where it is. */
export function gazeAt(
  [x, y]: readonly [number, number],
  box: typeof BoxSchema.Type
): Look {
  const reach = Math.max(box.width, 120) * 2.4;
  const toward = (distance: number) =>
    Num.clamp(distance / reach, { maximum: 1, minimum: -1 });
  return [
    toward(x - (box.left + box.width / 2)) * 4,
    toward(y - (box.top + box.height * 0.4)) * 3,
  ];
}
