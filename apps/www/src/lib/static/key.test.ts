import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { staticCallKey } from "@/lib/static/key";

/** A lower-case SHA-256 digest in hexadecimal. */
const SHA_256_HEX = /^[0-9a-f]{64}$/;

describe("lib/static/key", () => {
  it.effect(
    "keys one call the same way every time, and another input apart",
    () =>
      Effect.gen(function* () {
        const first = yield* staticCallKey("/_serverFn/messages", {
          locale: "id",
        });
        const again = yield* staticCallKey("/_serverFn/messages", {
          locale: "id",
        });
        const other = yield* staticCallKey("/_serverFn/messages", {
          locale: "en",
        });

        expect(first).toMatch(SHA_256_HEX);
        expect(again).toBe(first);
        expect(other).not.toBe(first);
      })
  );
});
