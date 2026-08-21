import {
  ACTIVE_APP_LOCALE_CODES,
  AppLocaleSchema,
} from "@nakafa/aksara-contracts/locale";
import {
  type TryoutCatalogRow,
  TryoutCatalogRowSchema,
} from "@nakafa/aksara-contracts/tryout/catalog";
import { tryoutCatalogNodeIdentity } from "@nakafa/aksara-contracts/tryout/identity";
import { TRYOUT_SET_QUESTION_LIMIT } from "@repo/backend/convex/contentRelease/tryout/limits";
import {
  readTryoutSet,
  type TryoutSetIdentity,
} from "@repo/backend/convex/contentRelease/tryout/set";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { activateTryoutSnapshot } from "@repo/backend/test/tryout-snapshot";
import {
  makeTryoutStartCatalog,
  makeTryoutStartPlacement,
  TRYOUT_START_COUNTRY,
  TRYOUT_START_EXAM,
  TRYOUT_START_SECTION,
  TRYOUT_START_SET,
  TRYOUT_START_TRACK,
} from "@repo/backend/test/tryout-source";
import { convexTest } from "convex-test";
import { Schema } from "effect";
import { describe, expect, it } from "vitest";

const identity: TryoutSetIdentity = {
  countryKey: TRYOUT_START_COUNTRY,
  examKey: TRYOUT_START_EXAM,
  locale: "id",
  setKey: TRYOUT_START_SET,
  trackKey: TRYOUT_START_TRACK,
};

/** Activates one complete signed start fixture in every active locale. */
async function activateSet(
  transform: (
    rows: readonly TryoutCatalogRow[]
  ) => readonly TryoutCatalogRow[] = (rows) => rows
) {
  const t = convexTest(schema, convexModules);
  const catalog = transform(
    ACTIVE_APP_LOCALE_CODES.flatMap((locale) =>
      makeTryoutStartCatalog(locale, "visible")
    )
  );
  const snapshotId = await t.mutation((ctx) =>
    activateTryoutSnapshot(ctx, {
      catalog,
      placements: ACTIVE_APP_LOCALE_CODES.map(makeTryoutStartPlacement),
    })
  );
  return { snapshotId, t };
}

describe("contentRelease/tryout/set", () => {
  it("returns one complete verified set and its signed sections", async () => {
    const { snapshotId, t } = await activateSet();

    await expect(
      t.query((ctx) => runConvexProgram(readTryoutSet(ctx, identity)))
    ).resolves.toMatchObject({
      sections: [
        {
          placements: [{ row: { questionOrder: 1, scope: "server" } }],
          section: { row: { kind: "section", questionCount: 1 } },
        },
      ],
      set: { row: { kind: "set", questionCount: 1, sectionCount: 1 } },
      setIdentity: expect.any(String),
      snapshotId,
    });
  });

  it("fails closed before publication or when the set is missing", async () => {
    const unpublished = convexTest(schema, convexModules);
    await expect(
      unpublished.query((ctx) => runConvexProgram(readTryoutSet(ctx, identity)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });

    const published = await activateSet();
    await expect(
      published.t.query((ctx) =>
        runConvexProgram(readTryoutSet(ctx, { ...identity, setKey: "missing" }))
      )
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_MISSING" } });
  });

  it("rejects signed set counts that do not match their sections", async () => {
    const { t } = await activateSet((rows) =>
      rows.map((row) => {
        if (row.kind !== "set") {
          return row;
        }
        return Schema.decodeSync(TryoutCatalogRowSchema)({
          ...row,
          questionCount: 2,
        });
      })
    );

    await expect(
      t.query((ctx) => runConvexProgram(readTryoutSet(ctx, identity)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects a set whose indexed owner identity was changed", async () => {
    const { snapshotId, t } = await activateSet();
    const setIdentity = tryoutCatalogNodeIdentity({
      appLocale: AppLocaleSchema.make(identity.locale),
      countryKey: identity.countryKey,
      examKey: identity.examKey,
      kind: "set",
      setKey: identity.setKey,
      trackKey: identity.trackKey,
    });
    await t.mutation(async (ctx) => {
      const stored = await ctx.db
        .query("tryoutCatalog")
        .withIndex("by_snapshotId_and_identity", (index) =>
          index.eq("snapshotId", snapshotId).eq("identity", setIdentity)
        )
        .unique();

      if (!stored) {
        throw new Error("Expected one signed catalog row.");
      }
      await ctx.db.patch(stored._id, { setIdentity: "changed-set" });
    });

    await expect(
      t.query((ctx) => runConvexProgram(readTryoutSet(ctx, identity)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });

  it("rejects a set beyond the aggregate placement budget", async () => {
    const { t } = await activateSet((rows) =>
      rows.map((row) => {
        if (row.kind !== "set") {
          return row;
        }
        return Schema.decodeSync(TryoutCatalogRowSchema)({
          ...row,
          questionCount: TRYOUT_SET_QUESTION_LIMIT + 1,
        });
      })
    );

    await expect(
      t.query((ctx) => runConvexProgram(readTryoutSet(ctx, identity)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_LIMIT" } });
  });

  it("rejects an internal entry key bound to a visible section", async () => {
    const { t } = await activateSet((rows) =>
      rows.map((row) => {
        if (row.kind !== "set") {
          return row;
        }
        return Schema.decodeSync(TryoutCatalogRowSchema)({
          ...row,
          internalEntrySectionKey: TRYOUT_START_SECTION,
          visibleSectionCount: 0,
        });
      })
    );

    await expect(
      t.query((ctx) => runConvexProgram(readTryoutSet(ctx, identity)))
    ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_INTEGRITY" } });
  });
});
