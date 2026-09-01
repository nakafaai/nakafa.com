import { describe, expect, it } from "@effect/vitest";
import type { TryoutResponseSpec } from "@repo/backend/convex/tryouts/response/model";
import { validateTryoutResponseSpec } from "@repo/backend/convex/tryouts/response/validation";
import { Effect } from "effect";

const validOptions = [
  {
    isCorrect: true,
    label: "A",
    optionKey: "option-1",
    order: 1,
  },
  {
    isCorrect: false,
    label: "B",
    optionKey: "option-2",
    order: 2,
  },
] satisfies Extract<TryoutResponseSpec, { kind: "single-choice" }>["options"];

describe("try-out response definition validation", () => {
  it.effect("rejects whitespace-only rich labels in every response shape", () =>
    Effect.gen(function* () {
      const definitions: TryoutResponseSpec[] = [
        {
          kind: "single-choice",
          options: [{ ...validOptions[0], label: "   " }, validOptions[1]],
        },
        {
          categories: [
            { categoryKey: "category-1", label: "   ", order: 1 },
            { categoryKey: "category-2", label: "Salah", order: 2 },
          ],
          kind: "category",
          statements: [
            {
              correctCategoryKey: "category-1",
              label: "Pernyataan",
              order: 1,
              statementKey: "statement-1",
            },
          ],
        },
        {
          categories: [
            { categoryKey: "category-1", label: "Benar", order: 1 },
            { categoryKey: "category-2", label: "Salah", order: 2 },
          ],
          kind: "category",
          statements: [
            {
              correctCategoryKey: "category-1",
              label: "   ",
              order: 1,
              statementKey: "statement-1",
            },
          ],
        },
      ];

      for (const definition of definitions) {
        expect(
          yield* validateTryoutResponseSpec(definition).pipe(Effect.flip)
        ).toHaveProperty("_tag", "TryoutResponseDefinitionError");
      }
    })
  );
});
