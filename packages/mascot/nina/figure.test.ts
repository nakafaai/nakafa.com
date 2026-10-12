import { describe, expect, it } from "@effect/vitest";
import { NINA, POP, TEXT } from "@repo/mascot/color";
import { ACTS, ActSchema } from "@repo/mascot/nina/act";
import { compose, place, scene } from "@repo/mascot/nina/figure";
import type { Mark } from "@repo/mascot/nina/mark";
import type { Options } from "@repo/mascot/nina/options";
import type { Place } from "@repo/mascot/nina/point";
import { armLeft, type Pose, REST } from "@repo/mascot/nina/pose";
import { CASES, DIGESTS, digestOf } from "@repo/mascot/nina/test.fixture";
import { hitter, outlineOf } from "@repo/mascot/nina/test.hit";
import { rect, type Shape } from "@repo/mascot/shape";
import {
  Array as Arr,
  Effect,
  Option,
  Order,
  Record as Rec,
  Result,
} from "effect";

/** Nine seconds in steps of 0.07: every act comes round more than once. */
const MOMENTS = Arr.makeBy(129, (i) => i * 0.07);
/** The check looks at 13 acts at 129 moments each, which the coverage run slows down. */
const JOINTS_TIMEOUT = 60_000;
/** Across the width of an arm at its cut: from one edge to the other. */
const CUT_SPREAD = [-0.85, -0.45, 0, 0.45, 0.85];
/** How far inside a limb the root is looked at, and how far before its cut. */
const INSIDE = 1;
const BEFORE_CUT = 1.6;
/** The limbs that stand in the room of her upper body, and so move with it. */
const UPPER = ["armL", "armR", "overL", "overR"];

/** The shapes of a picture and of its groups, in the order they are drawn. */
function flat(shapes: readonly Shape<Mark>[]): readonly Shape<Mark>[] {
  return Arr.flatMap(shapes, (shape) =>
    shape._tag === "g" ? [shape, ...flat(shape.children)] : [shape]
  );
}

/**
 * The colour that each free line of a picture is drawn in: the one its nearest
 * group hands down, and the colour of the text around her when none does.
 */
function freeLines(
  shapes: readonly Shape<Mark>[],
  handed: string = TEXT
): readonly string[] {
  return Arr.flatMap(shapes, (shape) => {
    if (shape._tag === "g") {
      return freeLines(shape.children, shape.color ?? handed);
    }
    return shape.stroke === TEXT ? [handed] : [];
  });
}

/** The free lines of her, as options ask for her. */
function freeLinesOf(options: Options) {
  return freeLines(scene(options).shapes);
}

/** The middle of two places. */
function middle(a: Place, b: Place): Place {
  return [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
}

/** A place moved `by` units along the line toward another place. */
function toward(from: Place, to: Place, by: number): Place {
  const gap = Math.hypot(to[0] - from[0], to[1] - from[1]) || 1;
  return [
    from[0] + ((to[0] - from[0]) / gap) * by,
    from[1] + ((to[1] - from[1]) / gap) * by,
  ];
}

/**
 * Every limb that her picture draws, with the places along its outline. They
 * are read from the drawing and not worked out again, so the check asks the
 * picture and not the formulas that made it: a whole limb ends in the places of
 * its round root (the last corner, the curve, and the start again), and the top
 * part of an arm ends in the two corners of its cut.
 */
function limbsOf(shapes: readonly Shape<Mark>[]) {
  return Arr.filterMap(flat(shapes), (shape) =>
    shape._tag === "path" && shape.mark?._tag === "limb"
      ? Result.succeed({
          name: shape.mark.name,
          outline: outlineOf(shape.d),
          shape,
        })
      : Result.failVoid
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
  return Arr.flatMap(limbsOf(shapes), ({ name, outline, shape }) => {
    const move = (at: Place): Place =>
      Arr.contains(UPPER, name) ? place(pose, at[0], at[1]) : at;
    const first = outline[0];
    if (name === "overL" || name === "overR") {
      // The top part of an arm starts at a straight cut between its first and
      // its last corner. Just before the cut, on the side of the root, there must
      // be her own color. Forward is the way its left edge runs from the cut.
      const [last] = Arr.takeRight(outline, 2);
      const across: Place = [last[0] - first[0], last[1] - first[1]];
      const length = Math.hypot(across[0], across[1]) || 1;
      const sideways: Place = [-across[1] / length, across[0] / length];
      const edge = outline[1];
      const forward =
        sideways[0] * (edge[0] - first[0]) + sideways[1] * (edge[1] - first[1]);
      const sign = forward > 0 ? 1 : -1;
      const centre = middle(first, last);
      const lies = Arr.every(CUT_SPREAD, (spread) => {
        const [x, y] = move([
          centre[0] +
            (across[0] / 2) * spread -
            sign * sideways[0] * BEFORE_CUT,
          centre[1] +
            (across[1] / 2) * spread -
            sign * sideways[1] * BEFORE_CUT,
        ]);
        return Option.exists(onTop(x, y), ({ fill }) => fill === NINA.body);
      });
      return lies ? [] : [`the cut of ${name} does not lie on her own color`];
    }
    // A whole limb ends in its root: the corner, the round end, and the start.
    // A little inside each of those places, nothing of her may be on top.
    const root = Arr.takeRight(outline, 14);
    const centre = middle(first, root[0]);
    const shows = Arr.some(root, (at) => {
      const [x, y] = move(toward(at, centre, INSIDE));
      return Option.getOrUndefined(onTop(x, y)) === shape;
    });
    return shows ? [`the root of ${name} shows outside her body`] : [];
  });
}

describe("the drawing of Nina", () => {
  it("is pinned for exactly the cases that were proven equal to the approved design", () => {
    expect(Arr.sort(Rec.keys(CASES), Order.String)).toEqual(
      Arr.sort(Rec.keys(DIGESTS), Order.String)
    );
  });

  it("pins a different picture for every case", () => {
    const digests = Arr.flatMap(Rec.values(DIGESTS), (digest) =>
      digest.split(" ")
    );
    expect(Arr.dedupe(digests)).toHaveLength(digests.length);
    expect(digests).toHaveLength(Arr.length(Arr.flatten(Rec.values(CASES))));
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

  it("stands at ease, facing right, in the middle of the window, when she is asked for nothing else", () => {
    expect(scene({ whole: true })).toEqual(
      scene({ act: "relaxed", side: "right", whole: true })
    );
    expect(scene({})).toEqual(scene({ lean: "center" }));
  });

  it("looks where she is asked to look, unless her act has somewhere to look of its own", () => {
    const LOOK = [2.5, -1.5] as const;
    expect(scene({ act: "relaxed", look: LOOK, whole: true })).not.toEqual(
      scene({ act: "relaxed", whole: true })
    );
    expect(scene({ act: "reading", look: LOOK, t: 1.1, whole: true })).toEqual(
      scene({ act: "reading", t: 1.1, whole: true })
    );
  });
});

describe("a line of hers that stands free of her body", () => {
  it("takes the color of the text around her, so it shows on a dark page as on a light one", () => {
    expect(freeLinesOf({ mood: "confused", whole: true })).toEqual([TEXT]);
    expect(freeLinesOf({ mood: "surprised", whole: true })).toEqual([
      TEXT,
      TEXT,
      TEXT,
    ]);
    expect(
      freeLinesOf({ act: "pointing", mood: "hello", whole: true })
    ).toEqual([TEXT, TEXT, TEXT]);
    expect(freeLinesOf({ lean: "peek", mood: "confused" })).toEqual([TEXT]);
    expect(freeLinesOf({ mood: "confused", side: "left" })).toEqual([TEXT]);
  });

  it("is drawn in her ink on the ground of a tile, which is hers and the same in every theme", () => {
    for (const tile of Rec.keys(POP)) {
      expect(freeLinesOf({ mood: "confused", tile }), tile).toEqual([NINA.ink]);
      expect(freeLinesOf({ mood: "surprised", tile }), tile).toEqual([
        NINA.ink,
        NINA.ink,
        NINA.ink,
      ]);
    }
  });

  it("is the only thing she draws in the color of the text", () => {
    expect(freeLinesOf({ mood: "hello", whole: true })).toEqual([]);
    expect(freeLinesOf({ mood: "asleep", tile: "blue" })).toEqual([]);
  });
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
      "the cut of overL does not lie on her own color",
    ]);
  });
});
