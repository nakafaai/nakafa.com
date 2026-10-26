import { describe, expect, it } from "@effect/vitest";
import {
  drawCardCode,
  drawGuardianCode,
  hashCardCode,
  hashGuardianCode,
} from "@repo/backend/confect/identity/secret";
import { Array as Arr, ConfigProvider, Effect } from "effect";

const CODE_PATTERN = /^[0-9A-HJKMNP-TV-Z]{10}$/;
const HEX_DIGEST_PATTERN = /^[0-9a-f]{64}$/;
const SIX_DIGITS = /^\d{6}$/;

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

describe("identity/secret guardian codes", () => {
  it.effect("draws six digits", () =>
    Effect.gen(function* () {
      const codes = yield* Effect.all(
        Arr.makeBy(20, () => drawGuardianCode())
      );
      for (const code of codes) {
        expect(code).toMatch(SIX_DIGITS);
      }
      expect(Arr.dedupe(codes).length).toBeGreaterThan(1);
    })
  );

  it.effect(
    "binds a guardian code to its school and address, apart from a card hash",
    () =>
      Effect.gen(function* () {
        const first = yield* hashGuardianCode("t1", "ibu@example.com", "123456");
        expect(first).toMatch(HEX_DIGEST_PATTERN);
        expect(
          yield* hashGuardianCode("t1", "ibu@example.com", "123456")
        ).toBe(first);
        expect(
          yield* hashGuardianCode("t2", "ibu@example.com", "123456")
        ).not.toBe(first);
        expect(
          yield* hashGuardianCode("t1", "ayah@example.com", "123456")
        ).not.toBe(first);
        expect(yield* hashCardCode("123456")).not.toBe(first);
      })
  );
});
