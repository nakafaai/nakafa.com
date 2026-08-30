import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
import type { ContentFamily } from "@nakafa/aksara-contracts/content";
import { PublicationScopeSchema } from "@nakafa/aksara-contracts/release/snapshot/scope";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { abortProgram } from "@repo/backend/convex/contentRelease/abort";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
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
  const scope = PublicationScopeSchema.make({ families, snapshots: [] });
  await insertZeroRelease(ctx, {
    ...CANDIDATE,
    ownership: { base: [], result: families },
    role: "candidate",
    scope,
    status: "verified",
  });
  await insertZeroRelease(ctx, {
    ...RECOVERY,
    base: CANDIDATE,
    originReleaseId: CANDIDATE.releaseId,
    ownership: { base: families, result: [] },
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

  it("switches only article-owned buffers after a complete invisible build", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation((ctx) => seedScopedPair(ctx, ["article"]));
    await t.mutation(prepare, activationArgs);

    const building = await t.run(async (ctx) => ({
      build: await ctx.db.query("contentModelBuilds").unique(),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(building.build).toMatchObject({
      phase: "articleClearCatalog",
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

    await t.finishAllScheduledFunctions(vi.runAllTimers);
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
        runConvexProgram(abortProgram(ctx, RECOVERY.releaseId))
      )
    ).resolves.toMatchObject({ complete: true });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(abortProgram(ctx, CANDIDATE.releaseId))
      )
    ).resolves.toMatchObject({ complete: true });

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
});
