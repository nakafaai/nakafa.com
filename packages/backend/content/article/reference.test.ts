import { assert, describe, expect, it } from "@effect/vitest";
import { MutationCtx } from "@repo/backend/confect/_generated/services";
import { resolveReferenceInput } from "@repo/backend/confect/contentRelease/reference/input";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { articleLayer } from "@repo/backend/content/article/confect";
import { readArticleReference } from "@repo/backend/content/article/reference";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { Effect } from "effect";

describe("article reference integrity", () => {
  it.effect(
    "returns absent references before ownership and after publication",
    () =>
      Effect.gen(function* () {
        const t = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* t.run(
          Effect.gen(function* () {
            const tCtx = yield* MutationCtx;
            const input = yield* resolveReferenceInput({
              kind: "route",
              appLocale: "en",
              publicPath: "articles/missing",
            });
            assert(input);
            for (const published of [false, true]) {
              if (published) {
                yield* Effect.promise(() => insertRuntimeArticles(tCtx, 1));
              }
              const result = yield* readArticleReference(input).pipe(
                Effect.provide(articleLayer)
              );
              expect(result).toBeNull();
            }
          })
        );
      })
  );
  it.effect(
    "rejects duplicate public paths and graph identities before returning search content",
    () =>
      Effect.gen(function* () {
        const projection = testArticleProjection(0);
        for (const kind of ["route", "content"] as const) {
          const t = yield* Confect.pipe(Effect.provide(confectLayer));
          yield* t.run(
            Effect.gen(function* () {
              const tCtx = yield* MutationCtx;
              yield* Effect.gen(function* () {
                yield* Effect.promise(() => insertRuntimeArticles(tCtx, 2));
                const rows = yield* Effect.promise(() =>
                  tCtx.db.query("articleCatalog").collect()
                );
                const other = rows.find(
                  (row) => row.contentKey !== projection.contentKey
                );
                assert(other);
                yield* Effect.promise(() =>
                  tCtx.db.patch("articleCatalog", other._id, {
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
                yield* readArticleReference(input).pipe(
                  Effect.provide(articleLayer),
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
});
it.effect("retains the signed description in an article reference", () =>
  Effect.gen(function* () {
    const t = yield* Confect.pipe(Effect.provide(confectLayer));
    yield* t.run(
      Effect.gen(function* () {
        const tCtx = yield* MutationCtx;
        const projection = testArticleProjection(0);
        yield* Effect.promise(() =>
          insertRuntimeArticles(tCtx, 1, () => ({
            ...projection,
            metadata: {
              ...projection.metadata,
              description: "Signed summary",
            },
          }))
        );
        const input = yield* resolveReferenceInput({
          kind: "route",
          appLocale: "en",
          publicPath: projection.publicPath,
        });
        assert(input);
        const result = yield* readArticleReference(input).pipe(
          Effect.provide(articleLayer)
        );
        expect(result).toMatchObject({
          description: "Signed summary",
        });
      })
    );
  })
);
