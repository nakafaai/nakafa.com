import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { CONTENT_BUCKET_SIZE } from "@repo/backend/confect/contentRelease/bucket";
import { adjustMaterialBucket } from "@repo/backend/confect/contentRelease/material/bucket";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { Effect } from "effect";

describe("contentRelease/material/bucket", () => {
  it.effect("creates, updates, and removes one material partition", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const targetCtx = yield* MutationCtx;
          yield* adjustMaterialBucket("blue", "en", "abc", 1);
          yield* adjustMaterialBucket("blue", "en", "abc", 1);
          expect(
            yield* Effect.promise(() =>
              targetCtx.db.query("materialBuckets").unique()
            )
          ).toMatchObject({
            appLocale: "en",
            bucket: "abc",
            count: 2,
          });
          yield* adjustMaterialBucket("blue", "en", "abc", -1);
          yield* adjustMaterialBucket("blue", "en", "abc", -1);
          expect(
            yield* Effect.promise(() =>
              targetCtx.db.query("materialBuckets").unique()
            )
          ).toBeNull();
        })
      );
    })
  );
  it.effect("rejects invalid, underflowing, and overflowing partitions", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const targetCtx = yield* MutationCtx;
          expect(
            yield* adjustMaterialBucket("blue", "en", "invalid", 1).pipe(
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
          expect(
            yield* adjustMaterialBucket("blue", "en", "abc", -1).pipe(
              Effect.flip
            )
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
          yield* Effect.promise(() =>
            targetCtx.db.insert("materialBuckets", {
              bucket: "abc",
              count: CONTENT_BUCKET_SIZE,
              appLocale: "en",
              slot: "blue",
            })
          );
          expect(
            yield* adjustMaterialBucket("blue", "en", "abc", 1).pipe(
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
