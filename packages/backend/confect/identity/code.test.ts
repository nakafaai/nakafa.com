import { describe, expect, it } from "@effect/vitest";
import {
  codeFromBytes,
  drawCardCode,
  formatCardCode,
  hashCardCode,
  readCardCode,
} from "@repo/backend/confect/identity/code";
import { ConfigProvider, Effect, Option } from "effect";

const CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{10}$/;
const HEX_DIGEST_PATTERN = /^[0-9a-f]{64}$/;

describe("identity/code", () => {
  it("maps each random byte to one character of the alphabet", () => {
    expect(codeFromBytes(Uint8Array.of(0, 1, 31, 32, 255))).toBe("01Z0Z");
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

  it("refuses a typed code with a letter the alphabet leaves out", () => {
    for (const letter of ["I", "L", "O", "U"]) {
      expect(readCardCode(`0123${letter}-56789`)).toEqual(Option.none());
    }
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
