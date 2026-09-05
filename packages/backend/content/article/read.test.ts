import { assert, describe, expect, it } from "@effect/vitest";
import { api } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { categorizedArticle } from "@repo/backend/test/article/release";
import {
  insertRuntimeArticles,
  insertRuntimeRelease,
} from "@repo/backend/test/content/runtime";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const article = api.contentRelease.article;
const firstPage = {
  appLocale: "en",
  expectedManifestHash: null,
  expectedReleaseId: null,
  paginationOpts: { cursor: null, numItems: 2 },
} as const;

describe("article publication pages", () => {
  it.effect(
    "keeps inactive article pages empty and restarts stale cursors",
    () =>
      Effect.gen(function* () {
        for (const materialOnly of [false, true]) {
          const t = convexTest(schema, convexModules);
          if (materialOnly) {
            yield* Effect.promise(() =>
              t.mutation((ctx) => insertRuntimeRelease(ctx, ["material"]))
            );
          }
          const empty = yield* Effect.promise(() =>
            t.query(article.publications, {
              ...firstPage,
              category: "politics",
            })
          );
          expect(empty).toMatchObject({
            managed: false,
            result: { page: [], isDone: true },
            stale: false,
          });
          const args = {
            ...firstPage,
            expectedManifestHash: "previous-manifest",
            expectedReleaseId: "previous-release",
            paginationOpts: { cursor: "previous-page", numItems: 2 },
          };
          const stalePages = yield* Effect.promise(() =>
            Promise.all([
              t.query(article.categories, args),
              t.query(article.publications, { ...args, category: "politics" }),
            ])
          );
          for (const stale of stalePages) {
            expect(stale).toMatchObject({
              activeManifestHash: null,
              activeReleaseId: null,
              managed: false,
              result: { page: [], isDone: true },
              sourceRevision: null,
              stale: true,
            });
          }
        }
      })
  );

  it.effect(
    "rejects caller end positions while accepting the first-page null sentinel",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) => insertRuntimeArticles(ctx, 1))
        );
        for (const endCursor of [null, "foreign-page"]) {
          const args = {
            ...firstPage,
            paginationOpts: { ...firstPage.paginationOpts, endCursor },
          };
          const categories = t.query(article.categories, args);
          const publications = t.query(article.publications, {
            ...args,
            category: "politics",
          });
          if (endCursor === null) {
            const results = yield* Effect.promise(() =>
              Promise.all([categories, publications])
            );
            expect(
              results.every((result) => result.result.page.length === 1)
            ).toBe(true);
          } else {
            yield* Effect.promise(() =>
              Promise.all(
                [categories, publications].map((query) =>
                  expect(query).rejects.toMatchObject({
                    data: { code: "CONTENT_RELEASE_LIMIT" },
                  })
                )
              )
            );
          }
        }
      })
  );

  it.effect(
    "preserves a budget split and a completed category continuation",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() =>
          t.mutation((ctx) =>
            insertRuntimeArticles(ctx, 2, (index) =>
              categorizedArticle({
                article: index,
                category: `category-${index}`,
                route: `category-${index}`,
                title: `Category ${index}`,
              })
            )
          )
        );
        const first = yield* Effect.promise(() =>
          t.query(article.categories, {
            ...firstPage,
            paginationOpts: { cursor: null, numItems: 2, maximumRowsRead: 2 },
          })
        );
        expect(first.result).toMatchObject({
          pageStatus: "SplitRequired",
          splitCursor: expect.any(String),
        });
        assert("splitCursor" in first.result && first.result.splitCursor);
        const splitCursor = first.result.splitCursor;
        const identity = {
          appLocale: firstPage.appLocale,
          expectedManifestHash: first.activeManifestHash,
          expectedReleaseId: first.activeReleaseId,
        };
        const complete = yield* Effect.promise(() =>
          t.query(article.categories, {
            ...identity,
            paginationOpts: {
              cursor: first.result.continueCursor,
              numItems: 2,
            },
          })
        );
        expect(complete.result).toMatchObject({
          continueCursor: first.result.continueCursor,
          page: [],
          isDone: true,
        });
        const split = yield* Effect.promise(() =>
          t.query(article.categories, {
            ...identity,
            paginationOpts: {
              cursor: splitCursor,
              numItems: 2,
            },
          })
        );
        expect(split.result.page).toEqual(first.result.page.slice(1));
        yield* Effect.promise(() =>
          t.mutation(async (ctx) => {
            for (const row of await ctx.db
              .query("articleCategories")
              .collect()) {
              await ctx.db.delete("articleCategories", row._id);
            }
          })
        );
        const empty = yield* Effect.promise(() =>
          t.query(article.categories, firstPage)
        );
        expect(empty.result).toMatchObject({ page: [], isDone: true });
      })
  );
});
