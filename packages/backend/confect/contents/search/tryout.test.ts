import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { readSignedTryoutSearchDocuments } from "@repo/backend/confect/contents/search/tryout";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { activateAssessmentTestSnapshot } from "@repo/backend/test/snapshot/assessment";
import { Array as Arr, Effect, Order } from "effect";

const input = {
  limit: 10,
  locale: "en",
  offset: 0,
  section: "tryout",
} satisfies Parameters<typeof readSignedTryoutSearchDocuments>[0];

/** Searches the try-out documents of the English catalog for `queries`, at most `limit`. */
const search = (queries: readonly string[], limit = 10) =>
  readSignedTryoutSearchDocuments(
    { ...input, queries: [...queries] },
    queries,
    limit
  );

describe("contents/search/tryout", () => {
  it.effect("finds nothing before any release activates a snapshot", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          expect(yield* search(["try-out"])).toEqual([]);
        })
      );
    })
  );

  it.effect(
    "searches the public routes of the active catalog by route, title and description, never an internal section",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const ctx = yield* MutationCtx;
            yield* Effect.promise(() =>
              activateAssessmentTestSnapshot(ctx, { entry: true })
            );
            const [exact] = yield* search(["try-out/indonesia-en"]);
            expect(exact).toMatchObject({
              content_id: "asset:en:tryout:country",
              route: "try-out/indonesia-en",
              section: "tryout",
            });
            expect(
              Arr.map(yield* search(["Indonesia"]), ({ route }) => route)
            ).toContain("try-out/indonesia-en");
            const browsed = yield* search([]);
            expect(
              Arr.sort(
                Arr.map(browsed, ({ route }) => route),
                Order.String
              )
            ).toEqual([
              "try-out/indonesia-en",
              "try-out/indonesia/snbt-en",
              "try-out/indonesia/snbt/2027-en",
              "try-out/indonesia/snbt/2027/set-1-en",
            ]);
            expect(yield* search([], 0)).toEqual([]);
          })
        );
      })
  );
});
