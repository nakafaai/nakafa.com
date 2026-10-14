import { describe, expect, it } from "@effect/vitest";
import {
  issueSecret,
  matchesClientSecret,
} from "@repo/backend/confect/integrations/secret";
import { sha256Hex } from "@repo/utilities/digest";
import { Effect } from "effect";

/** A base64url text of 32 random bytes, which is 43 characters without padding. */
const BASE64URL_OF_32_BYTES = /^[A-Za-z0-9_-]{43}$/;

describe("integrations/secret", () => {
  it.effect(
    "draws a random secret and keeps only the SHA-256 digest of it",
    () =>
      Effect.gen(function* () {
        const first = yield* issueSecret();
        const second = yield* issueSecret();
        expect(first.secret).toMatch(BASE64URL_OF_32_BYTES);
        expect(second.secret).not.toBe(first.secret);
        expect(first.hash).toBe(yield* sha256Hex(first.secret));
        expect(first.hash).not.toBe(first.secret);
      })
  );

  it.effect("matches only the secret whose digest is stored", () =>
    Effect.gen(function* () {
      const issued = yield* issueSecret();
      const other = yield* issueSecret();
      expect(yield* matchesClientSecret(issued.secret, issued.hash)).toBe(true);
      expect(yield* matchesClientSecret(other.secret, issued.hash)).toBe(false);
      // The stored digest is not itself a credential.
      expect(yield* matchesClientSecret(issued.hash, issued.hash)).toBe(false);
    })
  );
});
