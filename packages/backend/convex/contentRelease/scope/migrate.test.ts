import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  ACTIVE,
  MATERIAL_KEY,
  RECOVERY,
  seedOwnershipHistory,
} from "@repo/backend/test/owner-migration";
import { convexTest } from "convex-test";
import { describe, expect, it } from "vitest";

const migrate = internal.contentRelease.scope.migrate.migrateOwnership;
const stageRecovery = internal.contentRelease.manifest.stageRecovery;
const stageRelease = internal.contentRelease.manifest.stageRelease;

describe("contentRelease/scope/migrate", () => {
  it("previews, applies, and idempotently proves production ownership", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedOwnershipHistory);

    const expected = {
      activeFamilies: ["article"],
      insertedOwners: 0,
      ownerCount: 6,
      pendingOwners: 6,
      pendingReleases: 8,
      recoveryFamilies: [],
      releaseCount: 8,
      updatedReleases: 0,
    };
    await expect(
      t.mutation(migrate, {
        apply: false,
        expectedOwners: 6,
        expectedReleases: 8,
      })
    ).resolves.toEqual(expected);
    await expect(
      t.mutation(migrate, {
        apply: true,
        expectedOwners: 6,
        expectedReleases: 8,
      })
    ).resolves.toEqual({
      ...expected,
      insertedOwners: 6,
      updatedReleases: 8,
    });
    await expect(
      t.mutation(migrate, {
        apply: true,
        expectedOwners: 6,
        expectedReleases: 8,
      })
    ).resolves.toEqual({
      ...expected,
      pendingOwners: 0,
      pendingReleases: 0,
    });

    const owners = await t.run((ctx) =>
      ctx.db.query("contentOwners").withIndex("by_sequence").take(1001)
    );
    expect(
      owners.map(({ locale, managed, sequence }) => ({
        locale,
        managed,
        sequence,
      }))
    ).toEqual([
      { locale: "en", managed: true, sequence: 1 },
      { locale: "id", managed: true, sequence: 1 },
      { locale: "en", managed: false, sequence: 2 },
      { locale: "id", managed: false, sequence: 2 },
      { locale: "en", managed: true, sequence: 3 },
      { locale: "id", managed: true, sequence: 3 },
    ]);
    const [active, recovery] = await t.run((ctx) =>
      Promise.all([
        ctx.db
          .query("contentReleases")
          .withIndex("by_releaseId", (query) =>
            query.eq("releaseId", ACTIVE.releaseId)
          )
          .unique(),
        ctx.db
          .query("contentReleases")
          .withIndex("by_releaseId", (query) =>
            query.eq("releaseId", RECOVERY.releaseId)
          )
          .unique(),
      ])
    );
    expect(active).toBeDefined();
    expect(recovery).toBeDefined();
    if (!(active && recovery)) {
      return;
    }
    await expect(
      t.mutation(stageRelease, {
        releaseJson: active.releaseJson,
        rendererJson: active.rendererJson,
      })
    ).resolves.toMatchObject({ phase: "completed" });
    await expect(
      t.mutation(stageRecovery, {
        releaseJson: recovery.releaseJson,
        rendererJson: recovery.rendererJson,
      })
    ).resolves.toMatchObject({ phase: "verified" });
  });

  it("initializes an empty deployment and rejects unsafe assumptions", async () => {
    const empty = convexTest(schema, convexModules);
    await expect(
      empty.mutation(migrate, {
        apply: true,
        expectedOwners: 0,
        expectedReleases: 0,
      })
    ).resolves.toEqual({
      activeFamilies: [],
      insertedOwners: 0,
      ownerCount: 0,
      pendingOwners: 0,
      pendingReleases: 0,
      releaseCount: 0,
      updatedReleases: 0,
    });

    const bounded = convexTest(schema, convexModules);
    await bounded.mutation(seedOwnershipHistory);
    await expect(
      bounded.mutation(migrate, {
        apply: false,
        expectedOwners: 6,
        expectedReleases: 7,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await expect(
      bounded.mutation(migrate, {
        apply: false,
        expectedOwners: 5,
        expectedReleases: 8,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_LIMIT" },
    });
    await bounded.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      expect(state).toBeDefined();
      if (!state) {
        return;
      }
      await ctx.db.patch("contentState", state._id, {
        compactFloor: 2,
        compactFrom: 1,
        compactPhase: "heads",
        compactStartedAt: 0,
      });
    });
    await expect(
      bounded.mutation(migrate, {
        apply: false,
        expectedOwners: 6,
        expectedReleases: 8,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
  });

  it("rejects conflicting exact and family ownership state", async () => {
    const ownerConflict = convexTest(schema, convexModules);
    await ownerConflict.mutation(seedOwnershipHistory);
    await ownerConflict.mutation((ctx) =>
      ctx.db.insert("contentOwners", {
        contentKey: MATERIAL_KEY,
        family: "material",
        locale: "en",
        managed: false,
        releaseId: "release-material",
        sequence: 1,
      })
    );
    await expect(
      ownerConflict.mutation(migrate, {
        apply: false,
        expectedOwners: 6,
        expectedReleases: 8,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });

    const familyConflict = convexTest(schema, convexModules);
    await familyConflict.mutation(seedOwnershipHistory);
    await familyConflict.mutation(async (ctx) => {
      const release = await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (query) =>
          query.eq("releaseId", "release-article")
        )
        .unique();
      expect(release).toBeDefined();
      if (!release) {
        return;
      }
      await ctx.db.patch("contentReleases", release._id, {
        baseFamilies: [],
        resultFamilies: [],
      });
    });
    await expect(
      familyConflict.mutation(migrate, {
        apply: false,
        expectedOwners: 6,
        expectedReleases: 8,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_CONFLICT" },
    });
  });
});
