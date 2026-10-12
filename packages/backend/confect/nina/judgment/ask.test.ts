import { afterEach, describe, expect, it } from "@effect/vitest";
import { judge, probabilities } from "@repo/backend/confect/nina/judgment/ask";
import { judgments } from "@repo/backend/confect/nina/judgment/catalog";
import { decides, GatewayTest, provider } from "@repo/backend/test/gateway";
import { encodeJsonText } from "@repo/utilities/json";
import { APICallError } from "ai";
import { Experimental_DecisionMockModelV4 as DecisionMockModel } from "ai/test";
import { Array as Arr, Effect } from "effect";

/** A probability well above every threshold, and one well below. */
const SURE = 0.99;
const UNLIKELY = 0.01;

const text = "Kelas 12 IPA dan mau masuk ITB tahun depan.";
/** A message in a script that puts no space between words. */
const japanese = "高校三年生で、来年は東京大学を目指しています。";
/** The same word, repeated until it is far more than a decision model reads. */
const long = Arr.join(Arr.replicate("limit", 3000), " ");

afterEach(() => provider.decisionModel.mockReset());

describe("judgment", () => {
  it.effect(
    "asks every named judgment about the text in one request, and judges each from the probability its entry names",
    () =>
      Effect.gen(function* () {
        const { requests } = decides((judgment) =>
          judgment === "lasting" ? SURE : UNLIKELY
        );
        const verdicts = yield* judge(["lasting", "private"], [text]);
        expect(verdicts).toEqual([{ lasting: true, private: false }]);
        const [request, ...others] = requests();
        expect(others).toEqual([]);
        expect(request?.state).toEqual([{ text, type: "text" }]);
        expect(request?.questions).toEqual({
          "lasting.0": {
            instructions: judgments.lasting.instructions,
            type: "boolean",
          },
          "private.0": {
            instructions: judgments.private.instructions,
            type: "boolean",
          },
        });
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect.each(["lasting", "private"] as const)(
    "counts %s as yes from the probability its entry names, that probability included",
    (name) =>
      Effect.gen(function* () {
        const { threshold } = judgments[name];
        decides(() => threshold);
        const [at] = yield* judge([name], [text]);
        decides(() => threshold - 0.01);
        const [below] = yield* judge([name], [text]);
        expect(at).toEqual({ [name]: true });
        expect(below).toEqual({ [name]: false });
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "asks about several texts in one request, numbers them, and gives each its own verdict in the order given",
    () =>
      Effect.gen(function* () {
        const { requests } = decides((_, index) =>
          index === 1 ? UNLIKELY : SURE
        );
        const verdicts = yield* judge(
          ["private"],
          ["nama@contoh.com", "Kelas 12 IPA.", "0812 3456 7890"]
        );
        expect(verdicts).toEqual([
          { private: true },
          { private: false },
          { private: true },
        ]);
        const [request, ...others] = requests();
        expect(others).toEqual([]);
        expect(request?.state).toEqual([
          { text: "Text 1:\nnama@contoh.com", type: "text" },
          { text: "Text 2:\nKelas 12 IPA.", type: "text" },
          { text: "Text 3:\n0812 3456 7890", type: "text" },
        ]);
        expect(request?.questions).toEqual({
          "private.0": {
            instructions: `About text 1 only: ${judgments.private.instructions}`,
            type: "boolean",
          },
          "private.1": {
            instructions: `About text 2 only: ${judgments.private.instructions}`,
            type: "boolean",
          },
          "private.2": {
            instructions: `About text 3 only: ${judgments.private.instructions}`,
            type: "boolean",
          },
        });
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect("asks no request about no text", () =>
    Effect.gen(function* () {
      expect(yield* judge(["lasting", "private"], [])).toEqual([]);
      expect(yield* probabilities(["lasting"], [])).toEqual([]);
      expect(provider.decisionModel).not.toHaveBeenCalled();
    }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "sends a message in a script without spaces as it is, and leaves the verdict to the model",
    () =>
      Effect.gen(function* () {
        const { requests } = decides(() => SURE);
        const verdicts = yield* judge(["lasting"], [japanese]);
        expect(verdicts).toEqual([{ lasting: true }]);
        expect(Arr.map(requests(), (request) => request.state)).toEqual([
          [{ text: japanese, type: "text" }],
        ]);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect("cuts a text to what the model reads", () =>
    Effect.gen(function* () {
      const { requests } = decides(() => UNLIKELY);
      yield* judge(["lasting"], [long]);
      const [request] = requests();
      const [part] = request?.state ?? [];
      expect(part).toMatchObject({ type: "text" });
      expect(part && "text" in part ? part.text : "").toContain(
        "[Shortened to about 1000 of "
      );
    }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "gives the probability of each judgment for each text, in the order of the texts",
    () =>
      Effect.gen(function* () {
        decides((judgment, index) =>
          judgment === "lasting" ? 0.9 - index / 10 : 0.1 + index / 10
        );
        expect(
          yield* probabilities(["lasting", "private"], [text, text])
        ).toEqual([
          { lasting: 0.9, private: 0.1 },
          { lasting: 0.8, private: 0.2 },
        ]);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "fails with the gateway's failure when the decision cannot be made, and gives no verdict",
    () =>
      Effect.gen(function* () {
        provider.decisionModel.mockReturnValue(
          new DecisionMockModel({
            doDecide: () =>
              Promise.reject(
                new APICallError({
                  isRetryable: false,
                  message: "Provider detail that must not travel",
                  requestBodyValues: { state: text },
                  statusCode: 503,
                  url: "https://ai-gateway.convex.dev/alpha/decisions",
                })
              ),
          })
        );
        const failure = yield* Effect.flip(judge(["lasting"], [text]));
        expect(failure).toMatchObject({
          _tag: "GatewayFailure",
          reason: "unavailable",
          status: 503,
        });
        expect(encodeJsonText(failure)).not.toContain("Provider detail");
        expect(encodeJsonText(failure)).not.toContain("Kelas");
      }).pipe(Effect.provide(GatewayTest))
  );
});
