import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { articleLayer } from "@repo/backend/content/article/confect";
import {
  verifyArticle,
  verifyCategory,
} from "@repo/backend/content/article/verify";
import { insertRuntimeArticles } from "@repo/backend/test/content/runtime";
import { Effect } from "effect";

describe("contentRelease/article/verify", () => {
  it.effect(
    "accepts the signed asset identity and rejects a stored mismatch",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const targetCtx = yield* MutationCtx;
            yield* Effect.promise(() => insertRuntimeArticles(targetCtx, 1));
            const row = yield* Effect.promise(() =>
              targetCtx.db.query("articleCatalog").unique()
            );
            if (!row) {
              throw new Error("Expected one active article row.");
            }
            const verified = yield* verifyArticle(row, row.sequence).pipe(
              Effect.provide(articleLayer)
            );
            expect(verified).toMatchObject({
              projection: {
                kind: "article",
              },
            });
            const corruptRow = yield* Effect.promise(() =>
              targetCtx.db.query("articleCatalog").unique()
            );
            if (!corruptRow) {
              throw new Error("Expected one active article row.");
            }
            yield* Effect.promise(() =>
              targetCtx.db.patch("articleCatalog", corruptRow._id, {
                assetId: "asset:en:article:politics:article:politics:wrong",
              })
            );
            expect(
              yield* Effect.gen(function* () {
                const row = yield* Effect.promise(() =>
                  targetCtx.db.query("articleCatalog").unique()
                );
                if (!row) {
                  throw new Error("Expected one active article row.");
                }
                return yield* verifyArticle(row, row.sequence).pipe(
                  Effect.provide(articleLayer)
                );
              }).pipe(Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          })
        );
      })
  );
  it.effect(
    "rejects a category route that contradicts its signed representative",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const targetCtx = yield* MutationCtx;
            yield* Effect.promise(() => insertRuntimeArticles(targetCtx, 1));
            const category = yield* Effect.promise(() =>
              targetCtx.db.query("articleCategories").unique()
            );
            if (!category) {
              throw new Error("Expected one active article category.");
            }
            yield* Effect.promise(() =>
              targetCtx.db.patch("articleCategories", category._id, {
                route: "government",
              })
            );
            expect(
              yield* Effect.gen(function* () {
                const category = yield* Effect.promise(() =>
                  targetCtx.db.query("articleCategories").unique()
                );
                if (!category) {
                  throw new Error("Expected one active article category.");
                }
                return yield* verifyCategory(category, category.sequence).pipe(
                  Effect.provide(articleLayer)
                );
              }).pipe(Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          })
        );
      })
  );
});
