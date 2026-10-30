import { describe, expect, it } from "@effect/vitest";
import { Id } from "@repo/backend/confect/_generated/id";
import { TryoutResponseError } from "@repo/backend/confect/tryouts/response/spec";
import { Cause, Effect, Schema } from "effect";
import { KeyValueStore } from "effect/persistence";
import {
  isFinalPickRefusal,
  keptPicks,
} from "@/components/tryout/runtime/response/keep";

const PLACEMENT = Schema.decodeUnknownSync(Id("tryoutAttemptPlacements"))(
  "placement-a"
);

/** A refusal of the save that carries `code`, as the page decodes it. */
const refusal = (code: "TRYOUT_RESPONSE_FAILED" | "TRYOUT_RESPONSE_STALE") =>
  new TryoutResponseError({ code, message: "Refused." });

describe("keptPicks", () => {
  it.effect(
    "keeps a pick and a cleared answer until the server confirms them, so a reload sends them again",
    () =>
      Effect.gen(function* () {
        const pick = {
          answeredAt: 4,
          response: { kind: "single-choice" as const, optionKey: "option-b" },
          version: 3,
        };
        yield* keptPicks.keep(PLACEMENT, pick);
        // A pick made while the connection was down never reached the server: the next page finds it.
        expect(yield* keptPicks.answersFor([PLACEMENT])).toEqual([
          { answer: pick, questionId: PLACEMENT },
        ]);
        const cleared = { answeredAt: 5, response: null, version: 4 };
        yield* keptPicks.keep(PLACEMENT, cleared);
        expect(yield* keptPicks.answersFor([PLACEMENT])).toEqual([
          { answer: cleared, questionId: PLACEMENT },
        ]);
        yield* keptPicks.confirm(PLACEMENT, 5);
        expect(yield* keptPicks.answersFor([PLACEMENT])).toEqual([]);
      }).pipe(Effect.provide(KeyValueStore.layerMemory))
  );
});

describe("isFinalPickRefusal", () => {
  it("drops a pick that a newer write overtook, and keeps one the server could not take yet", () => {
    expect(isFinalPickRefusal(refusal("TRYOUT_RESPONSE_STALE"))).toBe(true);
    expect(isFinalPickRefusal(refusal("TRYOUT_RESPONSE_FAILED"))).toBe(false);
    expect(isFinalPickRefusal(new Cause.UnknownError("offline"))).toBe(false);
  });
});
