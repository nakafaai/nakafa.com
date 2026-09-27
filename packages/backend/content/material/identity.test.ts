import { describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { materialLayer } from "@repo/backend/content/material/confect";
import { readMaterialIdentity } from "@repo/backend/content/material/identity";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  activateMaterialCatalog,
  advanceMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { Effect } from "effect";

const projection = makeMaterialProjection("en", 1);
const identity = {
  appLocale: projection.appLocale,
  contentKey: projection.contentKey,
  expectedMaterialKey: projection.materialKey,
  expectedSectionKey: projection.sectionKey,
};
describe("contentRelease/material/identity", () => {
  it.effect("resolves one exact active signed material", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const _targetCtx = yield* MutationCtx;
          yield* activateMaterialCatalog();
          expect(
            yield* readMaterialIdentity(identity).pipe(
              Effect.provide(materialLayer)
            )
          ).toEqual({
            activeReleaseId: MATERIAL_IDENTITY.releaseId,
            managed: true,
            publicPath: projection.publicPath,
          });
        })
      );
    })
  );
  it.effect(
    "resolves an inherited material through its effective active head",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const _targetCtx = yield* MutationCtx;
            yield* activateMaterialCatalog();
            yield* advanceMaterialCatalog();
            expect(
              yield* readMaterialIdentity(identity).pipe(
                Effect.provide(materialLayer)
              )
            ).toEqual({
              activeReleaseId: "release-next",
              managed: true,
              publicPath: projection.publicPath,
            });
          })
        );
      })
  );
  it.effect("distinguishes unmanaged and absent material identities", () =>
    Effect.gen(function* () {
      const unmanaged = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* unmanaged.run(
        Effect.gen(function* () {
          const _unmanagedCtx = yield* MutationCtx;
          expect(
            yield* readMaterialIdentity(identity).pipe(
              Effect.provide(materialLayer)
            )
          ).toEqual({
            activeReleaseId: null,
            managed: false,
            publicPath: null,
          });
          const absent = yield* Confect.pipe(Effect.provide(confectLayer));
          yield* absent.run(
            Effect.gen(function* () {
              const _absentCtx = yield* MutationCtx;
              yield* activateMaterialCatalog();
              expect(
                yield* readMaterialIdentity({
                  ...identity,
                  contentKey: "material/lesson/test/missing/section-1",
                }).pipe(Effect.provide(materialLayer))
              ).toMatchObject({
                managed: true,
                publicPath: null,
              });
            })
          );
        })
      );
    })
  );
  it.effect("rejects mismatched claims and stale active rows", () =>
    Effect.gen(function* () {
      const mismatch = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* mismatch.run(
        Effect.gen(function* () {
          const _mismatchCtx = yield* MutationCtx;
          yield* activateMaterialCatalog();
          expect(
            yield* readMaterialIdentity({
              ...identity,
              expectedSectionKey: "section-2",
            }).pipe(Effect.provide(materialLayer), Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_INTEGRITY",
          });
          const stale = yield* Confect.pipe(Effect.provide(confectLayer));
          yield* stale.run(
            Effect.gen(function* () {
              const staleCtx = yield* MutationCtx;
              yield* activateMaterialCatalog();
              yield* Effect.gen(function* () {
                const row = yield* Effect.promise(() =>
                  staleCtx.db
                    .query("materialCatalog")
                    .withIndex(
                      "by_slot_and_contentKey_and_appLocale",
                      (index) =>
                        index
                          .eq("slot", "blue")
                          .eq("contentKey", projection.contentKey)
                          .eq("appLocale", projection.appLocale)
                    )
                    .unique()
                );
                if (!row) {
                  throw new Error("Expected one current material row.");
                }
                yield* Effect.promise(() =>
                  staleCtx.db.patch("materialCatalog", row._id, {
                    sequence: 2,
                  })
                );
              });
              expect(
                yield* readMaterialIdentity(identity).pipe(
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
    })
  );
  it.effect("rejects malformed stable identity inputs", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const _targetCtx = yield* MutationCtx;
          expect(
            yield* readMaterialIdentity({
              ...identity,
              expectedMaterialKey: "invalid",
            }).pipe(Effect.provide(materialLayer), Effect.flip)
          ).toMatchObject({
            code: "CONTENT_RELEASE_LIMIT",
          });
        })
      );
    })
  );
});
