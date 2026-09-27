import { assert, describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { resolveReferenceInput } from "@repo/backend/confect/contentRelease/reference/input";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { materialLayer } from "@repo/backend/content/material/confect";
import { readMaterialReference } from "@repo/backend/content/material/reference";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { Effect } from "effect";

describe("material reference integrity", () => {
  it.effect(
    "returns absent references before ownership and after publication",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const _tCtx = yield* MutationCtx;
            const input = yield* resolveReferenceInput({
              kind: "route",
              appLocale: "en",
              publicPath: "subjects/missing",
            });
            assert(input);
            for (const published of [false, true]) {
              if (published) {
                yield* activateMaterialCatalog();
              }
              const result = yield* readMaterialReference(input).pipe(
                Effect.provide(materialLayer)
              );
              expect(result).toBeNull();
            }
          })
        );
      })
  );
  it.effect("rejects duplicate lesson paths and graph identities", () =>
    Effect.gen(function* () {
      const projection = makeMaterialProjection("en", 1);
      for (const kind of ["route", "content"] as const) {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* activateMaterialCatalog();
            yield* Effect.gen(function* () {
              const rows = yield* Effect.promise(() =>
                tCtx.db.query("materialCatalog").collect()
              );
              const other = rows.find(
                (row) =>
                  row.appLocale === "en" &&
                  row.contentKey !== projection.contentKey
              );
              assert(other);
              yield* Effect.promise(() =>
                tCtx.db.patch("materialCatalog", other._id, {
                  assetId: projection.graph.assetId,
                  publicPath: projection.publicPath,
                })
              );
            });
            const input = yield* resolveReferenceInput(
              kind === "route"
                ? {
                    kind,
                    appLocale: "en",
                    publicPath: projection.publicPath,
                  }
                : {
                    kind,
                    contentId: projection.graph.assetId,
                  }
            );
            assert(input);
            expect(
              yield* readMaterialReference(input).pipe(
                Effect.provide(materialLayer),
                Effect.flip
              )
            ).toMatchObject({
              code: "CONTENT_RELEASE_INTEGRITY",
            });
          })
        );
      }
    })
  );
  it.effect(
    "rejects a topic identity that disagrees with its signed lesson",
    () =>
      Effect.gen(function* () {
        const projection = makeMaterialProjection("en", 1);
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            yield* activateMaterialCatalog();
            yield* Effect.gen(function* () {
              const rows = yield* Effect.promise(() =>
                tCtx.db.query("materialCatalog").collect()
              );
              for (const row of rows.filter(
                (candidate) => candidate.appLocale === "en"
              )) {
                yield* Effect.promise(() =>
                  tCtx.db.patch("materialCatalog", row._id, {
                    topicAssetId: "foreign-topic-identity",
                  })
                );
              }
            });
            const input = yield* resolveReferenceInput({
              kind: "route",
              appLocale: "en",
              publicPath: projection.parentPath,
            });
            assert(input);
            expect(
              yield* readMaterialReference(input).pipe(
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
