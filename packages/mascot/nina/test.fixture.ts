import { ActSchema } from "@repo/mascot/nina/act";
import { EdgeSchema } from "@repo/mascot/nina/edge";
import { MoodSchema } from "@repo/mascot/nina/face";
import { scene } from "@repo/mascot/nina/figure";
import type { Options } from "@repo/mascot/nina/options";
import { sha256Hex } from "@repo/utilities/digest";
import {
  Array as Arr,
  Effect,
  Record as Rec,
  Schema,
  String as Str,
} from "effect";

const SIDES = ["right", "left"] as const;
const LEANS = ["right", "left", "center"] as const;
/** None of these is the moment that shows an act best, so no picture is pinned twice. */
const TIMES = [0, 0.55, 1.1, 2.9, 3.7, 6.2, 9.4];
const EDGE_TIMES = [0, 0.4, 1.3];
const LOOK = [2.5, -1.5] as const;

/**
 * Every picture of her that the fixture pins, in groups: all of her in each act
 * and on each side, at the moment that shows the act best and at seven others;
 * each face in a tile and over an edge, on each side; each act over an edge;
 * and a few single pictures for a face that beats the face of the act, a look
 * that the act lets her have, and a ground. Every picture is a different one.
 */
export const CASES: Readonly<Record<string, readonly Options[]>> = {
  ...Rec.fromEntries(
    Arr.flatMap(ActSchema.literals, (act) =>
      Arr.map(SIDES, (side): [string, readonly Options[]] => [
        `whole.${act}.${side}`,
        [
          { act, side, whole: true },
          ...Arr.map(TIMES, (t): Options => ({ act, side, t, whole: true })),
        ],
      ])
    )
  ),
  ...Rec.fromEntries(
    Arr.flatMap(MoodSchema.literals, (mood) =>
      Arr.map(SIDES, (side): [string, readonly Options[]] => [
        `tile.${mood}.${side}`,
        [
          ...Arr.map(
            LEANS,
            (lean): Options => ({ lean, mood, side, tile: "cream" })
          ),
          { lean: "peek", mood, side, tile: "yellow" },
        ],
      ])
    )
  ),
  ...Rec.fromEntries(
    Arr.flatMap(EdgeSchema.literals, (act) =>
      Arr.map(SIDES, (side): [string, readonly Options[]] => [
        `edge.${act}.${side}`,
        [
          { act, lean: "peek", side },
          ...Arr.map(
            EDGE_TIMES,
            (t): Options => ({ act, lean: "peek", side, t })
          ),
        ],
      ])
    )
  ),
  "single.whole.mood": [{ act: "waving", mood: "sad", whole: true }],
  "single.whole.shy": [{ act: "relaxed", mood: "shy", whole: true }],
  "single.whole.look": [{ act: "relaxed", look: LOOK, whole: true }],
  "single.whole.look.left": [
    { act: "relaxed", look: LOOK, side: "left", whole: true },
  ],
  "single.waving.look": [{ act: "waving", look: LOOK, t: 1.1, whole: true }],
  "single.cheering.look.left": [
    { act: "cheering", look: LOOK, side: "left", t: 2.9, whole: true },
  ],
  "single.tile.look": [{ lean: "right", look: LOOK, tile: "blue" }],
  "single.tile.look.left": [
    { lean: "left", look: LOOK, side: "left", tile: "green" },
  ],
  "single.tile.orange": [{ lean: "center", tile: "orange" }],
  "single.tile": [{}],
  "single.peek.mood": [{ lean: "peek", mood: "curious", t: 0.7 }],
  "single.peek.mood.act": [
    { act: "greeting", lean: "peek", mood: "sad", t: 0.3 },
  ],
  "single.peek.look": [{ act: "greeting", lean: "peek", look: LOOK, t: 0.3 }],
};

/** Every way to take one variation from each of two lists, put into one object. */
function mix<A extends object, B extends object>(
  first: readonly A[],
  second: readonly B[]
) {
  return Arr.cartesianWith(first, second, (a, b) => ({ ...a, ...b }));
}

/** What changes a still picture of her, apart from the act and the window: side, face, look and moment. */
const VARIATIONS = mix(
  [{}, { side: "left" }] as const,
  mix(
    [{}, { mood: "shy" }] as const,
    mix([{}, { look: LOOK }] as const, [{}, { t: 0.7 }] as const)
  )
);

/**
 * Every set of options that asks for her: each act of the whole figure, and
 * each act over an edge in each way she can stand there, with and without a
 * side, a face, a look, a moment and a ground. A test that holds for a still
 * picture and for her life holds for all of them.
 */
export const EVERY_OPTIONS: readonly Options[] = [
  ...Arr.flatMap(ActSchema.literals, (act) =>
    Arr.map(VARIATIONS, (rest): Options => ({ act, whole: true, ...rest }))
  ),
  ...Arr.flatMap(EdgeSchema.literals, (act) =>
    Arr.flatMap([...LEANS, "peek"] as const, (lean) =>
      Arr.map(
        mix(VARIATIONS, [{}, { tile: "blue" }] as const),
        (rest): Options => ({ act, lean, ...rest })
      )
    )
  ),
];

const encodeJson = Schema.encodeEffect(Schema.fromJsonString(Schema.Unknown));

/**
 * The digest of one picture: the SHA-256 of its window and its shapes, written
 * as JSON, cut to 12 hexadecimal digits.
 */
export const digestOf = Effect.fn("nina.digestOf")(function* (
  options: Options
) {
  const text = yield* encodeJson(scene(options));
  return Str.slice(0, 12)(yield* sha256Hex(text));
});

/**
 * The pin of one group of pictures: the digest of their digests, in order,
 * cut to 12 hexadecimal digits. One changed picture changes the pin of its
 * group, and a group stays one line however many pictures it holds.
 */
export const pinOf = Effect.fn("nina.pinOf")(function* (
  group: readonly Options[]
) {
  const digests = yield* Effect.forEach(group, digestOf);
  return Str.slice(0, 12)(yield* sha256Hex(Arr.join(digests, " ")));
});
