import { describe, expect, it } from "@effect/vitest";
import { Animal, DESIGNS } from "@repo/mascot/animal";
import { decode, encode, Mascot, MascotCodeError } from "@repo/mascot/code";
import { Eyes } from "@repo/mascot/kit";
import { Pose } from "@repo/mascot/pose";
import { Array as Arr, Result, Schema } from "effect";

const CODE = "kucing.0.243e66.kanan.titik";

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
    expect(decode(CODE)).toEqual(
      Result.succeed({
        animal: "kucing",
        eyes: "titik",
        ground: "243e66",
        palette: 0,
        pose: "kanan",
      })
    );
  });

  it("writes a mascot as animal.palette.ground.pose.eyes", () => {
    expect(
      encode({
        animal: "burung-hantu",
        eyes: "kedip",
        ground: "f4e6ce",
        palette: 2,
        pose: "intip-kiri",
      })
    ).toBe("burung-hantu.2.f4e6ce.intip-kiri.kedip");
  });

  it("reads back every mascot it writes: every animal, palette, pose, and eyes value", () => {
    expect(EVERY).toHaveLength(3672);
    const lost = Arr.filter(EVERY, (mascot) =>
      Result.match(decode(encode(mascot)), {
        onFailure: () => true,
        onSuccess: (read) => encode(read) !== encode(mascot),
      })
    );
    expect(lost).toEqual([]);
    expect(decode(encode(EVERY[100]))).toEqual(Result.succeed(EVERY[100]));
  });

  it.each([
    ["an animal that does not exist", "naga.0.243e66.kanan.titik"],
    ["a pose that does not exist", "kucing.0.243e66.terbang.titik"],
    ["an eyes value that does not exist", "kucing.0.243e66.kanan.marah"],
    ["a palette that the animal does not have", "domba.2.243e66.kanan.titik"],
    ["a palette with a leading zero", "kucing.00.243e66.kanan.titik"],
    ["a palette with a sign", "kucing.+1.243e66.kanan.titik"],
    ["a palette in exponent form", "kucing.1e0.243e66.kanan.titik"],
    ["a ground in upper case", "kucing.0.243E66.kanan.titik"],
    ["a ground with a #", "kucing.0.#243e66.kanan.titik"],
    ["a ground of five digits", "kucing.0.243e6.kanan.titik"],
    ["a missing part", "kucing.0.243e66.kanan"],
    ["an extra part", "kucing.0.243e66.kanan.titik.extra"],
    ["a space before the code", " kucing.0.243e66.kanan.titik"],
    ["an empty code", ""],
  ])("fails with a MascotCodeError for %s", (_what, code) => {
    expect(decode(code)).toMatchObject({
      _tag: "Failure",
      failure: expect.any(MascotCodeError),
    });
  });

  it("fails for a value that is not text", () => {
    for (const input of [42, null, undefined, {}, [CODE]]) {
      expect(decode(input)).toMatchObject({
        _tag: "Failure",
        failure: expect.any(MascotCodeError),
      });
    }
  });

  it("says which palette an animal lacks", () => {
    expect(decode("domba.2.243e66.kanan.titik")).toMatchObject({
      failure: { message: expect.stringContaining("domba has no palette 2") },
    });
  });

  it("does not make a mascot with a palette that its animal lacks", () => {
    const sheep = {
      animal: "domba",
      eyes: "titik",
      ground: "243e66",
      pose: "kanan",
    } as const;
    expect(Schema.is(Mascot)({ ...sheep, palette: 1 })).toBe(true);
    expect(Schema.is(Mascot)({ ...sheep, palette: 2 })).toBe(false);
    expect(() => Mascot.make({ ...sheep, palette: 2 })).toThrow();
  });
});
