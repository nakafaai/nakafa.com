import { describe, expect, it } from "@effect/vitest";
import { Animal, DESIGNS } from "@repo/mascot/animal";
import { encode, Mascot, MascotCode } from "@repo/mascot/code";
import { draw } from "@repo/mascot/draw";
import { Eyes, type Layer } from "@repo/mascot/kit";
import { Pose } from "@repo/mascot/pose";
import { DIGESTS } from "@repo/mascot/test.fixture";
import { sha256Hex } from "@repo/utilities/digest";
import { encodeJsonText } from "@repo/utilities/json";
import {
  Array as Arr,
  Effect,
  Option,
  Record as Rec,
  Result,
  Schema,
  String as Str,
} from "effect";

const CAT = "cat.0.243e66.right.open";

/** How many hexadecimal digits of the SHA-256 a pinned digest keeps. */
const DIGEST_LENGTH = 8;

/**
 * Drawing, writing, and hashing all 3,672 pictures takes a fraction of a second
 * alone, and several seconds on a busy runner that also measures coverage. The
 * default five seconds is not a fact about the pictures, so this test names
 * its own limit.
 */
const PINNED_TIMEOUT = 60_000;

/** The mascot of a code that is known to be good. */
function mascotOf(code: string) {
  return Schema.decodeSync(MascotCode)(code);
}

/** The shapes of a picture that carry a mark, also those inside a group. A marked group counts once. */
function marked(shapes: readonly Layer[]): readonly Layer[] {
  return Arr.flatMap(shapes, (shape) => {
    if (shape.mark !== undefined) {
      return [shape];
    }
    return shape._tag === "g" ? marked(shape.children) : [];
  });
}

/** The horizontal centre of a marked eye: of its pupil, the first shape of an eye with a shine. */
function centreOf(shape: Layer): number {
  if (shape._tag === "g") {
    return Option.match(Arr.head(shape.children), {
      onNone: () => Number.NaN,
      onSome: centreOf,
    });
  }
  return "cx" in shape ? shape.cx : Number.NaN;
}

/** The horizontal centres of the marked eyes of a picture. */
function eyesOf(mascot: ReturnType<typeof mascotOf>) {
  return Arr.map(marked([draw(mascot)]), centreOf);
}

/** The colours that a picture fills its shapes with, also inside a group. */
function fills(shapes: readonly Layer[]): readonly string[] {
  return Arr.flatMap(shapes, (shape) => {
    if (shape._tag === "g") {
      return fills(shape.children);
    }
    return shape.fill === undefined ? [] : [shape.fill];
  });
}

/** The transforms of the groups of a picture, outermost first. */
function transforms(shapes: readonly Layer[]): readonly string[] {
  return Arr.flatMap(shapes, (shape) =>
    shape._tag === "g"
      ? [
          ...(shape.transform === undefined ? [] : [shape.transform]),
          ...transforms(shape.children),
        ]
      : []
  );
}

/** Every palette, pose, and eyes value of one animal, in the order that the fixture writes them. */
function picturesOf(animal: typeof Animal.Type) {
  return Arr.flatMap(
    Arr.range(0, DESIGNS[animal].colors.length - 1),
    (palette) =>
      Arr.flatMap(Pose.literals, (pose) =>
        Arr.map(Eyes.literals, (eyes) =>
          Mascot.make({ animal, eyes, ground: "243e66", palette, pose })
        )
      )
  );
}

/** The codes of the pictures of one animal that no longer draw what was pinned. */
const changedOf = Effect.fn("MascotTest.changedOf")(function* (
  animal: typeof Animal.Type
) {
  const mascots = picturesOf(animal);
  const pinned = Option.getOrElse(Rec.get(DIGESTS, animal), () => "");
  const drawn = yield* Effect.forEach(mascots, (mascot) =>
    Effect.map(
      sha256Hex(encodeJsonText(draw(mascot))),
      Str.slice(0, DIGEST_LENGTH)
    )
  );
  return Arr.length(mascots) * DIGEST_LENGTH === Str.length(pinned)
    ? Arr.filterMap(Arr.zip(mascots, drawn), ([mascot, digest], index) =>
        Str.slice(
          index * DIGEST_LENGTH,
          (index + 1) * DIGEST_LENGTH
        )(pinned) === digest
          ? Result.failVoid
          : Result.succeed(encode(mascot))
      )
    : [`${animal}: the fixture holds ${Str.length(pinned)} digits`];
});

describe("mascot/draw", () => {
  it("draws the same picture for the same mascot", () => {
    expect(draw(mascotOf(CAT))).toEqual(draw(mascotOf(CAT)));
  });

  it("draws another picture for other eyes, and for another pose", () => {
    const cat = draw(mascotOf(CAT));
    expect(draw(mascotOf("cat.0.243e66.right.smile"))).not.toEqual(cat);
    expect(draw(mascotOf("cat.0.243e66.left.open"))).not.toEqual(cat);
  });

  it("draws the chosen palette on the chosen ground", () => {
    const first = draw(mascotOf("cat.0.243e66.center.open"));
    const second = draw(mascotOf("cat.1.b9624b.center.open"));
    expect(Arr.head(fills([first]))).toEqual(Option.some("#243e66"));
    expect(Arr.head(fills([second]))).toEqual(Option.some("#b9624b"));
    expect(fills([first])).toEqual(
      expect.arrayContaining(["#ee8a4c", "#f4e6ce"])
    );
    expect(fills([second])).toEqual(
      expect.arrayContaining(["#c9d2dc", "#f6f4ef"])
    );
    expect(fills([second])).not.toContain("#ee8a4c");
  });

  it("stands the animal in its pose", () => {
    expect(transforms([draw(mascotOf(CAT))])).toEqual([
      "translate(134 218) rotate(-10) scale(1.16) translate(-100 -200)",
    ]);
    expect(transforms([draw(mascotOf("cat.0.243e66.center.open"))])).toEqual([
      "translate(100 204) rotate(0) scale(1.04) translate(-100 -200)",
    ]);
    expect(transforms([draw(mascotOf("cat.0.243e66.peek-left.open"))])).toEqual(
      ["translate(56 246) rotate(14) scale(1.14) translate(-100 -200)"]
    );
  });

  it("turns the open eyes the way the pose looks", () => {
    expect(eyesOf(mascotOf("cat.0.243e66.center.open"))).toEqual([74, 126]);
    expect(eyesOf(mascotOf("cat.0.243e66.left.open"))).toEqual([76.6, 128.6]);
    expect(eyesOf(mascotOf(CAT))).toEqual([71.4, 123.4]);
  });

  it("marks the two open eyes of every animal, so that they can follow the pointer", () => {
    const wrong = Arr.filter(
      Animal.literals,
      (animal) =>
        marked([draw(mascotOf(`${animal}.0.243e66.center.open`))]).length !== 2
    );
    expect(wrong).toEqual([]);
  });

  it("marks no eye of an animal that sleeps, except the panda and the civet, whose eyes stay open on their dark patches", () => {
    const awake = Arr.filter(
      Animal.literals,
      (animal) =>
        marked([draw(mascotOf(`${animal}.0.243e66.center.asleep`))]).length > 0
    );
    expect(awake).toEqual(["panda", "civet"]);
  });

  it.effect(
    "draws every animal in every palette, pose, and eyes value as it was pinned",
    () =>
      Effect.gen(function* () {
        expect(Rec.keys(DIGESTS)).toEqual(Animal.literals);
        const changed = yield* Effect.forEach(Animal.literals, changedOf, {
          concurrency: 8,
        });
        expect(Arr.flatten(changed)).toEqual([]);
      }),
    PINNED_TIMEOUT
  );
});
