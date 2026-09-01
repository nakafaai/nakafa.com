import { describe, expect, it } from "@effect/vitest";
import { responseSpecFromLegacyChoices } from "@repo/backend/convex/tryouts/response/legacy";
import { Effect } from "effect";

describe("legacy try-out response bridge", () => {
  it.effect("sorts choices while preserving their Markdown labels", () =>
    Effect.gen(function* () {
      const response = yield* responseSpecFromLegacyChoices([
        { isCorrect: false, label: "B", optionKey: "option-2", order: 2 },
        {
          isCorrect: true,
          label: "Nilai **utama** $$x + 1$$.",
          optionKey: "option-1",
          order: 1,
        },
      ]);
      expect(response).toEqual({
        kind: "single-choice",
        options: [
          {
            isCorrect: true,
            label: "Nilai **utama** $$x + 1$$.",
            optionKey: "option-1",
            order: 1,
          },
          {
            isCorrect: false,
            label: "B",
            optionKey: "option-2",
            order: 2,
          },
        ],
      });
    })
  );

  it.effect("rejects malformed predecessor choices", () =>
    Effect.gen(function* () {
      for (const choices of [
        [],
        [
          { isCorrect: true, label: "", optionKey: "option-1", order: 1 },
          { isCorrect: false, label: "B", optionKey: "option-2", order: 2 },
        ],
        [
          { isCorrect: true, label: "A", optionKey: "option-1", order: 1 },
          { isCorrect: true, label: "B", optionKey: "option-2", order: 2 },
        ],
        [
          { isCorrect: true, label: "A", optionKey: "same", order: 1 },
          { isCorrect: false, label: "B", optionKey: "same", order: 2 },
        ],
        [
          { isCorrect: true, label: "A", optionKey: "option-1", order: 1 },
          { isCorrect: false, label: "B", optionKey: "option-2", order: 1 },
        ],
      ]) {
        expect(
          yield* responseSpecFromLegacyChoices(choices).pipe(Effect.flip)
        ).toHaveProperty("_tag", "LegacyTryoutResponseError");
      }
    })
  );
});
