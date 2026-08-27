import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
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

describe("contentRelease/activate", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("atomically activates a candidate while retaining its inverse", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(seedVerifiedPair);

    const activation = await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    const pending = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(pending).toEqual([
      expect.objectContaining({
        name: expect.stringContaining("contentRelease/models:resume"),
        state: { kind: "pending" },
      }),
    ]);

    const repeatedPending = await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    const deduplicated = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(deduplicated).toHaveLength(1);

    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const completedJobs = await t.run((ctx) =>
      ctx.db.system.query("_scheduled_functions").collect()
    );
    expect(completedJobs).toHaveLength(3);
    expect(completedJobs.every(({ state }) => state.kind === "success")).toBe(
      true
    );

    const repeated = await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const state = await t.run((ctx) => ctx.db.query("contentState").unique());

    expect(activation).toEqual({
      kind: "activated",
      receipt: expectedReceipt(CANDIDATE),
    });
    expect(repeatedPending).toEqual({
      kind: "completed",
      receipt: activation.receipt,
    });
    expect(repeated).toEqual(repeatedPending);
    expect(state).toMatchObject({
      activeManifestHash: CANDIDATE.manifestHash,
      activeReleaseId: CANDIDATE.releaseId,
      activeSequence: CANDIDATE.sequence,
      articleReleaseId: CANDIDATE.releaseId,
      materialReleaseId: CANDIDATE.releaseId,
      recoveryReleaseId: RECOVERY.releaseId,
      searchReleaseId: CANDIDATE.releaseId,
    });
    expect(state?.candidateReleaseId).toBeUndefined();
  });

  it("returns completed evidence without rescheduling a failed lineage", async () => {
    const t = convexTest(schema, convexModules);
    await t.mutation(async (ctx) => {
      await seedVerifiedPair(ctx);
      await insertReleaseItem(ctx, CANDIDATE, "test:unexpected", 0);
    });

    const activation = await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    await t.finishAllScheduledFunctions(vi.runAllTimers);
    const failed = await t.run(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      release: await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (index) =>
          index.eq("releaseId", CANDIDATE.releaseId)
        )
        .unique(),
      state: await ctx.db.query("contentState").unique(),
    }));

    expect(failed.jobs).toEqual([
      expect.objectContaining({
        state: expect.objectContaining({ kind: "failed" }),
      }),
    ]);
    expect(failed.release).toMatchObject({
      status: "completed",
      syncGeneration: 1,
    });
    expect(failed.state?.activeReleaseId).toBe(CANDIDATE.releaseId);
    expect(failed.state?.articleReleaseId).toBeUndefined();
    expect(failed.state?.materialReleaseId).toBeUndefined();
    expect(failed.state?.searchReleaseId).toBeUndefined();

    const repeated = await t.mutation(activate, {
      manifestHash: CANDIDATE.manifestHash,
      releaseId: CANDIDATE.releaseId,
      rendererJson: testRendererJson(),
    });
    const restarted = await t.run(async (ctx) => ({
      jobs: await ctx.db.system.query("_scheduled_functions").collect(),
      release: await ctx.db
        .query("contentReleases")
        .withIndex("by_releaseId", (index) =>
          index.eq("releaseId", CANDIDATE.releaseId)
        )
        .unique(),
    }));

    expect(activation.kind).toBe("activated");
    expect(repeated).toEqual({
      kind: "completed",
      receipt: expectedReceipt(CANDIDATE),
    });
    expect(restarted.jobs).toHaveLength(1);
    expect(restarted.jobs.at(-1)?.state).toEqual(
      expect.objectContaining({ kind: "failed" })
    );
    expect(restarted.release?.syncGeneration).toBe(1);
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
        expect(
          t.mutation(activate, {
            manifestHash: CANDIDATE.manifestHash,
            releaseId: CANDIDATE.releaseId,
            rendererJson: testRendererJson(),
          })
        ).rejects.toMatchObject({ data: { code: "CONTENT_RELEASE_STATE" } })
      );
    })
  );

  it.effect("rejects renderer drift and a stale active base", () =>
    Effect.gen(function* () {
      const renderer = convexTest(schema, convexModules);
      yield* Effect.promise(() => renderer.mutation(seedVerifiedPair));
      yield* Effect.promise(() =>
        expect(
          renderer.mutation(activate, {
            manifestHash: CANDIDATE.manifestHash,
            releaseId: CANDIDATE.releaseId,
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
            active: { ...base, manifestHash: `sha256:${"a".repeat(64)}` },
            candidate,
            nextSequence: 4,
            recovery,
          });
        })
      );
      yield* Effect.promise(() =>
        expect(
          stale.mutation(activate, {
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
