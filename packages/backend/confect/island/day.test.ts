import { describe, expect, it } from "@effect/vitest";
import { todayOf } from "@repo/backend/confect/island/day";
import { DateTime, Effect } from "effect";
import { TestClock } from "effect/testing";

describe("island/day", () => {
  it.effect("reads today in the island's own zone", () =>
    Effect.gen(function* () {
      yield* TestClock.setTime(Date.UTC(2026, 10, 8, 20, 0, 0));
      expect(yield* todayOf(DateTime.zoneMakeNamedUnsafe("Asia/Jakarta"))).toBe(
        "2026-11-09"
      );
      expect(yield* todayOf(DateTime.zoneMakeNamedUnsafe("UTC"))).toBe(
        "2026-11-08"
      );
    })
  );
});
