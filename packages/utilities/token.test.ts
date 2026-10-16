import { describe, expect, it } from "@effect/vitest";
import { sha256Hex } from "@repo/utilities/digest";
import { issueToken, matchesToken } from "@repo/utilities/token";
import { Effect } from "effect";

/** A Base64Url text of 32 random bytes, which is 43 characters without padding. */
const BASE64URL_OF_32_BYTES = /^[A-Za-z0-9_-]{43}$/;

describe("utilities/token", () => {
  it.effect(
    "draws a random token and keeps only the SHA-256 digest of it",
    () =>
      Effect.gen(function* () {
        const first = yield* issueToken();
        const second = yield* issueToken();
        expect(first.token).toMatch(BASE64URL_OF_32_BYTES);
        expect(second.token).not.toBe(first.token);
        expect(first.hash).toBe(yield* sha256Hex(first.token));
        expect(first.hash).not.toBe(first.token);
      })
  );

  it.effect("matches only the token whose digest is stored", () =>
    Effect.gen(function* () {
      const issued = yield* issueToken();
      const other = yield* issueToken();
      expect(yield* matchesToken(issued.token, issued.hash)).toBe(true);
      expect(yield* matchesToken(other.token, issued.hash)).toBe(false);
      // The stored digest is not itself a credential.
      expect(yield* matchesToken(issued.hash, issued.hash)).toBe(false);
    })
  );
});
