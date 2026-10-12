import { afterEach, describe, expect, it } from "@effect/vitest";
import { measureTexts } from "@repo/backend/confect/nina/judgment/measure";
import { decides, GatewayTest, provider } from "@repo/backend/test/gateway";
import { APICallError } from "ai";
import { Experimental_DecisionMockModelV4 as DecisionMockModel } from "ai/test";
import { Array as Arr, Effect, Order, Record as Rec } from "effect";

afterEach(() => provider.decisionModel.mockReset());

/** A model that fails every request the way the gateway does when it refuses one. */
function refuses(error: APICallError) {
  provider.decisionModel.mockReturnValue(
    new DecisionMockModel({ doDecide: () => Promise.reject(error) })
  );
}

describe("measuring the judgments", () => {
  it.effect(
    "gives every text the probability of every named judgment, one request for each group of texts that asks all of them, in the order of the texts",
    () =>
      Effect.gen(function* () {
        const { requests } = decides((judgment, index) => {
          const first = judgment === "private" ? 0.9 : 0.2;
          return index === 0 ? first : first - 0.1;
        });
        const rows = yield* measureTexts(
          ["private", "ownNote"],
          ["a", "b", "c"],
          2
        );
        expect(rows).toEqual([
          { probabilities: { ownNote: 0.2, private: 0.9 } },
          { probabilities: { ownNote: 0.1, private: 0.8 } },
          { probabilities: { ownNote: 0.2, private: 0.9 } },
        ]);
        // Two groups ("a" and "b" together, "c" alone), each one request that
        // asks both judgments about each of its texts.
        expect(
          Arr.sort(
            Arr.map(requests(), (request) =>
              Arr.length(Rec.keys(request.questions))
            ),
            Order.Number
          )
        ).toEqual([2, 4]);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect("asks one text at a time when each group is one text", () =>
    Effect.gen(function* () {
      const { requests } = decides(() => 0.6);
      expect(yield* measureTexts(["lasting"], ["a", "b"], 1)).toEqual([
        { probabilities: { lasting: 0.6 } },
        { probabilities: { lasting: 0.6 } },
      ]);
      expect(Arr.map(requests(), (request) => request.state)).toEqual([
        [{ text: "a", type: "text" }],
        [{ text: "b", type: "text" }],
      ]);
    }).pipe(Effect.provide(GatewayTest))
  );

  it.effect("asks nothing about no text", () =>
    Effect.gen(function* () {
      expect(yield* measureTexts(["lasting"], [], 1)).toEqual([]);
      expect(provider.decisionModel).not.toHaveBeenCalled();
    }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "gives each text of a group whose request failed the routing facts of the failure, and no text",
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
          yield* measureTexts(["lasting"], ["Kelas 12", "Terima kasih"], 2)
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
        expect(yield* measureTexts(["lasting"], ["Kelas 12"], 1)).toEqual([
          { failure: { reason: "network" } },
        ]);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect("fails one group and measures the others", () =>
    Effect.gen(function* () {
      // The group of one text is refused, and the group of two is answered.
      provider.decisionModel.mockReturnValue(
        new DecisionMockModel({
          doDecide: ({ questions, state }) =>
            Arr.length(state) === 1
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
                  answers: Rec.map(questions, () => ({
                    probability: 0.7,
                    type: "boolean" as const,
                  })),
                  warnings: [],
                }),
        })
      );
      expect(yield* measureTexts(["lasting"], ["a", "b", "c"], 2)).toEqual([
        { probabilities: { lasting: 0.7 } },
        { probabilities: { lasting: 0.7 } },
        { failure: { reason: "unavailable", status: 503 } },
      ]);
    }).pipe(Effect.provide(GatewayTest))
  );
});
