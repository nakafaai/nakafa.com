import { describe, expect, it } from "@effect/vitest";
import { AppLocaleSchema } from "@nakafa/aksara-contracts/locale";
import {
  type TryoutSet,
  TryoutSetSchema,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import { loadTryoutCatalog } from "@repo/backend/content/tryout/catalog";
import { convexTryoutLayer } from "@repo/backend/content/tryout/convex";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  type PublishedSetRow,
  paginatePublishedSets,
} from "@repo/backend/convex/tryouts/sets/page";
import {
  insertTryoutAttempt,
  insertTryoutUser,
} from "@repo/backend/test/tryout/runtime";
import {
  activateTryoutStartSource,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout/source";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";

/** Creates another valid set in the same signed track for pagination tests. */
const makeSecondSet = Effect.fn("tryouts.sets.page.test.makeSecondSet")(
  function* (source: TryoutSet) {
    return yield* Schema.decodeEffect(TryoutSetSchema)({
      ...source,
      order: source.order + 1,
      publicPath: `${source.publicPath}-2`,
      setKey: "set-2",
      title: "Set 2",
    }).pipe(Effect.orDie);
  }
);

describe("tryouts/sets/page", () => {
  it.effect(
    "invalidates a loaded cursor when user progress changes its rows",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        const progressId = yield* Effect.promise(() =>
          t.mutation((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const fixture = yield* Effect.promise(() =>
                  activateTryoutStartSource(ctx, "visible")
                );
                const userId = yield* Effect.promise(() =>
                  insertTryoutUser(ctx, {
                    authId: "auth-signed-page",
                    email: "signed-page@example.com",
                    name: "Signed Page",
                  })
                );
                const attemptId = yield* Effect.promise(() =>
                  insertTryoutAttempt(ctx, {
                    scoringStrategy: "raw",
                    sectionSnapshots: [],
                    set: fixture.set,
                    userId,
                  })
                );
                return yield* Effect.promise(() =>
                  ctx.db.insert("tryoutSetProgress", {
                    attemptNumber: 1,
                    countryKey: TRYOUT_START_COUNTRY,
                    examKey: TRYOUT_START_EXAM,
                    latestAttemptId: attemptId,
                    appLocale: "id",
                    publishedScore: null,
                    setIdentity: tryoutCatalogNodeIdentity({
                      appLocale: AppLocaleSchema.make("id"),
                      countryKey: TRYOUT_START_COUNTRY,
                      examKey: TRYOUT_START_EXAM,
                      kind: "set",
                      setKey: TRYOUT_START_SET,
                      trackKey: TRYOUT_START_TRACK,
                    }),
                    setKey: TRYOUT_START_SET,
                    status: "in-progress",
                    statusRank: 1,
                    trackKey: TRYOUT_START_TRACK,
                    updatedAt: 1,
                    userId,
                  })
                );
              })
            )
          )
        );

        const failure = yield* Effect.promise(() =>
          t.query((ctx) =>
            runConvexProgram(
              Effect.gen(function* () {
                const catalog = yield* loadTryoutCatalog("id").pipe(
                  Effect.provide(convexTryoutLayer(ctx))
                );
                const firstSet = catalog.entries.find(
                  ({ row }) => row.kind === "set" && row.appLocale === "id"
                )?.row;
                const progress = yield* Effect.promise(() =>
                  ctx.db.get(progressId)
                );
                if (!(firstSet?.kind === "set" && progress)) {
                  return yield* Effect.die(
                    "Expected signed pagination fixtures."
                  );
                }
                const secondSet = yield* makeSecondSet(firstSet);
                const initialRows: readonly PublishedSetRow[] = [
                  { progress: null, set: firstSet },
                  { progress: null, set: secondSet },
                ];
                const firstPage = yield* paginatePublishedSets(
                  catalog,
                  { cursor: null, numItems: 1 },
                  initialRows
                );
                const secondPage = yield* paginatePublishedSets(
                  catalog,
                  { cursor: firstPage.continueCursor, numItems: 1 },
                  initialRows
                );
                expect(secondPage).toMatchObject({
                  continueCursor: "",
                  isDone: true,
                  page: [{ setKey: "set-2" }],
                });
                const separator = firstPage.continueCursor.lastIndexOf(":");
                const cursorPrefix = firstPage.continueCursor.slice(
                  0,
                  separator + 1
                );
                for (const offset of ["-1", "1.5", "not-a-number"]) {
                  expect(
                    yield* paginatePublishedSets(
                      catalog,
                      {
                        cursor: `${cursorPrefix}${offset}`,
                        numItems: 1,
                      },
                      initialRows
                    ).pipe(Effect.flip, Effect.orDie)
                  ).toMatchObject({
                    code: "INVALID_TRYOUT_SET_CURSOR",
                  });
                }
                const changedRows: readonly PublishedSetRow[] = [
                  { progress, set: firstSet },
                  { progress: null, set: secondSet },
                ];
                return yield* paginatePublishedSets(
                  catalog,
                  { cursor: firstPage.continueCursor, numItems: 1 },
                  changedRows
                ).pipe(
                  Effect.match({
                    onFailure: (error) => ({
                      code: error.code,
                      message: error.message,
                    }),
                    onSuccess: () => null,
                  })
                );
              })
            )
          )
        );

        expect(failure).toMatchObject({
          code: "INVALID_TRYOUT_SET_CURSOR",
          message: "InvalidCursor: The try-out set pagination state changed.",
        });
      })
  );
});
