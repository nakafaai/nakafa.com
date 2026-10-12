import { describe, expect, it } from "@effect/vitest";
import { NINA, POP } from "@repo/mascot/color";
import { ACTS, ActSchema } from "@repo/mascot/nina/act";
import { ARM, LEG } from "@repo/mascot/nina/body";
import { compose, legCurve, place, scene } from "@repo/mascot/nina/figure";
import { type Curve, cubic, exit, slope, wide } from "@repo/mascot/nina/limb";
import type { Mark } from "@repo/mascot/nina/mark";
import type { Place } from "@repo/mascot/nina/point";
import { armLeft, type Pose, REST } from "@repo/mascot/nina/pose";
import { CASES, DIGESTS, digestOf } from "@repo/mascot/nina/test.fixture";
import { hitter } from "@repo/mascot/nina/test.hit";
import { rect, type Shape } from "@repo/mascot/shape";
import { Array as Arr, Effect, Option, Order, Record as Rec } from "effect";

/** Nine seconds in steps of 0.07: every act comes round more than once. */
const MOMENTS = Arr.makeBy(129, (i) => i * 0.07);
/** The check looks at 13 acts at 129 moments each, which the coverage run slows down. */
const JOINTS_TIMEOUT = 60_000;
/** Across the width of an arm at its cut: from one edge to the other. */
const CUT_SPREAD = [-0.85, -0.45, 0, 0.45, 0.85];

/** Where on the middle line of a limb, which way it runs there. */
function frame(c: Curve, t: number) {
  const dx = slope(c[0], c[2], c[4], c[6], t);
  const dy = slope(c[1], c[3], c[5], c[7], t);
  const len = Math.hypot(dx, dy) || 1;
  return {
    tx: dx / len,
    ty: dy / len,
    x: cubic(c[0], c[2], c[4], c[6], t),
    y: cubic(c[1], c[3], c[5], c[7], t),
  };
}

/** The shapes of a picture and of its groups, in the order they are drawn. */
function flat(shapes: readonly Shape<Mark>[]): readonly Shape<Mark>[] {
  return Arr.flatMap(shapes, (shape) =>
    shape._tag === "g" ? [shape, ...flat(shape.children)] : [shape]
  );
}

/** The shape that draws a whole limb. */
function limbShape(shapes: readonly Shape<Mark>[], name: string) {
  return Option.getOrUndefined(
    Arr.findFirst(
      flat(shapes),
      ({ mark }) => mark?._tag === "limb" && mark.name === name
    )
  );
}

/**
 * Everything wrong with the joints of one picture: the root of a limb that
 * shows outside her body, and the cut of the top part of an arm that lies on
 * anything but her own color. A person looks where the limb leaves her, so
 * nothing there may look put on.
 */
function joints(pose: Pose, shapes: readonly Shape<Mark>[]) {
  const onTop = hitter(shapes);
  const limbs = [
    { c: pose.armL, girth: ARM, name: "armL", side: 0, upper: true },
    { c: pose.armR, girth: ARM, name: "armR", side: 1, upper: true },
    ...Arr.map(pose.legs, (_, i) => ({
      c: legCurve(pose, i),
      girth: LEG,
      name: `leg${i}`,
      side: -1,
      upper: false,
    })),
  ];
  return Arr.flatMap(limbs, ({ c, girth, name, side, upper }) => {
    const move = (x: number, y: number): Place =>
      upper ? place(pose, x, y) : [x, y];
    const own = limbShape(shapes, name);
    // The root: its two corners and the top of its round end.
    const root = frame(c, 0);
    const half = wide(0, girth);
    const rootShows = Arr.some(
      [
        [0, half - 1],
        [0, -(half - 1)],
        [-(girth.thick / 4 - 1), 0],
        [-(girth.thick / 8), half * 0.7],
        [-(girth.thick / 8), -half * 0.7],
      ],
      ([along, across]) => {
        const [x, y] = move(
          root.x + root.tx * along - root.ty * across,
          root.y + root.ty * along + root.tx * across
        );
        return Option.getOrUndefined(onTop(x, y)) === own;
      }
    );
    // The cut where the top part of an arm starts.
    const from = exit(c, girth);
    const cut = frame(c, from);
    const across = wide(from, girth);
    const cutShows =
      side >= 0 &&
      pose.layer[side] !== "back" &&
      Arr.some(CUT_SPREAD, (spread) => {
        const [x, y] = move(
          cut.x - cut.tx * 1.6 - cut.ty * across * spread,
          cut.y - cut.ty * 1.6 + cut.tx * across * spread
        );
        return !Option.exists(onTop(x, y), ({ fill }) => fill === NINA.body);
      });
    return [
      ...(rootShows ? [`the root of ${name} shows outside her body`] : []),
      ...(cutShows ? [`the cut of ${name} does not lie on her own color`] : []),
    ];
  });
}

describe("the drawing of Nina", () => {
  it("is pinned for exactly the cases that were proven equal to the approved design", () => {
    expect(Arr.sort(Rec.keys(CASES), Order.String)).toEqual(
      Arr.sort(Rec.keys(DIGESTS), Order.String)
    );
  });

  it.effect(
    "draws what it drew when it was proven equal, for every act, face, lean and side",
    () =>
      Effect.gen(function* () {
        for (const [id, options] of Rec.toEntries(CASES)) {
          const digests = yield* Effect.forEach(options, digestOf);
          expect(Arr.join(digests, " "), id).toBe(DIGESTS[id]);
        }
      })
  );
});

describe("her joints", () => {
  it(
    "hide the root of every limb in her body, and put the cut of every top arm on her own color, in any act at any moment",
    () => {
      for (const act of ActSchema.literals) {
        for (const t of MOMENTS) {
          const { shapes } = scene({ act, t, whole: true });
          expect(joints(ACTS[act].pose(t), shapes), `${act} at ${t}`).toEqual(
            []
          );
        }
      }
    },
    JOINTS_TIMEOUT
  );

  it("notice the root of an arm that starts outside her body", () => {
    const pose: Pose = { ...REST, armL: [10, 146, 0, 160, -10, 180, -20, 200] };
    const { shapes } = compose({ whole: true }, pose, "hello", [0, 0]);
    expect(joints(pose, shapes)).toEqual([
      "the root of armL shows outside her body",
    ]);
  });

  it("notice the cut of a top arm that lies on something else than her own color", () => {
    const pose: Pose = {
      ...REST,
      armL: armLeft(22, 162, 30, 208, 68, 196),
      held: [
        rect({ fill: POP.yellow, height: 160, width: 200, x: -40, y: 110 }),
      ],
      layer: ["front", "back"],
    };
    const { shapes } = compose({ whole: true }, pose, "hello", [0, 0]);
    expect(joints(pose, shapes)).toEqual([
      "the cut of armL does not lie on her own color",
    ]);
  });
});
