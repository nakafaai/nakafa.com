import { afterEach, describe, expect, it } from "@effect/vitest";
import { judge, probabilities } from "@repo/backend/confect/nina/judgment/ask";
import { judgments } from "@repo/backend/confect/nina/judgment/catalog";
import { noteText } from "@repo/backend/confect/nina/judgment/note";
import {
  askedOf,
  decides,
  GatewayTest,
  provider,
} from "@repo/backend/test/gateway";
import { encodeJsonText } from "@repo/utilities/json";
import { APICallError } from "ai";
import { Experimental_DecisionMockModelV4 as DecisionMockModel } from "ai/test";
import { Array as Arr, Effect, Record as Rec } from "effect";

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
        const verdicts = yield* judge(["lasting", "private"], text);
        expect(verdicts).toEqual({ lasting: true, private: false });
        const [request, ...others] = requests();
        expect(others).toEqual([]);
        expect(request?.state).toEqual([{ text, type: "text" }]);
        expect(request?.questions).toEqual({
          lasting: {
            instructions: judgments.lasting.instructions,
            type: "boolean",
          },
          private: {
            instructions: judgments.private.instructions,
            type: "boolean",
          },
        });
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "counts each judgment as yes from the probability of its own entry, that probability included, when all of them are asked together",
    () =>
      Effect.gen(function* () {
        const thresholds: Record<string, number> = Rec.map(
          judgments,
          ({ threshold }) => threshold
        );
        const names = ["lasting", "ownNote", "private"] as const;
        decides((judgment) => thresholds[judgment]);
        const at = yield* judge(names, text);
        decides((judgment) => thresholds[judgment] - 0.01);
        const below = yield* judge(names, text);
        expect(at).toEqual({ lasting: true, ownNote: true, private: true });
        expect(below).toEqual({
          lasting: false,
          ownNote: false,
          private: false,
        });
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "asks the judgments of a note about the note in one request, and gives each its own verdict",
    () =>
      Effect.gen(function* () {
        const { requests } = decides((judgment) =>
          judgment === "ownNote" ? SURE : UNLIKELY
        );
        const note = noteText({ quote: "aku kelas 12", text: "Kelas 12." });
        const verdicts = yield* judge(["ownNote", "private"], note);
        expect(verdicts).toEqual({ ownNote: true, private: false });
        const [request, ...others] = requests();
        expect(others).toEqual([]);
        expect(request?.state).toEqual([{ text: note, type: "text" }]);
        expect(request && askedOf(request)).toEqual(["ownNote", "private"]);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect(
    "sends a message in a script without spaces as it is, and leaves the verdict to the model",
    () =>
      Effect.gen(function* () {
        const { requests } = decides(() => SURE);
        const verdicts = yield* judge(["lasting"], japanese);
        expect(verdicts).toEqual({ lasting: true });
        expect(Arr.map(requests(), (request) => request.state)).toEqual([
          [{ text: japanese, type: "text" }],
        ]);
      }).pipe(Effect.provide(GatewayTest))
  );

  it.effect("cuts a text to what the model reads", () =>
    Effect.gen(function* () {
      const { requests } = decides(() => UNLIKELY);
      yield* judge(["lasting"], long);
      const [request] = requests();
      const [part] = request?.state ?? [];
      expect(part).toMatchObject({ type: "text" });
      expect(part && "text" in part ? part.text : "").toContain(
        "[Shortened to about 1000 of "
      );
    }).pipe(Effect.provide(GatewayTest))
  );

  it.effect("gives the probability of each judgment for the text", () =>
    Effect.gen(function* () {
      decides((judgment) => (judgment === "lasting" ? 0.9 : 0.1));
      expect(yield* probabilities(["lasting", "private"], text)).toEqual({
        lasting: 0.9,
        private: 0.1,
      });
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
        const failure = yield* Effect.flip(judge(["lasting"], text));
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
