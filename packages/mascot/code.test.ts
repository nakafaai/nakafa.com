import { describe, expect, it } from "@effect/vitest";
import { Animal, DESIGNS } from "@repo/mascot/animal";
import { encode, Mascot, MascotCode } from "@repo/mascot/code";
import { Eyes } from "@repo/mascot/kit";
import { Pose } from "@repo/mascot/pose";
import { Array as Arr, Result, Schema } from "effect";

const CODE = "cat.0.243e66.right.open";

/** Reads a stored text the way the backend reads it: a mascot, or a failure. */
const decodeCode = Schema.decodeUnknownResult(MascotCode);

/** Every animal in every one of its palettes, in every pose and with every eyes value. */
const EVERY = Arr.flatMap(Animal.literals, (animal) =>
  Arr.flatMap(DESIGNS[animal].colors, (_, palette) =>
    Arr.flatMap(Pose.literals, (pose) =>
      Arr.map(Eyes.literals, (eyes) =>
        Mascot.make({ animal, eyes, ground: "243e66", palette, pose })
      )
    )
  )
);

describe("mascot/code", () => {
  it("reads the parts of a code", () => {
    expect(Schema.decodeSync(MascotCode)(CODE)).toEqual({
      animal: "cat",
      eyes: "open",
      ground: "243e66",
      palette: 0,
      pose: "right",
    });
  });

  it("writes a mascot as animal.palette.ground.pose.eyes", () => {
    expect(
      encode({
        animal: "owl",
        eyes: "wink",
        ground: "f4e6ce",
        palette: 2,
        pose: "peek-left",
      })
    ).toBe("owl.2.f4e6ce.peek-left.wink");
  });

  it("reads back every mascot it writes: every animal, palette, pose, and eyes value", () => {
    expect(EVERY).toHaveLength(3672);
    const lost = Arr.filter(EVERY, (mascot) =>
      Result.match(decodeCode(encode(mascot)), {
        onFailure: () => true,
        onSuccess: (read) => encode(read) !== encode(mascot),
      })
    );
    expect(lost).toEqual([]);
  });

  it.each([
    ["an animal that does not exist", "dragon.0.243e66.right.open"],
    ["a pose that does not exist", "cat.0.243e66.flying.open"],
    ["an eyes value that does not exist", "cat.0.243e66.right.angry"],
    ["a palette that the animal does not have", "sheep.2.243e66.right.open"],
    ["a palette with a leading zero", "cat.00.243e66.right.open"],
    ["a palette with a sign", "cat.+1.243e66.right.open"],
    ["a palette in exponent form", "cat.1e0.243e66.right.open"],
    ["a ground that is not one of the grounds", "cat.0.123456.right.open"],
    ["a ground in upper case", "cat.0.243E66.right.open"],
    ["a ground with a #", "cat.0.#243e66.right.open"],
    ["a ground of five digits", "cat.0.243e6.right.open"],
    ["a missing part", "cat.0.243e66.right"],
    ["an extra part", "cat.0.243e66.right.open.extra"],
    ["a space before the code", " cat.0.243e66.right.open"],
    ["an empty code", ""],
  ])("fails to read %s", (_what, code) => {
    expect(Result.isFailure(decodeCode(code))).toBe(true);
  });

  it("fails for a value that is not text", () => {
    for (const input of [42, null, undefined, {}, [CODE]]) {
      expect(Result.isFailure(decodeCode(input))).toBe(true);
    }
  });

  it("says which palette an animal lacks", () => {
    expect(decodeCode("sheep.2.243e66.right.open")).toMatchObject({
      failure: { message: expect.stringContaining("sheep has no palette 2") },
    });
  });

  it("does not make a mascot on a colour that is not one of the grounds", () => {
    const cat = {
      animal: "cat",
      eyes: "open",
      palette: 0,
      pose: "right",
    } as const;
    expect(Schema.is(Mascot)({ ...cat, ground: "243e66" })).toBe(true);
    expect(Schema.is(Mascot)({ ...cat, ground: "123456" })).toBe(false);
  });

  it("does not make a mascot with a palette that its animal lacks", () => {
    const sheep = {
      animal: "sheep",
      eyes: "open",
      ground: "243e66",
      pose: "right",
    } as const;
    expect(Schema.is(Mascot)({ ...sheep, palette: 1 })).toBe(true);
    expect(Schema.is(Mascot)({ ...sheep, palette: 2 })).toBe(false);
    expect(() => Mascot.make({ ...sheep, palette: 2 })).toThrow();
  });
});
