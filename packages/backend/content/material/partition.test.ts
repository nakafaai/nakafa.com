import { assert, describe, expect, it } from "@effect/vitest";
import {
  DatabaseReader,
  MutationCtx,
} from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { materialLayer } from "@repo/backend/content/material/confect";
import { readMaterialPartition } from "@repo/backend/content/material/partition";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { Effect, Option } from "effect";

/** Reads one concrete English material partition from the test catalog. */
const readEnglishBucket = Effect.fn("test.material.readEnglishBucket")(
  function* () {
    const reader = yield* DatabaseReader;
    const row = yield* reader
      .table("materialBuckets")
      .index("by_slot_and_appLocale_and_bucket", (query) =>
        query.eq("slot", "blue").eq("appLocale", "en")
      )
      .first();
    assert(Option.isSome(row));
    return row.value;
  }
);
describe("contentRelease/material/partition", () => {
  it.effect(
    "distinguishes unmanaged, invalid, and managed-missing partitions",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const _targetCtx = yield* MutationCtx;
            expect(
              yield* readMaterialPartition("en", ["abc"]).pipe(
                Effect.provide(materialLayer)
              )
            ).toEqual({
              activeReleaseId: null,
              kind: "unmanaged",
            });
            expect(
              yield* readMaterialPartition("en", ["invalid"]).pipe(
                Effect.provide(materialLayer),
                Effect.flip
              )
            ).toMatchObject({
              code: "CONTENT_RELEASE_LIMIT",
            });
            yield* activateMaterialCatalog();
            expect(
              yield* readMaterialPartition("en", ["fff"]).pipe(
                Effect.provide(materialLayer)
              )
            ).toEqual({
              activeReleaseId: MATERIAL_IDENTITY.releaseId,
              kind: "missing",
            });
          })
        );
      })
  );
  it.effect("returns a verified partition and rejects count drift", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const targetCtx = yield* MutationCtx;
          yield* activateMaterialCatalog();
          const bucket = yield* readEnglishBucket();
          expect(
            yield* readMaterialPartition("en", [bucket.bucket]).pipe(
              Effect.provide(materialLayer)
            )
          ).toMatchObject({
            activeReleaseId: MATERIAL_IDENTITY.releaseId,
            kind: "found",
            materials: [
              {
                projection: {
                  appLocale: "en",
                  sitemap: true,
                },
              },
            ],
          });
          yield* Effect.promise(() =>
            targetCtx.db.patch("materialBuckets", bucket._id, {
              count: bucket.count + 1,
            })
          );
          expect(
            yield* readMaterialPartition("en", [bucket.bucket]).pipe(
              Effect.provide(materialLayer),
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
