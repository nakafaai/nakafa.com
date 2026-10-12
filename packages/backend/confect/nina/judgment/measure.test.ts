import { afterEach, describe, expect, it } from "@effect/vitest";
import {
  measureTexts,
  REQUESTS_IN_FLIGHT,
} from "@repo/backend/confect/nina/judgment/measure";
import {
  askedOf,
  decidesLast,
  decidesSlowly,
  GatewayTest,
  provider,
  textOf,
} from "@repo/backend/test/gateway";
import { APICallError } from "ai";
import { Experimental_DecisionMockModelV4 as DecisionMockModel } from "ai/test";
import {
  Array as Arr,
  Effect,
  MutableRef,
  Option,
  Order,
  Record as Rec,
} from "effect";

afterEach(() => provider.decisionModel.mockReset());

/** A model that fails every request the way the gateway does when it refuses one. */
function refuses(error: APICallError) {
  provider.decisionModel.mockReturnValue(
    new DecisionMockModel({ doDecide: () => Promise.reject(error) })
  );
}

/** The probability each judgment gives for each of three texts. */
const chance: Record<string, Record<string, number>> = {
  ownNote: { a: 0.2, b: 0.4, c: 0.6 },
  private: { a: 0.9, b: 0.5, c: 0.1 },
};

describe("measuring the judgments", () => {
  it.effect(
    "gives every text the probability of every named judgment, in one request for each text that asks all of them, in the order of the texts",
    () =>
      Effect.gen(function* () {
        // The request about the first text is answered after the requests about
        // the others, so rows placed in the order of the answers would not be in
        // the order of the texts.
        const finished = decidesLast(
          "a",
          3,
          (judgment, text) => chance[judgment][text]
        );
        const rows = yield* measureTexts(
          ["private", "ownNote"],
          ["a", "b", "c"]
        );
        expect(rows).toEqual([
          { probabilities: { ownNote: 0.2, private: 0.9 } },
          { probabilities: { ownNote: 0.4, private: 0.5 } },
          { probabilities: { ownNote: 0.6, private: 0.1 } },
        ]);
        // One request for each text, and each asks both judgments.
        const requests = MutableRef.get(finished);
        expect(Arr.last(Arr.map(requests, textOf))).toEqual(Option.some("a"));
        expect(Arr.sort(Arr.map(requests, textOf), Order.String)).toEqual([
          "a",
          "b",
          "c",
        ]);
        for (const request of requests) {
          expect(askedOf(request)).toEqual(["ownNote", "private"]);
        }
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect("asks nothing about no text", () =>
    Effect.gen(function* () {
      expect(yield* measureTexts(["lasting"], [])).toEqual([]);
      expect(provider.decisionModel).not.toHaveBeenCalled();
    }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "keeps no more requests open than it may, and still measures every text",
    () =>
      Effect.gen(function* () {
        const mostOpen = decidesSlowly(() => 0.7);
        const texts = Arr.makeBy(REQUESTS_IN_FLIGHT * 3, (n) => `text ${n}`);
        const rows = yield* measureTexts(["lasting"], texts);
        expect(Arr.length(rows)).toBe(Arr.length(texts));
        expect(MutableRef.get(mostOpen)).toBe(REQUESTS_IN_FLIGHT);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "gives each text whose request failed the routing facts of the failure, and no text",
    () =>
      Effect.gen(function* () {
        refuses(
          new APICallError({
            data: { error: { code: "unsupported_parameter" } },
            isRetryable: false,
            message: "Private provider detail",
            requestBodyValues: { state: "Kelas 12" },
            statusCode: 400,
            url: "https://ai-gateway.convex.dev/alpha/decisions",
          })
        );
        expect(
          yield* measureTexts(["lasting"], ["Kelas 12", "Terima kasih"])
        ).toEqual([
          {
            failure: {
              reason: "invalid",
              status: 400,
              type: "unsupported_parameter",
            },
          },
          {
            failure: {
              reason: "invalid",
              status: 400,
              type: "unsupported_parameter",
            },
          },
        ]);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "names no status and no type for a request that never got an answer",
    () =>
      Effect.gen(function* () {
        refuses(
          new APICallError({
            isRetryable: false,
            message: "fetch failed",
            requestBodyValues: {},
            url: "https://ai-gateway.convex.dev/alpha/decisions",
          })
        );
        expect(yield* measureTexts(["lasting"], ["Kelas 12"])).toEqual([
          { failure: { reason: "network" } },
        ]);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect("fails one text and measures the others", () =>
    Effect.gen(function* () {
      // The request about "b" is refused, and the others are answered.
      provider.decisionModel.mockReturnValue(
        new DecisionMockModel({
          doDecide: (request) =>
            textOf(request) === "b"
              ? Promise.reject(
                  new APICallError({
                    isRetryable: false,
                    message: "Unavailable",
                    requestBodyValues: {},
                    statusCode: 503,
                    url: "https://ai-gateway.convex.dev/alpha/decisions",
                  })
                )
              : Promise.resolve({
                  answers: Rec.map(request.questions, () => ({
                    probability: 0.7,
                    type: "boolean" as const,
                  })),
                  warnings: [],
                }),
        })
      );
      expect(yield* measureTexts(["lasting"], ["a", "b", "c"])).toEqual([
        { probabilities: { lasting: 0.7 } },
        { failure: { reason: "unavailable", status: 503 } },
        { probabilities: { lasting: 0.7 } },
      ]);
    }).pipe(Effect.provide(GatewayTest))
  );
});
