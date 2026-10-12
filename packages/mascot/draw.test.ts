import { describe, expect, it } from "@effect/vitest";
import { Animal, DESIGNS } from "@repo/mascot/animal";
import { decode } from "@repo/mascot/code";
import { draw } from "@repo/mascot/draw";
import { Eyes } from "@repo/mascot/kit";
import { Picture } from "@repo/mascot/shape";
import { Array as Arr, Result, Schema } from "effect";

/** The mascot of a code that is known to be good. */
function mascotOf(code: string) {
  return Result.getOrThrow(decode(code));
}

/** The horizontal centres of the open eyes of a picture. */
function openEyes(picture: ReturnType<typeof draw>) {
  return Arr.filterMap(picture.parts, (part) =>
    part._tag === "Eye" ? Result.succeed(part.cx) : Result.failVoid
  );
}

/** The colours that a picture fills its layers with. */
function fills(picture: ReturnType<typeof draw>) {
  return Arr.dedupe(
    Arr.filterMap(picture.parts, (part) =>
      "fill" in part ? Result.succeed(part.fill) : Result.failVoid
    )
  );
}

const CAT = "kucing.0.243e66.kanan.titik";

describe("mascot/draw", () => {
  it("draws the same picture for the same mascot", () => {
    expect(draw(mascotOf(CAT))).toEqual(draw(mascotOf(CAT)));
  });

  it("draws another picture for other eyes, and for another pose", () => {
    const cat = draw(mascotOf(CAT));
    expect(draw(mascotOf("kucing.0.243e66.kanan.senyum"))).not.toEqual(cat);
    expect(draw(mascotOf("kucing.0.243e66.kiri.titik"))).not.toEqual(cat);
  });

  it("draws the chosen palette on the chosen ground", () => {
    const first = draw(mascotOf("kucing.0.243e66.tengah.titik"));
    const second = draw(mascotOf("kucing.1.b9624b.tengah.titik"));
    expect(first.ground).toBe("#243e66");
    expect(second.ground).toBe("#b9624b");
    expect(fills(first)).toEqual(
      expect.arrayContaining(["#ee8a4c", "#f4e6ce"])
    );
    expect(fills(second)).toEqual(
      expect.arrayContaining(["#c9d2dc", "#f6f4ef"])
    );
    expect(fills(second)).not.toContain("#ee8a4c");
  });

  it("stands the animal in its pose", () => {
    expect(draw(mascotOf(CAT)).transform).toBe(
      "translate(134 218) rotate(-10) scale(1.16) translate(-100 -200)"
    );
    expect(draw(mascotOf("kucing.0.243e66.tengah.titik")).transform).toBe(
      "translate(100 204) rotate(0) scale(1.04) translate(-100 -200)"
    );
    expect(draw(mascotOf("kucing.0.243e66.intip-kiri.titik")).transform).toBe(
      "translate(56 246) rotate(14) scale(1.14) translate(-100 -200)"
    );
  });

  it("turns the open eyes the way the pose looks", () => {
    expect(openEyes(draw(mascotOf("kucing.0.243e66.tengah.titik")))).toEqual([
      74, 126,
    ]);
    expect(openEyes(draw(mascotOf("kucing.0.243e66.kiri.titik")))).toEqual([
      76.6, 128.6,
    ]);
    expect(openEyes(draw(mascotOf("kucing.0.243e66.kanan.titik")))).toEqual([
      71.4, 123.4,
    ]);
  });

  it("marks the two open eyes of every animal, so that they can follow the pointer", () => {
    const wrong = Arr.filter(
      Animal.literals,
      (animal) =>
        openEyes(draw(mascotOf(`${animal}.0.243e66.tengah.titik`))).length !== 2
    );
    expect(wrong).toEqual([]);
  });

  it("draws a picture that satisfies its schema, for every animal and every eyes value", () => {
    const isPicture = Schema.is(Picture);
    const invalid = Arr.flatMap(Animal.literals, (animal) =>
      Arr.filter(Eyes.literals, (eyes) =>
        Arr.some(
          Arr.range(0, DESIGNS[animal].colors.length - 1),
          (palette) =>
            !isPicture(
              draw(mascotOf(`${animal}.${palette}.243e66.kanan.${eyes}`))
            )
        )
      )
    );
    expect(invalid).toEqual([]);
  });
});
