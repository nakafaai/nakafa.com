import {
  DatabaseReader as ConfectDatabaseReader,
  RegisteredConvexFunction,
} from "@confect/server";
import {
  afterEach,
  assert,
  beforeEach,
  describe,
  expect,
  it,
} from "@effect/vitest";
import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import { PublicationScopeSchema } from "@nakafa/aksara-contracts/release/snapshot/scope";
import confectSchema from "@repo/backend/confect/_generated/schema";
import { abortProgram } from "@repo/backend/confect/contentRelease/abort";
import {
  readModelStatus,
  restartModelBuild,
} from "@repo/backend/confect/contentRelease/models";
import { MODEL_BUILD_PAGE_ROWS } from "@repo/backend/confect/contentRelease/models/spec";
import { convexModules } from "@repo/backend/confect/test.setup";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import {
  CANDIDATE,
  expectedReceipt,
  RECOVERY,
} from "@repo/backend/test/activation/fixture";
import { testRendererJson } from "@repo/backend/test/content/release";
import {
  insertTestState,
  insertZeroRelease,
} from "@repo/backend/test/content/state";
import { convexTest } from "convex-test";
import { DateTime, Effect } from "effect";

const activate = internal.contentRelease.activate.activate;
const prepare = internal.contentRelease.activate.prepare;
const activationArgs = {
  manifestHash: CANDIDATE.manifestHash,
  releaseId: CANDIDATE.releaseId,
  rendererJson: testRendererJson(),
};

/** Seeds one zero-row pair whose scope determines exact model impact. */
async function seedScopedPair(
  ctx: MutationCtx,
  families: readonly ContentFamily[]
) {
  const scope = PublicationScopeSchema.make({
    families,
    snapshots: [],
  });
  await insertZeroRelease(ctx, {
    ...CANDIDATE,
    ownership: {
      base: [],
      result: families,
    },
    role: "candidate",
    scope,
    status: "verified",
  });
  await insertZeroRelease(ctx, {
    ...RECOVERY,
    base: CANDIDATE,
    originReleaseId: CANDIDATE.releaseId,
    ownership: {
      base: families,
      result: [],
    },
    role: "recovery",
    scope,
    status: "verified",
  });
  await insertTestState(ctx, {
    candidate: CANDIDATE,
    nextSequence: 3,
    recovery: RECOVERY,
  });
}
describe("contentRelease/models", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());
  it.each(["slot", "base"] as const)(
    "rejects a corrupted model %s before writing the inactive article buffer",
    async (corruption) => {
      const t = convexTest(schema, convexModules);
      await t.mutation((ctx) => seedScopedPair(ctx, ["article"]));
      await t.mutation(prepare, activationArgs);
      const generation = await t.mutation(async (ctx) => {
        const build = await ctx.db.query("contentModelBuilds").unique();
        assert(build);
        if (corruption === "slot") {
          await ctx.db.patch(build._id, {
            slots: {
              ...build.slots,
              articleTargetSlot: "blue",
            },
          });
        } else {
          const state = await ctx.db.query("contentState").unique();
          assert(state);
          await ctx.db.patch(state._id, {
            activeSequence: 1,
          });
        }
        return build.generation;
      });
      await expect(
        t.mutation(internal.contentRelease.models.resume, {
          generation,
          releaseId: CANDIDATE.releaseId,
        })
      ).rejects.toMatchObject({
        data: {
          code: "CONTENT_RELEASE_STALE_BASE",
        },
      });
      const state = await t.query(async (ctx) => ({
        content: await ctx.db.query("contentState").unique(),
        articles: await ctx.db.query("articleCatalog").collect(),
      }));
      expect(state.articles).toEqual([]);
      expect(state.content).toMatchObject({
        articleSlot: "blue",
        candidateReleaseId: CANDIDATE.releaseId,
      });
      expect(state.content).not.toHaveProperty("activeReleaseId");
    }
  );
  it("rejects an unfinished model build that lost its scheduled continuation", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => seedScopedPair(ctx, ["article"]));
    await t.mutation(prepare, activationArgs);
    const before = await t.query((ctx) =>
      ctx.db.query("contentState").unique()
    );
    await t.mutation(async (ctx) => {
      const build = await ctx.db.query("contentModelBuilds").unique();
      assert(build);
      await ctx.db.patch(build._id, {
        syncJobId: undefined,
      });
    });
    await expect(
      t.query(internal.contentRelease.models.status, {
        releaseId: CANDIDATE.releaseId,
      })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_INTEGRITY",
      },
    });
    expect(
      await t.query((ctx) => ctx.db.query("contentState").unique())
    ).toEqual(before);
  });
  it("restarts a fenced build after Convex retires its terminal scheduler record", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => seedScopedPair(ctx, ["article"]));
    await t.mutation(prepare, activationArgs);
    const build = await t.query((ctx) =>
      ctx.db.query("contentModelBuilds").unique()
    );
    const jobId = build?.syncJobId;
    assert(jobId);
    await t.mutation((ctx) => ctx.scheduler.cancel(jobId));
    const now = DateTime.toEpochMillis(DateTime.nowUnsafe());
    vi.setSystemTime(now + 8 * 24 * 60 * 60 * 1000);
    // Convex retains terminal scheduler records for seven days. convex-test
    // keeps them forever, so represent pruning at the real system-reader seam.
    const failed = await t.query((ctx) => {
      vi.spyOn(ctx.db.system, "get").mockResolvedValueOnce(null);
      return Effect.runPromise(
        readModelStatus(CANDIDATE.releaseId).pipe(
          Effect.provide(ConfectDatabaseReader.layer(confectSchema, ctx.db))
        )
      );
    });
    assert(failed.phase === "failed");
    const restarted = await t.mutation((ctx) => {
      vi.spyOn(ctx.db.system, "get").mockResolvedValueOnce(null);
      return Effect.runPromise(
        restartModelBuild({
          expectedGeneration: failed.syncGeneration,
          expectedJobId: failed.syncJobId,
          releaseId: CANDIDATE.releaseId,
        }).pipe(
          Effect.provide(
            RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
          )
        )
      );
    });
    expect(restarted).toMatchObject({
      status: "restarted",
      syncGeneration: 2,
    });
    await expect(
      t.query(internal.contentRelease.models.status, {
        releaseId: CANDIDATE.releaseId,
      })
    ).resolves.toMatchObject({
      phase: "building",
      syncGeneration: 2,
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(
      t.query(internal.contentRelease.models.status, {
        releaseId: CANDIDATE.releaseId,
      })
    ).resolves.toMatchObject({
      phase: "ready",
    });
  });
  it.each(["page", "question"] as const)(
    "claims unchanged model buffers immediately for %s releases",
    async (family) => {
      const t = convexTest(schema, convexModules);
      await t.mutation((ctx) => seedScopedPair(ctx, [family]));
      await expect(t.mutation(prepare, activationArgs)).resolves.toEqual({
        kind: "prepared",
      });
      const prepared = await t.run(async (ctx) => ({
        build: await ctx.db.query("contentModelBuilds").unique(),
        jobs: await ctx.db.system.query("_scheduled_functions").collect(),
        state: await ctx.db.query("contentState").unique(),
      }));
      expect(prepared.jobs).toEqual([]);
      expect(prepared.build).toMatchObject({
        phase: "ready",
        slots: {
          articleBaseSlot: "blue",
          articleTargetSlot: "blue",
          materialBaseSlot: "blue",
          materialTargetSlot: "blue",
          searchBaseSlot: "blue",
          searchTargetSlot: "blue",
        },
      });
      expect(prepared.state?.activeReleaseId).toBeUndefined();
      await expect(t.mutation(activate, activationArgs)).resolves.toEqual({
        kind: "activated",
        receipt: expectedReceipt(CANDIDATE),
      });
      const active = await t.run((ctx) =>
        ctx.db.query("contentState").unique()
      );
      expect(active).toMatchObject({
        activeReleaseId: CANDIDATE.releaseId,
        articleReleaseId: CANDIDATE.releaseId,
        articleSlot: "blue",
        materialReleaseId: CANDIDATE.releaseId,
        materialSlot: "blue",
        searchReleaseId: CANDIDATE.releaseId,
        searchSlot: "blue",
      });
      await expect(
        t.query(internal.contentRelease.models.status, {
          releaseId: CANDIDATE.releaseId,
        })
      ).resolves.toEqual({
        phase: "completed",
        releaseId: CANDIDATE.releaseId,
      });
    }
  );
  it("clears multiple pages of abandoned search rows before switching article-owned buffers", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedScopedPair(ctx, ["article"]);
      for (let index = 0; index <= MODEL_BUILD_PAGE_ROWS; index += 1) {
        await ctx.db.insert("contentIndex", {
          appLocale: "en",
          contentKey: `article:abandoned-${index}`,
          family: "article",
          projectionHash: `sha256:${"1".repeat(64)}`,
          publicPath: `articles/abandoned-${index}`,
          releaseId: "abandoned",
          sequence: 1,
          slot: "green",
          text: `Abandoned article ${index}`,
        });
      }
    });
    await t.mutation(prepare, activationArgs);
    const building = await t.run(async (ctx) => ({
      build: await ctx.db.query("contentModelBuilds").unique(),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(building.build).toMatchObject({
      phase: "articleCatalog",
      slots: {
        articleBaseSlot: "blue",
        articleTargetSlot: "green",
        materialBaseSlot: "blue",
        materialTargetSlot: "blue",
        searchBaseSlot: "blue",
        searchTargetSlot: "green",
      },
    });
    expect(building.state).toMatchObject({
      articleSlot: "blue",
      materialSlot: "blue",
      searchSlot: "blue",
    });
    expect(building.state?.activeReleaseId).toBeUndefined();
    assert(building.build?.syncJobId);
    await expect(t.mutation(prepare, activationArgs)).resolves.toEqual({
      kind: "prepared",
    });
    await expect(
      t.mutation(internal.contentRelease.models.restart, {
        releaseId: CANDIDATE.releaseId,
        expectedGeneration: building.build.generation,
        expectedJobId: building.build.syncJobId,
      })
    ).resolves.toEqual({
      status: "stale",
    });
    expect(
      await t.query((ctx) => ctx.db.query("contentModelBuilds").unique())
    ).toEqual(building.build);
    await expect(
      t.mutation(internal.contentRelease.models.resume, {
        releaseId: CANDIDATE.releaseId,
        generation: building.build.generation + 1,
      })
    ).resolves.toBeNull();
    expect(
      await t.query((ctx) => ctx.db.query("contentModelBuilds").unique())
    ).toEqual(building.build);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(
      t.query((ctx) => ctx.db.query("contentIndex").collect())
    ).resolves.toEqual([]);
    await expect(
      t.query(internal.contentRelease.models.status, {
        releaseId: CANDIDATE.releaseId,
      })
    ).resolves.toEqual({
      phase: "ready",
      releaseId: CANDIDATE.releaseId,
    });
    expect(
      await t.run((ctx) => ctx.db.query("contentState").unique())
    ).toMatchObject({
      articleSlot: "blue",
      materialSlot: "blue",
      searchSlot: "blue",
    });
    await t.mutation(activate, activationArgs);
    expect(
      await t.run((ctx) => ctx.db.query("contentState").unique())
    ).toMatchObject({
      activeReleaseId: CANDIDATE.releaseId,
      articleSlot: "green",
      materialSlot: "blue",
      searchSlot: "green",
    });
  });
  it("deletes an abandoned build without selecting its target buffers", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => seedScopedPair(ctx, ["article"]));
    await t.mutation(prepare, activationArgs);
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          abortProgram(RECOVERY.releaseId).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).resolves.toMatchObject({
      complete: true,
    });
    await expect(
      t.mutation((ctx) =>
        Effect.runPromise(
          abortProgram(CANDIDATE.releaseId).pipe(
            Effect.provide(
              RegisteredConvexFunction.mutationLayer(confectSchema, ctx)
            )
          )
        )
      )
    ).resolves.toMatchObject({
      complete: true,
    });
    const abandoned = await t.run(async (ctx) => ({
      build: await ctx.db.query("contentModelBuilds").unique(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(abandoned.build).toBeNull();
    expect(abandoned.jobs).toHaveLength(1);
    expect(abandoned.state).toMatchObject({
      articleSlot: "blue",
      materialSlot: "blue",
      searchSlot: "blue",
    });
    expect(abandoned.state?.activeReleaseId).toBeUndefined();
    expect(abandoned.state?.candidateReleaseId).toBeUndefined();
    expect(abandoned.state?.recoveryReleaseId).toBeUndefined();
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    expect(
      await t.run((ctx) => ctx.db.query("contentState").unique())
    ).toMatchObject({
      articleSlot: "blue",
      materialSlot: "blue",
      searchSlot: "blue",
    });
  });
  it.each(["base", "slots"])(
    "rejects conflicting %s during model preparation",
    async (drift) => {
      const t = convexTest(schema, convexModules);
      await t.mutation((ctx) => seedScopedPair(ctx, ["article"]));
      if (drift === "slots") {
        await t.mutation(prepare, activationArgs);
      }
      await t.mutation(async (ctx) => {
        if (drift === "base") {
          const state = await ctx.db.query("contentState").unique();
          assert(state);
          await ctx.db.patch(state._id, {
            activeSequence: 1,
          });
        } else {
          const build = await ctx.db.query("contentModelBuilds").unique();
          assert(build);
          await ctx.db.patch(build._id, {
            slots: {
              ...build.slots,
              articleTargetSlot: "blue",
            },
          });
        }
      });
      await expect(t.mutation(prepare, activationArgs)).rejects.toMatchObject({
        data: {
          code:
            drift === "base"
              ? "CONTENT_RELEASE_STALE_BASE"
              : "CONTENT_RELEASE_CONFLICT",
        },
      });
      await expect(
        t.query((ctx) => ctx.db.query("articleCatalog").collect())
      ).resolves.toEqual([]);
    }
  );
  it("refuses foreign status reads and resumes after candidate verification is lost", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => seedScopedPair(ctx, ["article"]));
    await t.mutation(prepare, activationArgs);
    await expect(
      t.query(internal.contentRelease.models.status, {
        releaseId: RECOVERY.releaseId,
      })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
      },
    });
    const generation = await t.mutation(async (ctx) => {
      const build = await ctx.db.query("contentModelBuilds").unique();
      const candidate = await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (q) =>
          q.eq("releaseId", CANDIDATE.releaseId)
        )
        .unique();
      assert(build && candidate);
      await ctx.db.patch(candidate._id, {
        status: "verifying",
      });
      return build.generation;
    });
    await expect(
      t.mutation(internal.contentRelease.models.resume, {
        releaseId: CANDIDATE.releaseId,
        generation,
      })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
      },
    });
    await expect(
      t.query((ctx) => ctx.db.query("articleCatalog").collect())
    ).resolves.toEqual([]);
  });
});
