import { describe, expect, it } from "@effect/vitest";
import {
  codeFromBytes,
  drawCardCode,
  formatCardCode,
  hashCardCode,
  readCardCode,
} from "@repo/backend/confect/identity/code";
import { Array as Arr, ConfigProvider, Effect, Option } from "effect";

const CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{10}$/;
const HEX_DIGEST_PATTERN = /^[0-9a-f]{64}$/;

describe("identity/code", () => {
  it("maps each random byte to one character of the alphabet", () => {
    expect(codeFromBytes(Uint8Array.of(0, 1, 31, 32, 255))).toBe("01Z0Z");
  });

  it("reads back every character the alphabet draws", () => {
    // Every byte value, so each character that the modulus can pick is drawn.
    const drawn = Arr.makeBy(256, (byte) =>
      codeFromBytes(Uint8Array.from(Arr.replicate(byte, 10)))
    );
    expect(Arr.map(drawn, readCardCode)).toEqual(Arr.map(drawn, Option.some));
  });

  it.effect("draws a ten character code made of the alphabet", () =>
    Effect.gen(function* () {
      const code = yield* drawCardCode();
      expect(code).toMatch(CODE_PATTERN);
      expect(yield* drawCardCode()).not.toBe(code);
    })
  );

  it("shows a code as two groups of five joined by a dash", () => {
    expect(formatCardCode("0123456789")).toBe("01234-56789");
  });

  it("reads a typed code with or without the dash, in any case", () => {
    expect(readCardCode("01234-56789")).toEqual(Option.some("0123456789"));
    expect(readCardCode("01234 56789")).toEqual(Option.some("0123456789"));
    expect(readCardCode(" 0123a-5678b ")).toEqual(Option.some("0123A5678B"));
  });

  it("reads O as 0 and I and L as 1, in either case", () => {
    expect(readCardCode("0123O-56789")).toEqual(Option.some("0123056789"));
    expect(readCardCode("0123o-56789")).toEqual(Option.some("0123056789"));
    expect(readCardCode("I123456789")).toEqual(Option.some("1123456789"));
    expect(readCardCode("i123456789")).toEqual(Option.some("1123456789"));
    expect(readCardCode("L123456789")).toEqual(Option.some("1123456789"));
    expect(readCardCode("l123456789")).toEqual(Option.some("1123456789"));
  });

  it("refuses U in either case, because the alphabet leaves it out", () => {
    expect(readCardCode("0123U-56789")).toEqual(Option.none());
    expect(readCardCode("0123u-56789")).toEqual(Option.none());
  });

  it("refuses a typed code of the wrong length or with other characters", () => {
    expect(readCardCode("01234")).toEqual(Option.none());
    expect(readCardCode("012345678901")).toEqual(Option.none());
    expect(readCardCode("01234!56789")).toEqual(Option.none());
  });

  it.effect(
    "hashes one code to the same digest, and another digest under another secret",
    () =>
      Effect.gen(function* () {
        const first = yield* hashCardCode("0123456789");
        expect(first).toMatch(HEX_DIGEST_PATTERN);
        expect(yield* hashCardCode("0123456789")).toBe(first);
        expect(yield* hashCardCode("0123456788")).not.toBe(first);
        const underOtherSecret = yield* hashCardCode("0123456789").pipe(
          Effect.provide(
            ConfigProvider.layer(
              ConfigProvider.fromUnknown({
                LOGIN_CARD_SECRET: "another-secret",
              })
            )
          )
        );
        expect(underOtherSecret).not.toBe(first);
      })
  );
});
