import { describe, expect, it } from "@effect/vitest";
import refs from "@repo/backend/confect/_generated/refs";
import {
  MutationCtx,
  QueryRunner,
} from "@repo/backend/confect/_generated/services";
import { deriveMaterialTopicReference } from "@repo/backend/confect/contentRelease/material/topic";
import { Confect, confectLayer } from "@repo/backend/confect/test.setup";
import { makeMaterialProjection } from "@repo/backend/test/content/material";
import {
  insertRuntimeArticles,
  testArticleProjection,
} from "@repo/backend/test/content/runtime";
import { activateMaterialCatalog } from "@repo/backend/test/material/catalog";
import { makeQuranSearch } from "@repo/backend/test/quran/rows";
import { activateQuranSnapshot } from "@repo/backend/test/quran/snapshot";
import {
  activateTryoutSnapshot,
  makeTryoutCatalogRow,
  makeTryoutPlacementRow,
} from "@repo/backend/test/tryout/snapshot";
import { Effect } from "effect";

describe("contentRelease/reference/read", () => {
  it.effect(
    "resolves current signed articles by route and graph identity",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const targetCtx = yield* MutationCtx;
            const article = testArticleProjection(0);
            yield* Effect.promise(() => insertRuntimeArticles(targetCtx, 1));
            for (const input of [
              {
                kind: "route" as const,
                appLocale: article.appLocale,
                publicPath: article.publicPath,
              },
              {
                contentId: article.graph.assetId,
                kind: "content" as const,
              },
            ]) {
              expect(
                yield* (yield* QueryRunner)(
                  refs.public.contentRelease.reference.read,
                  {
                    input,
                  }
                )
              ).toMatchObject({
                content_id: article.graph.assetId,
                route: article.publicPath,
                section: "articles",
                title: article.metadata.title,
              });
            }
          })
        );
      })
  );
  it.effect(
    "resolves current signed materials by route and graph identity",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const material = makeMaterialProjection("en", 1);
            yield* activateMaterialCatalog([material]);
            for (const input of [
              {
                kind: "route" as const,
                appLocale: material.appLocale,
                publicPath: material.publicPath,
              },
              {
                contentId: material.graph.assetId,
                kind: "content" as const,
              },
            ]) {
              expect(
                yield* (yield* QueryRunner)(
                  refs.public.contentRelease.reference.read,
                  {
                    input,
                  }
                )
              ).toMatchObject({
                content_id: material.graph.assetId,
                route: material.publicPath,
                section: "material",
                title: material.metadata.title,
              });
            }
          })
        );
      })
  );
  it.effect(
    "resolves current signed material topics by route and graph identity",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const material = makeMaterialProjection("en", 1);
            const topic = yield* deriveMaterialTopicReference(material);
            yield* activateMaterialCatalog([material]);
            for (const input of [
              {
                kind: "route" as const,
                appLocale: topic.appLocale,
                publicPath: topic.publicPath,
              },
              {
                contentId: topic.graph.assetId,
                kind: "content" as const,
              },
            ]) {
              const result = yield* (yield* QueryRunner)(
                refs.public.contentRelease.reference.read,
                {
                  input,
                }
              );
              expect(result).toMatchObject({
                content_id: topic.graph.assetId,
                route: topic.publicPath,
                section: "material",
                title: topic.title,
              });
              expect(result).not.toHaveProperty("markdown_url");
            }
          })
        );
      })
  );
  it.effect("resolves one active signed Quran identity", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const targetCtx = yield* MutationCtx;
          const quran = makeQuranSearch("en", 1);
          yield* Effect.promise(() =>
            activateQuranSnapshot(targetCtx, [quran])
          );
          for (const input of [
            {
              contentId: quran.graph.assetId,
              kind: "content" as const,
            },
            {
              kind: "route" as const,
              appLocale: quran.appLocale,
              publicPath: quran.route,
            },
          ]) {
            expect(
              yield* (yield* QueryRunner)(
                refs.public.contentRelease.reference.read,
                {
                  input,
                }
              )
            ).toMatchObject({
              content_id: quran.graph.assetId,
              route: quran.route,
              section: "quran",
              title: quran.title,
            });
          }
        })
      );
    })
  );
  it.effect("resolves one active signed try-out identity", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          const targetCtx = yield* MutationCtx;
          const tryout = makeTryoutCatalogRow("en").record.row;
          yield* Effect.promise(() =>
            activateTryoutSnapshot(targetCtx, {
              catalog: [tryout, makeTryoutCatalogRow("id").record.row],
              placements: [
                makeTryoutPlacementRow("en").record.row,
                makeTryoutPlacementRow("id").record.row,
              ],
            })
          );
          for (const input of [
            {
              contentId: tryout.graph.assetId,
              kind: "content" as const,
            },
            {
              kind: "route" as const,
              appLocale: "en" as const,
              publicPath: "try-out/indonesia",
            },
          ]) {
            expect(
              yield* (yield* QueryRunner)(
                refs.public.contentRelease.reference.read,
                {
                  input,
                }
              )
            ).toMatchObject({
              content_id: tryout.graph.assetId,
              route: "try-out/indonesia",
              section: "tryout",
              title: tryout.title,
            });
          }
        })
      );
    })
  );
  it.effect(
    "rejects a Quran asset index that drifted from its signed row",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const targetCtx = yield* MutationCtx;
            const quran = makeQuranSearch("en", 1);
            const other = makeQuranSearch("en", 2);
            yield* Effect.promise(() =>
              activateQuranSnapshot(targetCtx, [quran])
            );
            yield* Effect.gen(function* () {
              const search = yield* Effect.promise(() =>
                targetCtx.db.query("quranSearch").unique()
              );
              if (!search) {
                throw new Error("Expected one Quran search fixture.");
              }
              yield* Effect.promise(() =>
                targetCtx.db.patch("quranSearch", search._id, {
                  assetId: other.graph.assetId,
                })
              );
            });
            expect(
              yield* (yield* QueryRunner)(
                refs.public.contentRelease.reference.read,
                {
                  input: {
                    contentId: other.graph.assetId,
                    kind: "content",
                  },
                }
              ).pipe(Effect.flip)
            ).toMatchObject({
              message: expect.stringContaining("changed its signed projection"),
            });
          })
        );
      })
  );
  it.effect("returns null when no active signed family owns the identity", () =>
    Effect.gen(function* () {
      const target = yield* Confect.pipe(Effect.provide(confectLayer));
      yield* target.run(
        Effect.gen(function* () {
          expect(
            yield* (yield* QueryRunner)(
              refs.public.contentRelease.reference.read,
              {
                input: {
                  kind: "route",
                  appLocale: "en",
                  publicPath: "articles/missing/item",
                },
              }
            )
          ).toBeNull();
          expect(
            yield* (yield* QueryRunner)(
              refs.public.contentRelease.reference.read,
              {
                input: {
                  contentId: "not-a-current-graph-asset",
                  kind: "content",
                },
              }
            )
          ).toBeNull();
        })
      );
    })
  );
  it.effect(
    "returns null when an active locale has no matching signed identity",
    () =>
      Effect.gen(function* () {
        const target = yield* Confect.pipe(Effect.provide(confectLayer));
        yield* target.run(
          Effect.gen(function* () {
            const material = makeMaterialProjection("de", 1);
            expect(
              yield* (yield* QueryRunner)(
                refs.public.contentRelease.reference.read,
                {
                  input: {
                    kind: "route",
                    appLocale: "de",
                    publicPath: material.publicPath,
                  },
                }
              )
            ).toBeNull();
            expect(
              yield* (yield* QueryRunner)(
                refs.public.contentRelease.reference.read,
                {
                  input: {
                    contentId: material.graph.assetId,
                    kind: "content",
                  },
                }
              )
            ).toBeNull();
          })
        );
      })
  );
});
