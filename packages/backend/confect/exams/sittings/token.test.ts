import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import {
  drawToken,
  drawTokenFrom,
  normalizeToken,
  tokenHash,
} from "@repo/backend/confect/exams/sittings/token";
import { deriveKeys } from "@repo/backend/confect/vault/cipher";
import { Effect, Schema } from "effect";

/** A token: six characters, none of them I, O, 0, or 1 (ADR 0013). */
const TOKEN = /^[ABCDEFGHJKLMNPQRSTUVWXYZ23456789]{6}$/u;

/** A hash: 22 URL-safe characters, the text of 16 bytes in Base64Url. */
const BASE64URL_22 = /^[A-Za-z0-9_-]{22}$/u;

const tenant = Schema.decodeUnknownSync(Id("tenants"))("tenant-a");

/** School keys shaped as `readTenantKeys` returns them, derived from one key byte. */
const keysFrom = (fill: number) =>
  deriveKeys(new Uint8Array(32).fill(fill)).pipe(
    Effect.map((derived) => ({ ...derived, generation: 1, tenantId: tenant }))
  );

describe("exams/sittings token", () => {
  it.effect("draws six characters of the alphabet from a seed", () =>
    Effect.gen(function* () {
      expect(yield* drawTokenFrom(new Uint8Array(32).fill(1))).toMatch(TOKEN);
    })
  );

  it.effect(
    "draws the same token from the same seed and another from another seed",
    () =>
      Effect.gen(function* () {
        const first = yield* drawTokenFrom(new Uint8Array(32).fill(1));
        const again = yield* drawTokenFrom(new Uint8Array(32).fill(1));
        const other = yield* drawTokenFrom(new Uint8Array(32).fill(2));
        expect(again).toBe(first);
        expect(other).not.toBe(first);
      })
  );

  it.effect("draws a token from the platform random source", () =>
    Effect.gen(function* () {
      expect(yield* drawToken()).toMatch(TOKEN);
    })
  );

  it("trims a token and upper-cases it before it is compared", () => {
    expect(normalizeToken("  k7q4xm ")).toBe("K7Q4XM");
    expect(normalizeToken("K7Q4XM")).toBe("K7Q4XM");
  });

  it.effect(
    "hashes a token to 22 URL-safe characters that verify only for their sitting and key",
    () =>
      Effect.gen(function* () {
        const keys = yield* keysFrom(1);
        const hash = yield* tokenHash(keys, "sitting-a", "K7Q4XM");
        expect(hash).toMatch(BASE64URL_22);
        expect(yield* tokenHash(keys, "sitting-a", "K7Q4XM")).toBe(hash);
        expect(yield* tokenHash(keys, "sitting-b", "K7Q4XM")).not.toBe(hash);
        expect(yield* tokenHash(keys, "sitting-a", "K7Q4XN")).not.toBe(hash);
        expect(
          yield* tokenHash(yield* keysFrom(2), "sitting-a", "K7Q4XM")
        ).not.toBe(hash);
      })
  );
});
