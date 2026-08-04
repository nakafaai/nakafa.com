import { tryoutCatalogIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import {
  TryoutCatalogRowSchema,
  type TryoutSet,
} from "@nakafa/aksara-contracts/tryout/spec";
import { loadTryoutCatalog } from "@repo/backend/convex/contentRelease/tryout/catalog";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  type PublishedSetRow,
  paginatePublishedSets,
} from "@repo/backend/convex/tryouts/sets/page";
import {
  insertTryoutAttempt,
  insertTryoutUser,
} from "@repo/backend/test/tryout-runtime";
import {
  activateTryoutStartSource,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout-source";
import { insertTryoutSet } from "@repo/backend/test/tryouts";
import { convexTest } from "convex-test";
import { Effect, Schema } from "effect";
import { describe, expect, it } from "vitest";

/** Creates another valid set in the same signed track for pagination tests. */
function makeSecondSet(source: TryoutSet) {
  const row = Schema.decodeUnknownSync(TryoutCatalogRowSchema)({
    ...source,
    order: source.order + 1,
    publicPath: `${source.publicPath}-2`,
    setKey: "set-2",
    title: "Set 2",
  });
  if (row.kind !== "set") {
    throw new Error("Expected a signed try-out set fixture.");
  }
  return row;
}

describe("tryouts/sets/page", () => {
  it("invalidates a loaded cursor when user progress changes its rows", async () => {
    const t = convexTest(schema, convexModules);
    const progressId = await t.mutation(async (ctx) => {
      await activateTryoutStartSource(ctx, "visible");
      const userId = await insertTryoutUser(ctx, {
        authId: "auth-signed-page",
        email: "signed-page@example.com",
        name: "Signed Page",
      });
      const tryoutSetId = await insertTryoutSet(ctx, {
        examKey: TRYOUT_START_EXAM,
        setKey: TRYOUT_START_SET,
        trackKey: TRYOUT_START_TRACK,
      });
      const attemptId = await insertTryoutAttempt(ctx, {
        scoringStrategy: "raw",
        sectionSnapshots: [],
        tryoutSetId,
        userId,
      });
      return ctx.db.insert("tryoutSetProgress", {
        attemptNumber: 1,
        countryKey: TRYOUT_START_COUNTRY,
        examKey: TRYOUT_START_EXAM,
        latestAttemptId: attemptId,
        locale: "id",
        publishedScore: null,
        setIdentity: tryoutCatalogIdentity({
          countryKey: TRYOUT_START_COUNTRY,
          examKey: TRYOUT_START_EXAM,
          kind: "set",
          locale: "id",
          setKey: TRYOUT_START_SET,
          trackKey: TRYOUT_START_TRACK,
        }),
        setKey: TRYOUT_START_SET,
        status: "in-progress",
        statusRank: 1,
        trackKey: TRYOUT_START_TRACK,
        tryoutSetId,
        updatedAt: 1,
        userId,
      });
    });

    const failure = await t.query(async (ctx) => {
      const catalog = await Effect.runPromise(loadTryoutCatalog(ctx, "id"));
      if (!catalog.managed) {
        throw new Error("Expected a managed signed try-out catalog.");
      }
      const firstSet = catalog.entries.find(
        ({ row }) => row.kind === "set" && row.locale === "id"
      )?.row;
      const progress = await ctx.db.get(progressId);
      if (!(firstSet?.kind === "set" && progress)) {
        throw new Error("Expected signed pagination fixtures.");
      }
      const secondSet = makeSecondSet(firstSet);
      const initialRows: readonly PublishedSetRow[] = [
        { progress: null, set: firstSet },
        { progress: null, set: secondSet },
      ];
      const firstPage = await Effect.runPromise(
        paginatePublishedSets(
          catalog,
          { cursor: null, numItems: 1 },
          initialRows
        )
      );
      const changedRows: readonly PublishedSetRow[] = [
        { progress, set: firstSet },
        { progress: null, set: secondSet },
      ];
      return Effect.runPromise(
        paginatePublishedSets(
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
        )
      );
    });

    expect(failure).toMatchObject({
      code: "INVALID_TRYOUT_SET_CURSOR",
      message: "InvalidCursor: The try-out set pagination state changed.",
    });
  });
});
