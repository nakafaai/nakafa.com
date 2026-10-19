import { beforeEach, describe, expect, it } from "@effect/vitest";
import { CARD_TERM } from "@repo/backend/confect/identity/card";
import { CARD_NOW, issueFirst, redeemOn } from "@repo/backend/test/identity";
import { tenancyFixture } from "@repo/backend/test/tenancy";
import { Duration, Effect } from "effect";

const TERM = Duration.toMillis(CARD_TERM);

/** Fake timers keep the clock at one moment, so the term of a card is exact. */
beforeEach(() => {
  vi.useFakeTimers();
  vi.setSystemTime(CARD_NOW);
});

describe("identity/card term", () => {
  it.effect("refuses a card on the day its term ends", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const issued = yield* issueFirst(fixture);
      vi.setSystemTime(CARD_NOW + TERM);
      expect(yield* redeemOn(fixture, issued.code)).toEqual({
        outcome: "refused",
        reason: "expired",
      });
    })
  );

  it.effect("accepts a card one millisecond before its term ends", () =>
    Effect.gen(function* () {
      const fixture = yield* tenancyFixture;
      const issued = yield* issueFirst(fixture);
      vi.setSystemTime(CARD_NOW + TERM - 1);
      expect(yield* redeemOn(fixture, issued.code)).toMatchObject({
        outcome: "redeemed",
      });
    })
  );
});
