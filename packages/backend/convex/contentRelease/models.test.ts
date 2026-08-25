import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import {
  type PublicationScope,
  PublicationScopeSchema,
} from "@nakafa/aksara-contracts/release/snapshot/spec";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { startReadModels } from "@repo/backend/convex/contentRelease/models";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { insertReleaseItem } from "@repo/backend/test/content-read-model";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const ACTIVE = {
  manifestHash: `sha256:${"b".repeat(64)}`,
  releaseId: "release-models-active",
  sequence: 1,
} satisfies TestIdentity;

/** Seeds one completed active release before any read model owns it. */
async function seedActiveRelease(
  ctx: MutationCtx,
  scope: PublicationScope = PublicationScopeSchema.make({
    content: [],
    families: ContentFamilySchema.literals,
    snapshots: [],
  })
) {
  await insertZeroRelease(ctx, {
    ...ACTIVE,
    ownership: {
      base: [],
      result: ContentFamilySchema.literals,
    },
    role: "candidate",
    scope,
    status: "completed",
  });
  await insertTestState(ctx, {
    active: ACTIVE,
    nextSequence: 2,
  });
}

describe("contentRelease/models", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it.each(["page", "question"] as const)(
    "claims unchanged models for %s content under one activation lineage",
    async (family) => {
      const t = convexTest(schema, convexModules);
      await t.mutation((ctx) =>
        seedActiveRelease(
          ctx,
          PublicationScopeSchema.make({
            content: [],
            families: [family],
            snapshots: ["tryout"],
          })
        )
      );
      await t.mutation((ctx) =>
        runConvexProgram(startReadModels(ctx, ACTIVE.releaseId))
      );

      const claimed = await t.run(async (ctx) => ({
        jobs: await ctx.db.system.query("_scheduled_functions").collect(),
        release: await ctx.db
          .query("contentReleases")
          .withIndex("by_releaseId", (index) =>
            index.eq("releaseId", ACTIVE.releaseId)
          )
          .unique(),
        state: await ctx.db.query("contentState").unique(),
      }));
      expect(claimed.jobs).toEqual([
        expect.objectContaining({ state: { kind: "pending" } }),
      ]);
      expect(claimed.release).toMatchObject({
        articleIndex: -1,
        materialIndex: -1,
        searchIndex: -1,
        syncGeneration: 1,
        syncJobId: expect.any(String),
      });
      expect(claimed.state).toMatchObject({
        articleReleaseId: ACTIVE.releaseId,
        materialReleaseId: ACTIVE.releaseId,
        searchReleaseId: ACTIVE.releaseId,
      });
      await expect(
        t.query(internal.contentRelease.models.status, {
          releaseId: ACTIVE.releaseId,
        })
      ).resolves.toEqual({
        phase: "completed",
        releaseId: ACTIVE.releaseId,
      });
      const [initialJob] = claimed.jobs;
      if (!initialJob) {
        expect.fail("Expected one generation-1 read-model job.");
      }
      await expect(
        t.mutation(internal.contentRelease.models.restart, {
          expectedGeneration: 1,
          expectedJobId: initialJob._id,
          releaseId: ACTIVE.releaseId,
        })
      ).resolves.toEqual({ status: "stale" });
    }
  );

  it.each([
    PublicationScopeSchema.make({
      content: [],
      families: ["article"],
      snapshots: [],
    }),
    PublicationScopeSchema.make({
      content: [],
      families: ["material"],
      snapshots: [],
    }),
  ])("claims models outside one single-family release", async (scope) => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => seedActiveRelease(ctx, scope));
    await t.mutation((ctx) =>
      runConvexProgram(startReadModels(ctx, ACTIVE.releaseId))
    );
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await expect(
      t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())
    ).resolves.toHaveLength(2);
    await expect(
      t.query(internal.contentRelease.models.status, {
        releaseId: ACTIVE.releaseId,
      })
    ).resolves.toEqual({
      phase: "completed",
      releaseId: ACTIVE.releaseId,
    });
  });

  it("serializes every model under one generation-fenced lineage", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => seedActiveRelease(ctx));
    await t.mutation((ctx) =>
      runConvexProgram(startReadModels(ctx, ACTIVE.releaseId))
    );

    const [initialJob] = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    if (!initialJob) {
      expect.fail("Expected one generation-1 read-model job.");
    }

    await expect(
      t.query(internal.contentRelease.models.status, {
        releaseId: ACTIVE.releaseId,
      })
    ).resolves.toEqual({
      phase: "syncing",
      releaseId: ACTIVE.releaseId,
      syncGeneration: 1,
      syncJobId: initialJob._id,
    });

    await t.mutation(internal.contentRelease.models.resume, {
      generation: 0,
      releaseId: ACTIVE.releaseId,
    });
    await expect(
      t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())
    ).resolves.toHaveLength(1);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(
      t.query(internal.contentRelease.models.status, {
        releaseId: ACTIVE.releaseId,
      })
    ).resolves.toEqual({
      phase: "completed",
      releaseId: ACTIVE.releaseId,
    });
    const completedJobs = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(completedJobs).toHaveLength(3);
    expect(completedJobs.every(({ state }) => state.kind === "success")).toBe(
      true
    );

    await t.mutation(internal.contentRelease.models.resume, {
      generation: 1,
      releaseId: ACTIVE.releaseId,
    });
    await expect(
      t.run((ctx) => ctx.db.system.query("_scheduled_functions").collect())
    ).resolves.toHaveLength(3);
  });

  it("does not restart a pending lineage", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedActiveRelease(ctx);
      await insertReleaseItem(ctx, ACTIVE, "test:unexpected", 0);
      await runConvexProgram(startReadModels(ctx, ACTIVE.releaseId));
    });

    const pending = await t.query(internal.contentRelease.models.status, {
      releaseId: ACTIVE.releaseId,
    });
    if (pending.phase !== "syncing") {
      expect.fail("Expected one pending read-model lineage.");
    }

    await expect(
      t.mutation(internal.contentRelease.models.restart, {
        expectedGeneration: pending.syncGeneration,
        expectedJobId: pending.syncJobId,
        releaseId: ACTIVE.releaseId,
      })
    ).resolves.toEqual({ status: "stale" });

    const unchanged = await t.run(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      release: await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (index) =>
          index.eq("releaseId", ACTIVE.releaseId)
        )
        .unique(),
    }));
    expect(unchanged.jobs).toEqual([
      expect.objectContaining({
        _id: pending.syncJobId,
        state: { kind: "pending" },
      }),
    ]);
    expect(unchanged.release).toMatchObject({
      syncGeneration: pending.syncGeneration,
      syncJobId: pending.syncJobId,
    });
  });

  it("fences concurrent restart attempts by generation and job identity", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedActiveRelease(ctx);
      await insertReleaseItem(ctx, ACTIVE, "test:unexpected", 0);
      await runConvexProgram(startReadModels(ctx, ACTIVE.releaseId));
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    const failed = await t.query(internal.contentRelease.models.status, {
      releaseId: ACTIVE.releaseId,
    });
    if (failed.phase !== "failed") {
      expect.fail("Expected one terminal failed lineage.");
    }
    expect(failed).toMatchObject({
      releaseId: ACTIVE.releaseId,
      syncGeneration: 1,
    });

    const restartArgs = {
      expectedGeneration: failed.syncGeneration,
      expectedJobId: failed.syncJobId,
      releaseId: ACTIVE.releaseId,
    };
    const attempts = await Promise.all([
      t.mutation(internal.contentRelease.models.restart, restartArgs),
      t.mutation(internal.contentRelease.models.restart, restartArgs),
    ]);
    const restarted = await t.run(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      release: await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (index) =>
          index.eq("releaseId", ACTIVE.releaseId)
        )
        .unique(),
    }));
    expect(restarted.jobs).toHaveLength(2);
    expect(restarted.jobs.at(-1)?.state).toEqual({ kind: "pending" });
    expect(restarted.release?.syncGeneration).toBe(2);
    expect(attempts).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ status: "restarted", syncGeneration: 2 }),
        { status: "stale" },
      ])
    );
    await expect(
      t.mutation(internal.contentRelease.models.restart, restartArgs)
    ).resolves.toEqual({ status: "stale" });
  });

  it("fails closed when an incomplete release has no lineage identity", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => seedActiveRelease(ctx));

    await expect(
      t.query(internal.contentRelease.models.status, {
        releaseId: ACTIVE.releaseId,
      })
    ).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_INTEGRITY" },
    });
  });
});
