import { describe, expect, it } from "@effect/vitest";
import {
  drawCardCode,
  hashCardCode,
} from "@repo/backend/confect/identity/secret";
import { ConfigProvider, Effect } from "effect";

const CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{10}$/;
const HEX_DIGEST_PATTERN = /^[0-9a-f]{64}$/;

describe("identity/secret", () => {
  it.effect("draws a ten character code made of the alphabet", () =>
    Effect.gen(function* () {
      const code = yield* drawCardCode();
      expect(code).toMatch(CODE_PATTERN);
      expect(yield* drawCardCode()).not.toBe(code);
    })
  );

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
