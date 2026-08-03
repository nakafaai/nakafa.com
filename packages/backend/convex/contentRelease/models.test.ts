import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import {
  type PublicationScope,
  PublicationScopeSchema,
} from "@nakafa/aksara-contracts/release/snapshot";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { scheduleReadModels } from "@repo/backend/convex/contentRelease/models";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content-state";
import { insertReleaseItem } from "@repo/backend/test/content-sync";
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
    families: ["article", "material", "question"],
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

  it("claims unchanged models without scheduling empty scans", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) =>
      seedActiveRelease(
        ctx,
        PublicationScopeSchema.make({
          content: [],
          families: ["question"],
          snapshots: ["tryout"],
        })
      )
    );
    await t.mutation((ctx) =>
      runConvexProgram(scheduleReadModels(ctx, ACTIVE.releaseId))
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
    expect(claimed.jobs).toHaveLength(0);
    expect(claimed.release).toMatchObject({
      articleIndex: -1,
      materialIndex: -1,
      searchIndex: -1,
    });
    expect(claimed.state).toMatchObject({
      articleReleaseId: ACTIVE.releaseId,
      materialOwnerReleaseId: ACTIVE.releaseId,
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
  });

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
      runConvexProgram(scheduleReadModels(ctx, ACTIVE.releaseId))
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
      runConvexProgram(scheduleReadModels(ctx, ACTIVE.releaseId))
    );

    await expect(
      t.query(internal.contentRelease.models.status, {
        releaseId: ACTIVE.releaseId,
      })
    ).resolves.toEqual({
      phase: "syncing",
      releaseId: ACTIVE.releaseId,
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

  it("exposes a failed job and restarts it with a new generation", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedActiveRelease(ctx);
      await insertReleaseItem(ctx, ACTIVE, "test:unexpected", 0);
      await runConvexProgram(scheduleReadModels(ctx, ACTIVE.releaseId));
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);

    await expect(
      t.query(internal.contentRelease.models.status, {
        releaseId: ACTIVE.releaseId,
      })
    ).resolves.toEqual({
      phase: "failed",
      releaseId: ACTIVE.releaseId,
    });

    await t.mutation((ctx) =>
      runConvexProgram(scheduleReadModels(ctx, ACTIVE.releaseId))
    );
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
  });
});
