import { describe, expect, it } from "@effect/vitest";
import { Effect } from "effect";
import { decodeFeaturedResponse } from "@/components/tryout/catalog/featured";

const options = [
  {
    isCorrect: true,
    label: "Correct",
    optionKey: "option-1",
    order: 1,
  },
  {
    isCorrect: false,
    label: "Incorrect",
    optionKey: "option-2",
    order: 2,
  },
] as const;

describe("featured try-out response", () => {
  it.effect("keeps the canonical response", () =>
    Effect.gen(function* () {
      const response = yield* decodeFeaturedResponse({
        question: { contentKey: "ignored-at-this-boundary" },
        response: { kind: "single-choice", options },
      });

      expect(response).toEqual({ kind: "single-choice", options });
    })
  );

  it.effect("converts predecessor choices during the deployment switch", () =>
    Effect.gen(function* () {
      const response = yield* decodeFeaturedResponse({
        choices: options,
        question: { contentKey: "ignored-at-this-boundary" },
      });

      expect(response).toEqual({ kind: "single-choice", options });
    })
  );

  it.effect("rejects a missing response contract", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        decodeFeaturedResponse({
          question: { contentKey: "ignored-at-this-boundary" },
        })
      );

      expect(error._tag).toBe("FeaturedTryoutResponseError");
    })
  );

  it.effect("rejects predecessor choices that cannot form a response", () =>
    Effect.gen(function* () {
      const error = yield* Effect.flip(
        decodeFeaturedResponse({ choices: [options[0]] })
      );

      expect(error._tag).toBe("FeaturedTryoutResponseError");
    })
  );
});
