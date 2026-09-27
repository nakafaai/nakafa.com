import { describe, expect, it } from "@effect/vitest";
import { ACTIVE_APP_LOCALE_CODES } from "@nakafa/aksara-contracts/locale";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { materialLayer } from "@repo/backend/content/material/confect";
import {
  readLatestMaterials,
  readMaterialBucket,
} from "@repo/backend/content/material/discovery";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  activateMaterialCatalog,
  MATERIAL_IDENTITY,
} from "@repo/backend/test/material/catalog";
import { Effect } from "effect";

describe("contentRelease/material/discovery", () => {
  it.effect(
    "returns bounded unmanaged discovery and rejects invalid limits",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const _targetCtx = yield* MutationCtx;
            expect(
              yield* readMaterialBucket("en", "abc").pipe(
                Effect.provide(materialLayer)
              )
            ).toEqual({
              activeReleaseId: null,
              managed: false,
              materials: null,
            });
            expect(
              yield* readLatestMaterials("en", 2).pipe(
                Effect.provide(materialLayer)
              )
            ).toEqual({
              activeReleaseId: null,
              managed: false,
              materials: [],
            });
            for (const limit of [0, 101, 1.5]) {
              expect(
                yield* readLatestMaterials("en", limit).pipe(
                  Effect.provide(materialLayer),
                  Effect.flip
                )
              ).toMatchObject({
                code: "CONTENT_RELEASE_LIMIT",
              });
            }
          })
        );
      })
  );
  it.effect(
    "reads complete partitions and newest-first material summaries",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const targetCtx = yield* MutationCtx;
            yield* activateMaterialCatalog();
            const count = yield* Effect.promise(() =>
              targetCtx.db
                .query("materialBuckets")
                .withIndex("by_slot_and_appLocale_and_bucket", (query) =>
                  query.eq("slot", "blue").eq("appLocale", "en")
                )
                .first()
            );
            if (!count) {
              throw new Error("Expected one material discovery bucket.");
            }
            expect(
              yield* readMaterialBucket("en", "fff").pipe(
                Effect.provide(materialLayer)
              )
            ).toEqual({
              activeReleaseId: MATERIAL_IDENTITY.releaseId,
              managed: true,
              materials: null,
            });
            expect(
              yield* readMaterialBucket("en", count.bucket).pipe(
                Effect.provide(materialLayer)
              )
            ).toMatchObject({
              activeReleaseId: MATERIAL_IDENTITY.releaseId,
              managed: true,
              materials: [
                {
                  authors: [
                    {
                      name: "Nakafa",
                    },
                  ],
                  datePublished: "2026-07-24",
                  publicPath: expect.stringContaining("subjects/mathematics/"),
                  title: expect.stringContaining("EN Section"),
                },
              ],
            });
            expect(
              yield* readLatestMaterials("en", 1).pipe(
                Effect.provide(materialLayer)
              )
            ).toMatchObject({
              activeReleaseId: MATERIAL_IDENTITY.releaseId,
              managed: true,
              materials: [
                {
                  datePublished: "2026-07-24",
                  title: "EN Section 2",
                },
              ],
            });
          })
        );
      })
  );
  it.effect.each(ACTIVE_APP_LOCALE_CODES)(
    "reads current %s material routes and dates from the localized catalog",
    (appLocale) =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const _targetCtx = yield* MutationCtx;
            yield* activateMaterialCatalog();
            const expected = makeMaterialProjection(appLocale, 2);
            expect(
              yield* readLatestMaterials(appLocale, 1).pipe(
                Effect.provide(materialLayer)
              )
            ).toMatchObject({
              activeReleaseId: MATERIAL_IDENTITY.releaseId,
              managed: true,
              materials: [
                {
                  datePublished: expected.metadata.datePublished,
                  publicPath: expected.publicPath,
                  title: expected.metadata.title,
                },
              ],
            });
          })
        );
      })
  );
});
it.effect("retains the signed description in material discovery", () =>
  Effect.gen(function* () {
    const target = yield* Confect.pipe(Effect.provide(confectLayer));
    yield* target.run(
      Effect.gen(function* () {
        const _targetCtx = yield* MutationCtx;
        const projection = makeMaterialProjection("en", 1);
        yield* activateMaterialCatalog(
          [
            {
              ...projection,
              metadata: {
                ...projection.metadata,
                description: "Signed summary",
              },
            },
          ],
          ["en"]
        );
        expect(
          yield* readLatestMaterials("en", 1).pipe(
            Effect.provide(materialLayer)
          )
        ).toMatchObject({
          materials: [
            {
              description: "Signed summary",
            },
          ],
        });
      })
    );
  })
);
