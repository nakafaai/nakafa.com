import { describe, expect, it } from "@effect/vitest";
import { encodeJsonText } from "@repo/utilities/json";
import { Effect, Option } from "effect";
import {
  decodeTryoutBodies,
  joinTryoutBodies,
} from "@/components/tryout/content/body";
import { makeTryoutBody, makeTryoutQuestion } from "@/test/tryout";

const { placementId, versionHash, ...body } = makeTryoutBody("a");

describe("decodeTryoutBodies", () => {
  it.effect(
    "decodes each body's JSON text with its placement and item version",
    () =>
      Effect.gen(function* () {
        expect(
          yield* decodeTryoutBodies([
            { body: encodeJsonText(body), placementId, versionHash },
          ])
        ).toEqual([makeTryoutBody("a")]);
      })
  );

  it.effect("fails on a body that is not one", () =>
    Effect.gen(function* () {
      const failure = yield* decodeTryoutBodies([
        { body: "{}", placementId, versionHash },
      ]).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
    })
  );
});

describe("joinTryoutBodies", () => {
  it("pairs each question with its own body, in the order of the questions", () => {
    const first = makeTryoutQuestion("a");
    const second = makeTryoutQuestion("b", { questionOrder: 2 });
    expect(
      joinTryoutBodies(
        [makeTryoutBody("b"), makeTryoutBody("a")],
        [first, second]
      )
    ).toEqual(
      Option.some([
        { body: makeTryoutBody("a"), question: first },
        { body: makeTryoutBody("b"), question: second },
      ])
    );
  });

  it("finds nothing when any question has no body", () => {
    expect(
      joinTryoutBodies(
        [makeTryoutBody("a")],
        [makeTryoutQuestion("a"), makeTryoutQuestion("b")]
      )
    ).toEqual(Option.none());
  });
});
