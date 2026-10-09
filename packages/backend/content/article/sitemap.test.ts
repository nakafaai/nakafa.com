import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { articleLayer } from "@repo/backend/content/article/confect";
import {
  readArticleBuckets,
  readArticleSitemap,
} from "@repo/backend/content/article/sitemap";
import {
  insertRuntimeArticles,
  testArticleProjection,
  testLocalizedArticleProjection,
} from "@repo/backend/test/content/runtime";
import { Effect } from "effect";

describe("contentRelease/article/sitemap", () => {
  it.effect("keeps sitemap ownership absent before the article cutover", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const _tCtx = yield* MutationCtx;
          expect(
            yield* readArticleBuckets("en").pipe(Effect.provide(articleLayer))
          ).toEqual({
            activeReleaseId: null,
            articleCount: 0,
            buckets: [],
            managed: false,
          });
          expect(
            yield* readArticleSitemap("en", "abc").pipe(
              Effect.provide(articleLayer)
            )
          ).toBeNull();
        })
      );
    })
  );
  it.effect("serves complete article and category sitemap partitions", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() => insertRuntimeArticles(tCtx, 1));
          const row = yield* Effect.promise(() =>
            tCtx.db.query("articleCatalog").unique()
          );
          if (!row) {
            throw new Error("Expected one active article row.");
          }
          expect(
            yield* readArticleBuckets("en").pipe(Effect.provide(articleLayer))
          ).toEqual({
            activeReleaseId: expect.any(String),
            articleCount: 1,
            buckets: [row.bucket],
            managed: true,
          });
          expect(
            yield* readArticleSitemap("en", row.bucket).pipe(
              Effect.provide(articleLayer)
            )
          ).toMatchObject({
            routes: [
              {
                publicPath: "articles/politics",
              },
              {
                lastModified: testArticleProjection(0).metadata.datePublished,
                publicPath: testArticleProjection(0).publicPath,
              },
            ],
          });
          expect(
            yield* readArticleSitemap("en", "fff").pipe(
              Effect.provide(articleLayer)
            )
          ).toBeNull();
          expect(
            yield* readArticleSitemap("en", "wrong").pipe(
              Effect.provide(articleLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_LIMIT",
          });
        })
      );
    })
  );
  it.effect.each(["id", "de"] as const)(
    "uses signed %s category and article routes instead of canonical identity keys",
    (appLocale) =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* Effect.promise(() =>
              insertRuntimeArticles(tCtx, 1, (index) =>
                testLocalizedArticleProjection(index, appLocale)
              )
            );
            const row = yield* Effect.promise(() =>
              tCtx.db.query("articleCatalog").unique()
            );
            if (!row) {
              throw new Error("Expected one localized article row.");
            }
            const projection = testLocalizedArticleProjection(0, appLocale);
            expect(
              yield* readArticleSitemap(appLocale, row.bucket).pipe(
                Effect.provide(articleLayer)
              )
            ).toMatchObject({
              routes: [
                {
                  publicPath: projection.parentPath,
                },
                {
                  lastModified: projection.metadata.datePublished,
                  publicPath: projection.publicPath,
                },
              ],
            });
          })
        );
      })
  );
  it.effect("rejects sitemap metadata outside the fixed partition space", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() => insertRuntimeArticles(tCtx, 1));
          const existing = yield* Effect.promise(() =>
            tCtx.db.query("articleBuckets").unique()
          );
          if (!existing) {
            throw new Error("Expected one active article bucket.");
          }
          for (let index = 0; index < 4096; index += 1) {
            const bucket = index.toString(16).padStart(3, "0");
            if (bucket === existing.bucket) {
              continue;
            }
            yield* Effect.promise(() =>
              tCtx.db.insert("articleBuckets", {
                appLocale: "en",
                articleCount: 1,
                bucket,
                categoryCount: 0,
                slot: "blue",
              })
            );
          }
          yield* Effect.promise(() =>
            tCtx.db.insert("articleBuckets", {
              appLocale: "en",
              articleCount: 1,
              bucket: "zzz",
              categoryCount: 0,
              slot: "blue",
            })
          );
          expect(
            yield* readArticleBuckets("en").pipe(
              Effect.provide(articleLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
  it.effect("rejects a sitemap partition with corrupted counts", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() => insertRuntimeArticles(tCtx, 1));
          const bucketToCorrupt = yield* Effect.promise(() =>
            tCtx.db.query("articleBuckets").unique()
          );
          if (!bucketToCorrupt) {
            throw new Error("Expected one article sitemap bucket.");
          }
          yield* Effect.promise(() =>
            tCtx.db.patch("articleBuckets", bucketToCorrupt._id, {
              articleCount: 2,
            })
          );
          const bucket = yield* Effect.promise(() =>
            tCtx.db.query("articleBuckets").unique()
          );
          if (!bucket) {
            throw new Error("Expected one corrupted sitemap bucket.");
          }
          expect(
            yield* readArticleSitemap("en", bucket.bucket).pipe(
              Effect.provide(articleLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
          yield* Effect.promise(() =>
            tCtx.db.patch("articleBuckets", bucket._id, {
              articleCount: -1,
            })
          );
          expect(
            yield* readArticleBuckets("en").pipe(
              Effect.provide(articleLayer),
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
});
