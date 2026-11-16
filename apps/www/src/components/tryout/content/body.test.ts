import { describe, expect, it } from "@effect/vitest";
import { encodeJsonText } from "@repo/utilities/json";
import { Array as Arr, Effect, Result } from "effect";
import {
  decodeTryoutBodies,
  joinTryoutBodies,
} from "@/components/tryout/content/body";
import { makeTryoutBody, makeTryoutQuestion } from "@/test/tryout";

const bilingual = makeTryoutBody("a", ["ms", "en"]);

/** The wire form of a decoded body: each language's body as JSON text beside its language and version. */
const wireOf = (body: typeof bilingual) => ({
  placementId: body.placementId,
  versions: Arr.map(body.versions, ({ hash, language, ...decoded }) => ({
    body: encodeJsonText(decoded),
    hash,
    language,
  })),
});

describe("decodeTryoutBodies", () => {
  it.effect(
    "decodes each question in every language of its section, in the section's order",
    () =>
      Effect.gen(function* () {
        expect(yield* decodeTryoutBodies([wireOf(bilingual)])).toEqual([
          bilingual,
        ]);
      })
  );

  it.effect("fails on a body that is not one, in any language", () =>
    Effect.gen(function* () {
      const [first, second] = wireOf(bilingual).versions;
      const failure = yield* decodeTryoutBodies([
        {
          placementId: bilingual.placementId,
          versions: [first, { ...second, body: "{}" }],
        },
      ]).pipe(Effect.flip);
      expect(failure._tag).toBe("SchemaError");
    })
  );
});

describe("joinTryoutBodies", () => {
  it("pairs each question with its own body in the language the section shows, in the order of the questions", () => {
    const first = makeTryoutQuestion("a");
    const second = makeTryoutQuestion("b", { questionOrder: 2 });
    const [, englishA] = makeTryoutBody("a", ["ms", "en"]).versions;
    const [, englishB] = makeTryoutBody("b", ["ms", "en"]).versions;
    expect(
      joinTryoutBodies(
        [makeTryoutBody("b", ["ms", "en"]), makeTryoutBody("a", ["ms", "en"])],
        [first, second],
        "en"
      )
    ).toEqual(
      Result.succeed([
        { body: englishA, question: first },
        { body: englishB, question: second },
      ])
    );
  });

  it("fails when any question has no body, or none in the language shown", () => {
    for (const joined of [
      joinTryoutBodies(
        [makeTryoutBody("a")],
        [makeTryoutQuestion("a"), makeTryoutQuestion("b")],
        "id"
      ),
      joinTryoutBodies([makeTryoutBody("a")], [makeTryoutQuestion("a")], "en"),
    ]) {
      expect(Result.isFailure(joined) && joined.failure._tag).toBe(
        "TryoutBodiesMissing"
      );
    }
  });
});
