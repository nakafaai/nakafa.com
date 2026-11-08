import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { TryoutResponseError } from "@repo/backend/confect/tryouts/response/spec";
import { Cause, Effect, Schema } from "effect";
import { KeyValueStore } from "effect/persistence";
import { TestClock } from "effect/testing";
import {
  keptPicks,
  pickCopy,
  pickRefusal,
} from "@/components/tryout/runtime/response/keep";

const PLACEMENT = Schema.decodeUnknownSync(Id("tryoutAttemptPlacements"))(
  "placement-a"
);

/** A refusal of the save that carries `code`, as the page decodes it. */
const refusal = (
  code: "TRYOUT_EXPIRED" | "TRYOUT_RESPONSE_FAILED" | "TRYOUT_RESPONSE_STALE"
) => new TryoutResponseError({ code, message: "Refused." });

describe("keptPicks", () => {
  it.effect(
    "keeps a pick and a cleared answer until the server confirms them, so a reload sends them again",
    () =>
      Effect.gen(function* () {
        yield* TestClock.setTime(4);
        const pick = yield* keptPicks.keep(PLACEMENT, {
          response: ["option-b"],
          version: 3,
        });
        // A pick made while the connection was down never reached the server: the next page finds it.
        expect(yield* keptPicks.answersFor([PLACEMENT])).toEqual([
          { answer: pick, questionId: PLACEMENT },
        ]);
        yield* TestClock.setTime(5);
        const cleared = yield* keptPicks.keep(PLACEMENT, {
          response: null,
          version: 4,
        });
        expect(yield* keptPicks.answersFor([PLACEMENT])).toEqual([
          { answer: cleared, questionId: PLACEMENT },
        ]);
        yield* keptPicks.confirm(PLACEMENT, 5);
        expect(yield* keptPicks.answersFor([PLACEMENT])).toEqual([]);
      }).pipe(Effect.provide(KeyValueStore.layerMemory))
  );
});

describe("pickRefusal", () => {
  it("says nothing of a pick a newer write overtook, drops one an ended attempt refused, and keeps any other", () => {
    expect(pickRefusal(refusal("TRYOUT_RESPONSE_STALE"))).toBe("quiet");
    expect(pickRefusal(refusal("TRYOUT_EXPIRED"))).toBe("final");
    expect(pickRefusal(refusal("TRYOUT_RESPONSE_FAILED"))).toBe("failed");
    expect(pickRefusal(new Cause.UnknownError("offline"))).toBe("failed");
  });
});

describe("pickCopy", () => {
  it("asks the learner to start again after an ended attempt, and says any other pick did not save", () => {
    expect(pickCopy(refusal("TRYOUT_EXPIRED"))).toEqual({
      description: "tryout-attempt-not-in-progress.description",
      title: "tryout-attempt-not-in-progress.title",
    });
    expect(pickCopy(new Cause.UnknownError("offline"))).toEqual({
      description: "tryout-submit-answer-error.description",
      title: "tryout-submit-answer-error.title",
    });
  });
});
