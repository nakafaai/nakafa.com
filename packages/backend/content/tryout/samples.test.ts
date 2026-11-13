import { assert, describe, expect, it } from "@effect/vitest";
import tryouts from "@repo/backend/confect/_generated/refs/tryouts";
import { TryoutQuestionBodyText } from "@repo/backend/confect/tryouts/runtime/spec";
import { tryoutWorld } from "@repo/backend/test/tryout/world";
import { Effect, Schema } from "effect";

const { getSetSamples } = tryouts.queries.catalog;
const SET_PATH = "try-out/indonesia/snbt/2027/utbk/set-1-id";

describe("content/tryout/samples", () => {
  it.effect(
    "shows a set page its free preview with keys and explanations in the page's language, and a section or an unknown path none",
    () =>
      Effect.gen(function* () {
        const world = yield* tryoutWorld();
        const samples = yield* world.visitor.query(getSetSamples, {
          appLocale: "id",
          publicPath: SET_PATH,
        });
        assert.ok(samples, "Expected the set's samples.");
        expect(
          yield* Effect.forEach(samples, ({ body }) =>
            Schema.decodeEffect(TryoutQuestionBodyText)(body)
          )
        ).toMatchObject([
          {
            explanation: { type: "doc" },
            key: { correct: ["option-2"], kind: "choice" },
          },
          {
            explanation: { type: "doc" },
            key: { correct: ["option-1", "option-3"], kind: "choice" },
          },
        ]);
        expect(
          yield* world.visitor.query(getSetSamples, {
            appLocale: "id",
            publicPath: `${SET_PATH}/section-a`,
          })
        ).toBeNull();
        expect(
          yield* world.visitor.query(getSetSamples, {
            appLocale: "id",
            publicPath: "try-out/indonesia/snbt/2027/utbk/set-9",
          })
        ).toBeNull();
      })
  );
});
