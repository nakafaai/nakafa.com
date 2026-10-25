import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { staticCallKey } from "@/lib/static/key";

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

        expect(first).toMatch(/^[0-9a-f]{64}$/);
        expect(again).toBe(first);
        expect(other).not.toBe(first);
      })
  );
});
