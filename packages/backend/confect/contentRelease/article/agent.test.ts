import { describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { readAgentArticleTaxonomy } from "@repo/backend/confect/contentRelease/article/agent";
import { ARTICLE_AGENT_TAXONOMY_LIMIT } from "@repo/backend/confect/contentRelease/article/limits";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import {
  insertRuntimeArticles,
  testArticleProjection,
  testLocalizedArticleProjection,
} from "@repo/backend/test/content/runtime";
import { Effect } from "effect";

describe("contentRelease/article/agent", () => {
  it.effect("keeps agent taxonomy unmanaged before the article cutover", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          expect(yield* readAgentArticleTaxonomy("en")).toEqual({
            categories: [],
            managed: false,
          });
        })
      );
    })
  );
  it.effect.each(ACTIVE_APP_LOCALE_CODES)(
    "authenticates the complete %s article taxonomy",
    (appLocale) =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const targetCtx = yield* MutationCtx;
            const projection =
              appLocale === "en"
                ? testArticleProjection(0)
                : testLocalizedArticleProjection(0, appLocale);
            yield* Effect.promise(() =>
              insertRuntimeArticles(targetCtx, 1, () => projection)
            );
            expect(yield* readAgentArticleTaxonomy(appLocale)).toEqual({
              categories: [projection.category],
              managed: true,
            });
          })
        );
      })
  );
  it.effect(
    "accepts the exact category ceiling and fails closed above it",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const targetCtx = yield* MutationCtx;
            yield* Effect.promise(() => insertRuntimeArticles(targetCtx, 1));
            const source = yield* Effect.promise(() =>
              targetCtx.db.query("articleCategories").unique()
            );
            if (!source) {
              expect.fail("Expected one active article category.");
            }
            for (
              let index = 1;
              index < ARTICLE_AGENT_TAXONOMY_LIMIT;
              index += 1
            ) {
              yield* Effect.promise(() =>
                targetCtx.db.insert("articleCategories", {
                  appLocale: source.appLocale,
                  bucket: source.bucket,
                  category: source.category,
                  contentKey: source.contentKey,
                  projectionHash: source.projectionHash,
                  releaseId: source.releaseId,
                  rendererDomain: source.rendererDomain,
                  route: source.route,
                  sequence: source.sequence,
                  slot: source.slot,
                  title: source.title,
                })
              );
            }
            const atLimit = yield* readAgentArticleTaxonomy("en");
            expect(atLimit.managed).toBe(true);
            expect(atLimit.categories).toHaveLength(
              ARTICLE_AGENT_TAXONOMY_LIMIT
            );
            const firstCategory = yield* Effect.promise(() =>
              targetCtx.db.query("articleCategories").first()
            );
            if (!firstCategory) {
              expect.fail("Expected one active article category.");
            }
            yield* Effect.promise(() =>
              targetCtx.db.insert("articleCategories", {
                appLocale: firstCategory.appLocale,
                bucket: firstCategory.bucket,
                category: firstCategory.category,
                contentKey: firstCategory.contentKey,
                projectionHash: firstCategory.projectionHash,
                releaseId: firstCategory.releaseId,
                rendererDomain: firstCategory.rendererDomain,
                route: firstCategory.route,
                sequence: firstCategory.sequence,
                slot: firstCategory.slot,
                title: firstCategory.title,
              })
            );
            expect(
              yield* readAgentArticleTaxonomy("en").pipe(Effect.flip)
            ).toMatchObject({
              code: "CONTENT_RELEASE_LIMIT",
            });
          })
        );
      })
  );
});
