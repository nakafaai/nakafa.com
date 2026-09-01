import { afterEach, beforeEach, describe, expect, it } from "@effect/vitest";
import { ContentFamilySchema } from "@nakafa/aksara-contracts/content";
import { internal } from "@repo/backend/convex/_generated/api";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  CANDIDATE,
  expectedReceipt,
  RECOVERY,
  seedVerifiedPair,
} from "@repo/backend/test/activation/fixture";
import { insertReleaseItem } from "@repo/backend/test/content/model";
import { testRendererJson } from "@repo/backend/test/content/release";
import {
  insertTestState,
  insertZeroRelease,
  type TestIdentity,
} from "@repo/backend/test/content/state";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const activate = internal.contentRelease.activate.activate;
const prepare = internal.contentRelease.activate.prepare;

const activationArgs = {
  manifestHash: CANDIDATE.manifestHash,
  releaseId: CANDIDATE.releaseId,
  rendererJson: testRendererJson(),
};

describe("contentRelease/activate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("keeps the old pointers visible until one atomic candidate activation", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedVerifiedPair);

    await expect(t.mutation(activate, activationArgs)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(t.mutation(prepare, activationArgs)).resolves.toEqual({
      kind: "prepared",
    });
    await expect(t.mutation(prepare, activationArgs)).resolves.toEqual({
      kind: "prepared",
    });

    const building = await t.run(async (ctx) => ({
      build: await ctx.db.query("contentModelBuilds").unique(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(building.jobs).toEqual([
      expect.objectContaining({ state: { kind: "pending" } }),
    ]);
    expect(building.build).toMatchObject({
      generation: 1,
      releaseId: CANDIDATE.releaseId,
    });
    expect(building.state).toMatchObject({
      articleSlot: "blue",
      candidateReleaseId: CANDIDATE.releaseId,
      materialSlot: "blue",
      recoveryReleaseId: RECOVERY.releaseId,
      searchSlot: "blue",
    });
    expect(building.state?.activeReleaseId).toBeUndefined();

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const ready = await t.run(async (ctx) => ({
      build: await ctx.db.query("contentModelBuilds").unique(),
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(ready.jobs.length).toBeGreaterThan(1);
    expect(ready.jobs.every(({ state }) => state.kind === "success")).toBe(
      true
    );
    expect(ready.build).toMatchObject({
      phase: "ready",
      releaseId: CANDIDATE.releaseId,
      slots: {
        articleBaseSlot: "blue",
        articleTargetSlot: "green",
        materialBaseSlot: "blue",
        materialTargetSlot: "green",
        searchBaseSlot: "blue",
        searchTargetSlot: "green",
      },
    });
    expect(ready.build?.syncJobId).toBeUndefined();
    expect(ready.state?.activeReleaseId).toBeUndefined();
    expect(ready.state).toMatchObject({
      articleSlot: "blue",
      materialSlot: "blue",
      searchSlot: "blue",
    });

    const activation = await t.mutation(activate, activationArgs);
    const repeated = await t.mutation(activate, activationArgs);
    const completed = await t.run(async (ctx) => ({
      build: await ctx.db.query("contentModelBuilds").unique(),
      state: await ctx.db.query("contentState").unique(),
    }));

    expect(activation).toEqual({
      kind: "activated",
      receipt: expectedReceipt(CANDIDATE),
    });
    expect(repeated).toEqual({
      kind: "completed",
      receipt: expectedReceipt(CANDIDATE),
    });
    expect(completed.build).toBeNull();
    expect(completed.state).toMatchObject({
      activeManifestHash: CANDIDATE.manifestHash,
      activeReleaseId: CANDIDATE.releaseId,
      activeSequence: CANDIDATE.sequence,
      articleReleaseId: CANDIDATE.releaseId,
      articleSlot: "green",
      materialReleaseId: CANDIDATE.releaseId,
      materialSlot: "green",
      recoveryReleaseId: RECOVERY.releaseId,
      searchReleaseId: CANDIDATE.releaseId,
      searchSlot: "green",
    });
    expect(completed.state?.candidateReleaseId).toBeUndefined();

    await t.mutation(async (ctx) => {
      const state = await ctx.db.query("contentState").unique();
      expect(state).not.toBeNull();
      if (state) {
        await ctx.db.patch("contentState", state._id, {
          articleReleaseId: "release-drifted-model",
        });
      }
    });
    await expect(t.mutation(activate, activationArgs)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
  });

  it("keeps a failed inactive build invisible and generation-fenced", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedVerifiedPair(ctx);
      await insertReleaseItem(ctx, CANDIDATE, "test:unexpected", 0);
    });

    await t.mutation(prepare, activationArgs);
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const failed = await t.query(internal.contentRelease.models.status, {
      releaseId: CANDIDATE.releaseId,
    });
    if (failed.phase !== "failed") {
      expect.fail("Expected one failed inactive-buffer lineage.");
    }
    const retained = await t.run(async (ctx) => ({
      build: await ctx.db.query("contentModelBuilds").unique(),
      release: await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (index) =>
          index.eq("releaseId", CANDIDATE.releaseId)
        )
        .unique(),
      state: await ctx.db.query("contentState").unique(),
    }));
    expect(retained.build).toMatchObject({
      generation: 1,
      releaseId: CANDIDATE.releaseId,
    });
    expect(retained.release?.status).toBe("verified");
    expect(retained.state).toMatchObject({
      articleSlot: "blue",
      materialSlot: "blue",
      searchSlot: "blue",
    });
    expect(retained.state?.activeReleaseId).toBeUndefined();
    await expect(t.mutation(activate, activationArgs)).rejects.toMatchObject({
      data: { code: "CONTENT_RELEASE_STATE" },
    });
    await expect(t.mutation(prepare, activationArgs)).resolves.toEqual({
      kind: "prepared",
    });

    await expect(
      t.mutation(internal.contentRelease.models.restart, {
        expectedGeneration: failed.syncGeneration,
        expectedJobId: failed.syncJobId,
        releaseId: CANDIDATE.releaseId,
      })
    ).resolves.toMatchObject({ status: "restarted", syncGeneration: 2 });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    await expect(
      t.query(internal.contentRelease.models.status, {
        releaseId: CANDIDATE.releaseId,
      })
    ).resolves.toMatchObject({ phase: "failed", syncGeneration: 2 });
    expect(
      await t.run((ctx) => ctx.db.query("contentState").unique())
    ).toMatchObject({
      articleSlot: "blue",
      materialSlot: "blue",
      searchSlot: "blue",
    });
  });

  it.effect("requires the exact verified retained inverse", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() => t.mutation(seedVerifiedPair));
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const state = await ctx.db.query("contentState").unique();
          expect(state).not.toBeNull();
          if (!state) {
            return;
          }
          await ctx.db.patch("contentState", state._id, {
            recoveryManifestHash: undefined,
            recoveryReleaseId: undefined,
            recoverySequence: undefined,
          });
        })
      );

      yield* Effect.promise(() =>
        expect(t.mutation(prepare, activationArgs)).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_STATE" },
        })
      );
    })
  );

  it.effect("rejects renderer drift and a stale active base", () =>
    Effect.gen(function* () {
      const renderer = convexTest(schema, convexModules);
      yield* Effect.promise(() => renderer.mutation(seedVerifiedPair));
      yield* Effect.promise(() =>
        expect(
          renderer.mutation(prepare, {
            ...activationArgs,
            rendererJson: testRendererJson(`sha256:${"8".repeat(64)}`),
          })
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_UNSUPPORTED" },
        })
      );

      const stale = convexTest(schema, convexModules);
      const base = {
        manifestHash: `sha256:${"9".repeat(64)}`,
        releaseId: "release-base",
        sequence: 1,
      } satisfies TestIdentity;
      const candidate = { ...CANDIDATE, sequence: 2 };
      const recovery = { ...RECOVERY, sequence: 3 };
      yield* Effect.promise(() =>
        stale.mutation(async (ctx) => {
          await insertZeroRelease(ctx, {
            ...candidate,
            base,
            ownership: {
              base: ContentFamilySchema.literals,
              result: ContentFamilySchema.literals,
            },
            role: "candidate",
            status: "verified",
          });
          await insertZeroRelease(ctx, {
            ...recovery,
            base: candidate,
            originReleaseId: candidate.releaseId,
            ownership: {
              base: ContentFamilySchema.literals,
              result: ContentFamilySchema.literals,
            },
            role: "recovery",
            status: "verified",
          });
          await insertTestState(ctx, {
            active: {
              ...base,
              manifestHash: `sha256:${"a".repeat(64)}`,
            },
            candidate,
            nextSequence: 4,
            recovery,
          });
        })
      );
      yield* Effect.promise(() =>
        expect(
          stale.mutation(prepare, {
            manifestHash: candidate.manifestHash,
            releaseId: candidate.releaseId,
            rendererJson: testRendererJson(),
          })
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_STALE_BASE" },
        })
      );
    })
  );
});
