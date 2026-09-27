import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { adjustArticleBucket } from "@repo/backend/confect/contentRelease/article/bucket";
import { CONTENT_BUCKET_SIZE } from "@repo/backend/confect/contentRelease/bucket";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { Effect } from "effect";

describe("contentRelease/article/bucket", () => {
  it.effect("creates, updates, and removes non-empty bucket counts", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* adjustArticleBucket("blue", "en", "abc", "article", 1);
          yield* adjustArticleBucket("blue", "en", "abc", "category", 1);
          expect(
            yield* Effect.promise(() =>
              tCtx.db.query("articleBuckets").unique()
            )
          ).toMatchObject({
            articleCount: 1,
            categoryCount: 1,
          });
          yield* adjustArticleBucket("blue", "en", "abc", "article", -1);
          yield* adjustArticleBucket("blue", "en", "abc", "category", -1);
          expect(
            yield* Effect.promise(() =>
              tCtx.db.query("articleBuckets").unique()
            )
          ).toBeNull();
        })
      );
    })
  );
  it.effect("rejects invalid buckets and count underflow", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          expect(
            yield* adjustArticleBucket("blue", "en", "bad!", "article", 1).pipe(
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
          expect(
            yield* adjustArticleBucket("blue", "en", "abc", "article", -1).pipe(
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
        })
      );
    })
  );
  it.effect("rejects a bucket before it exceeds its bounded sitemap page", () =>
    Effect.gen(function* () {
      const t = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* t.run(
        Effect.gen(function* () {
          const tCtx = yield* MutationCtx;
          yield* Effect.promise(() =>
            tCtx.db.insert("articleBuckets", {
              appLocale: "en",
              articleCount: CONTENT_BUCKET_SIZE,
              bucket: "abc",
              categoryCount: 0,
              slot: "blue",
            })
          );
          expect(
            yield* adjustArticleBucket("blue", "en", "abc", "category", 1).pipe(
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_LIMIT",
          });
        })
      );
    })
  );
});
