import { afterEach, assert, describe, expect, it } from "@effect/vitest";
import type { Doc } from "@repo/backend/convex/_generated/dataModel";
import type {
  MutationCtx,
  QueryCtx,
} from "@repo/backend/convex/_generated/server";
import { cleanupAttemptRuntime } from "@repo/backend/convex/auth/cleanup/tryouts";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { retireAttempt } from "@repo/backend/convex/retirement/impl";
import type { Plan } from "@repo/backend/convex/retirement/spec";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { writeTryoutSetProgress } from "@repo/backend/convex/tryouts/progress/write";
import { makeActivationRuntime } from "@repo/backend/test/activation/fixture";
import { testTextHash } from "@repo/backend/test/content/release";
import { insertZeroRelease } from "@repo/backend/test/content/state";
import { storeRuntimeFixture } from "@repo/backend/test/runtime/bundle";
import { seedTryoutContentAccessState } from "@repo/backend/test/tryout/runtime";
import { makeFunctionReference } from "convex/server";
import { Effect } from "effect";

// Convex Test has a different ID codec from the native deployment. Bind only the
// fixed reviewed ID to its generated fixture; all document guards remain real.
const reviewed = vi.hoisted(() => ({ id: "wn7d0a14z2wscs0kpmgx7k7psh8e0x0t" }));
vi.mock("@repo/backend/convex/retirement/spec", async (original) => ({
  ...(await original<typeof import("@repo/backend/convex/retirement/spec")>()),
  get REVIEWED_ATTEMPT_ID() {
    return reviewed.id;
  },
}));
const endpoint = makeFunctionReference<"mutation", { plan: Plan }>(
  "retirement/internal:emptyAttempt"
);

vi.mock("@repo/backend/convex/auth/cleanup/tryouts", { spy: true });

/** Builds two real signed runtimes with the reviewed bounded attempt shape. */
const fixture = Effect.fn("test.retirement.fixture")(function* () {
  const t = createConvexTestWithBetterAuth();
  const runtime = yield* Effect.promise(() =>
    t.mutation((ctx) =>
      seedTryoutContentAccessState(ctx, {
        attemptStatus: "in-progress",
        sectionStatus: "in-progress",
        suffix: "retirement",
      })
    )
  );
  const replacement = yield* makeActivationRuntime();
  yield* storeRuntimeFixture(t, replacement);
  const plan = yield* Effect.promise(() =>
    t.mutation(async (ctx) => {
      const original = await ctx.db.get("tryoutAttempts", runtime.attemptId);
      const frozen = await ctx.db.get(
        "tryoutAttemptPlacements",
        runtime.placementId
      );
      const state = await ctx.db.query("contentState").unique();
      assert.ok(original && frozen && state);
      const scaleId = await ctx.db.insert("irtScaleVersions", {
        model: "2pl",
        publishedAt: 1,
        questionCount: 160,
        setIdentity: original.setIdentity,
        status: "provisional",
        tryoutSnapshotId: original.tryoutSnapshotId,
      });
      await ctx.db.patch("tryoutAttempts", original._id, {
        accessSourceKind: "subscription",
        attemptNumber: 5,
        completedSectionKeys: ["general-reasoning"],
        scaleVersionId: scaleId,
        totalQuestions: 160,
      });
      await ctx.db.patch("tryoutSectionAttempts", runtime.sectionAttemptId, {
        completedAt: original.lastActivityAt,
        endReason: "time-expired",
        sectionKey: "general-reasoning",
        score: {
          publishedScore: 100,
          rawScore: 0,
          scoreStatus: "provisional",
          scoringStrategy: "irt",
          theta: -4,
          thetaSE: 1.373_759_630_503_494_7,
        },
        status: "expired",
      });
      const attempt = await ctx.db.get("tryoutAttempts", original._id);
      assert.ok(attempt);
      const {
        _id: originalId,
        _creationTime: originalCreatedAt,
        ...attemptFields
      } = attempt;
      const previousId = await ctx.db.insert("tryoutAttempts", {
        ...attemptFields,
        attemptNumber: 4,
        completedAt: original.startedAt - 1,
        endReason: "submitted",
        startedAt: original.startedAt - 100,
        lastActivityAt: original.startedAt - 1,
        status: "completed",
      });
      const previousScoreId = await ctx.db.insert("tryoutScores", {
        finalizedAt: original.startedAt - 1,
        publishedScore: 100,
        rawScore: 100,
        scaleVersionId: scaleId,
        scoreStatus: "provisional",
        scoringStrategy: "irt",
        setIdentity: original.setIdentity,
        totalCorrect: 10,
        totalQuestions: 160,
        tryoutAttemptId: previousId,
        tryoutSnapshotId: original.tryoutSnapshotId,
        userId: original.userId,
      });
      const sharedAttempts: Doc<"tryoutAttempts">[] = [];
      for (let index = 0; index < 3; index += 1) {
        const sharedId = await ctx.db.insert("tryoutAttempts", {
          ...attemptFields,
          examKey: "tka",
          setIdentity: `tka-shared-${index}`,
          startedAt: original.startedAt - 200,
          completedAt: original.startedAt - 100,
          endReason: "submitted",
          status: "completed",
        });
        const shared = await ctx.db.get("tryoutAttempts", sharedId);
        assert.ok(shared);
        sharedAttempts.push(shared);
      }
      const {
        _id: frozenId,
        _creationTime: frozenCreatedAt,
        ...placementFields
      } = frozen;
      for (let order = 2; order <= 160; order += 1) {
        await ctx.db.insert("tryoutAttemptPlacements", {
          ...placementFields,
          questionOrder: order,
        });
      }
      const progressId = await runConvexProgram(
        writeTryoutSetProgress(ctx, {
          attempt,
          publishedScore: null,
          status: "in-progress",
          updatedAt: attempt.lastActivityAt,
        })
      );
      const active = {
        releaseId: "retirement-replacement",
        manifestHash: testTextHash("retirement-replacement"),
        sequence: 2,
      };
      await insertZeroRelease(ctx, {
        ...active,
        ownership: { base: [], result: [] },
        role: "candidate",
        status: "completed",
        snapshots: replacement.release.manifest.snapshots,
      });
      await ctx.db.patch("contentState", state._id, {
        activeReleaseId: active.releaseId,
        activeManifestHash: active.manifestHash,
        activeSequence: active.sequence,
      });
      const section = await ctx.db.get(
        "tryoutSectionAttempts",
        runtime.sectionAttemptId
      );
      const progress = await ctx.db.get("tryoutSetProgress", progressId);
      const previous = await ctx.db.get("tryoutAttempts", previousId);
      const previousScore = await ctx.db.get("tryoutScores", previousScoreId);
      const scale = await ctx.db.get("irtScaleVersions", scaleId);
      assert.ok(section && progress && previous && previousScore && scale);
      return {
        active,
        newSnapshotId: replacement.snapshot.snapshotId,
        attempt,
        section,
        progress,
        previous,
        previousScore,
        scale,
        sharedAttempts,
      } satisfies Plan;
    })
  );
  return { t, plan };
});

/** Retains the complete domain state needed to prove transactional refusal. */
async function stored(ctx: Pick<QueryCtx, "db">) {
  return {
    attempts: await ctx.db.query("tryoutAttempts").collect(),
    sections: await ctx.db.query("tryoutSectionAttempts").collect(),
    placements: await ctx.db.query("tryoutAttemptPlacements").collect(),
    responses: await ctx.db.query("tryoutResponses").collect(),
    scores: await ctx.db.query("tryoutScores").collect(),
    progress: await ctx.db.query("tryoutSetProgress").collect(),
    scales: await ctx.db.query("irtScaleVersions").collect(),
    bundles: await ctx.db.query("tryoutRuntimeBundles").collect(),
  };
}

afterEach(() => {
  reviewed.id = "wn7d0a14z2wscs0kpmgx7k7psh8e0x0t";
  vi.mocked(cleanupAttemptRuntime).mockRestore();
});

describe("retirement empty attempt", () => {
  it.effect(
    "removes only the empty attempt and restores its completed predecessor",
    () =>
      fixture().pipe(
        Effect.flatMap(({ t, plan }) =>
          Effect.promise(async () => {
            const before = await t.query(stored);
            reviewed.id = plan.attempt._id;
            const result = await t.mutation(endpoint, { plan });
            const after = await t.query(stored);
            expect(result).toMatchObject({
              retiredAttemptId: plan.attempt._id,
              restoredAttemptId: plan.previous._id,
              removedSections: 1,
              removedPlacements: 160,
            });
            expect(after.attempts).toEqual(
              before.attempts.filter((row) => row._id !== plan.attempt._id)
            );
            expect(after.sections).toEqual([]);
            expect(after.placements).toEqual([]);
            expect(after.responses).toEqual(before.responses);
            expect(after.scores).toEqual(before.scores);
            expect(after.scales).toEqual(before.scales);
            expect(after.bundles).toEqual(before.bundles);
            expect(after.progress).toHaveLength(1);
            expect(await t.mutation(endpoint, { plan })).toMatchObject({
              alreadyRetired: true,
              restoredProgressId: result.restoredProgressId,
              removedSections: 0,
              removedPlacements: 0,
            });
            expect(await t.query(stored)).toEqual(after);
            expect(after.progress[0]).toMatchObject({
              latestAttemptId: plan.previous._id,
              attemptNumber: 4,
              status: "completed",
              publishedScore: 100,
            });
          })
        )
      )
  );

  it.effect(
    "refuses a different attempt at the internal boundary before writes",
    () =>
      fixture().pipe(
        Effect.flatMap(({ t, plan }) =>
          Effect.promise(async () => {
            const before = await t.query(stored);
            await expect(t.mutation(endpoint, { plan })).rejects.toMatchObject({
              data: { code: "TRYOUT_EMPTY_RETIREMENT_REFUSED" },
            });
            expect(await t.query(stored)).toEqual(before);
          })
        )
      )
  );

  const changes = [
    {
      name: "publication changed",
      apply: async (ctx: MutationCtx, plan: Plan) => {
        const state = await ctx.db.query("contentState").unique();
        assert.ok(state);
        await ctx.db.patch(state._id, {
          activeSequence: plan.active.sequence + 1,
        });
      },
    },
    {
      name: "attempt activity changed",
      apply: (ctx: MutationCtx, plan: Plan) =>
        ctx.db.patch(plan.attempt._id, {
          lastActivityAt: plan.attempt.lastActivityAt + 1,
        }),
    },
    {
      name: "section activity changed",
      apply: (ctx: MutationCtx, plan: Plan) =>
        ctx.db.patch(plan.section._id, { answeredCount: 1 }),
    },
    {
      name: "frozen placement removed",
      apply: async (ctx: MutationCtx) => {
        const row = await ctx.db.query("tryoutAttemptPlacements").first();
        assert.ok(row);
        await ctx.db.delete(row._id);
      },
    },
    {
      name: "progress changed",
      apply: (ctx: MutationCtx, plan: Plan) =>
        ctx.db.patch(plan.progress._id, {
          updatedAt: plan.progress.updatedAt + 1,
        }),
    },
    {
      name: "predecessor score changed",
      apply: (ctx: MutationCtx, plan: Plan) =>
        ctx.db.patch(plan.previousScore._id, { publishedScore: 101 }),
    },
    {
      name: "scale ownership changed",
      apply: (ctx: MutationCtx, plan: Plan) =>
        ctx.db.patch(plan.scale._id, { history: true }),
    },
    {
      name: "shared history changed",
      apply: async (ctx: MutationCtx, plan: Plan) => {
        const shared = plan.sharedAttempts[0];
        assert.ok(shared);
        await ctx.db.patch(shared._id, {
          lastActivityAt: shared.lastActivityAt + 1,
        });
      },
    },
    {
      name: "new response",
      apply: async (ctx: MutationCtx, plan: Plan) => {
        const placement = await ctx.db.query("tryoutAttemptPlacements").first();
        assert.ok(placement);
        await ctx.db.insert("tryoutResponses", {
          answeredAt: 1,
          isComplete: true,
          isCorrect: true,
          placementId: placement._id,
          selection: { kind: "single-choice", optionKey: "option-1" },
          timeSpent: 1,
          tryoutAttemptId: plan.attempt._id,
          tryoutSectionAttemptId: plan.section._id,
          updatedAt: 1,
        });
      },
    },
    {
      name: "new score",
      apply: async (ctx: MutationCtx, plan: Plan) => {
        const { _id, _creationTime, ...score } = plan.previousScore;
        await ctx.db.insert("tryoutScores", {
          ...score,
          tryoutAttemptId: plan.attempt._id,
        });
      },
    },
  ];
  for (const change of changes) {
    it.effect(
      `refuses ${change.name} without changing any retained state`,
      () =>
        fixture().pipe(
          Effect.flatMap(({ t, plan }) =>
            Effect.promise(async () => {
              await t.mutation((ctx) => change.apply(ctx, plan));
              const before = await t.query(stored);
              await expect(
                t.mutation((ctx) => runConvexProgram(retireAttempt(ctx, plan)))
              ).rejects.toMatchObject({
                data: { code: "TRYOUT_EMPTY_RETIREMENT_REFUSED" },
              });
              expect(await t.query(stored)).toEqual(before);
            })
          )
        )
    );
  }

  for (const mode of [
    "missing-progress",
    "changed-progress",
    "partial-footprint",
    "changed-history",
    "changed-shared",
  ] as const) {
    it.effect(`refuses an incomplete or changed retry: ${mode}`, () =>
      fixture().pipe(
        Effect.flatMap(({ t, plan }) =>
          Effect.promise(async () => {
            await t.mutation((ctx) =>
              runConvexProgram(retireAttempt(ctx, plan))
            );
            await t.mutation(async (ctx) => {
              const progress = await ctx.db.query("tryoutSetProgress").unique();
              assert.ok(progress);
              if (mode === "missing-progress") {
                await ctx.db.delete(progress._id);
              } else if (mode === "changed-progress") {
                await ctx.db.patch(progress._id, { publishedScore: 101 });
              } else if (mode === "partial-footprint") {
                const { _id, _creationTime, ...section } = plan.section;
                await ctx.db.insert("tryoutSectionAttempts", section);
              } else if (mode === "changed-history") {
                await ctx.db.patch(plan.previousScore._id, {
                  publishedScore: 101,
                });
              } else {
                const shared = plan.sharedAttempts[0];
                assert.ok(shared);
                await ctx.db.patch(shared._id, {
                  lastActivityAt: shared.lastActivityAt + 1,
                });
              }
            });
            const before = await t.query(stored);
            await expect(
              t.mutation((ctx) => runConvexProgram(retireAttempt(ctx, plan)))
            ).rejects.toMatchObject({
              data: { code: "TRYOUT_EMPTY_RETIREMENT_REFUSED" },
            });
            expect(await t.query(stored)).toEqual(before);
          })
        )
      )
    );
  }

  it.effect(
    "rolls back a completed deletion phase if activity changes before the next phase",
    () =>
      fixture().pipe(
        Effect.flatMap(({ t, plan }) =>
          Effect.promise(async () => {
            const before = await t.query(stored);
            vi.mocked(cleanupAttemptRuntime).mockImplementationOnce(
              Effect.fn("test.retirement.activity")(function* (ctx, attempt) {
                yield* Effect.promise(() => ctx.db.delete(plan.section._id));
                yield* Effect.promise(() =>
                  ctx.db.patch(attempt._id, {
                    lastActivityAt: attempt.lastActivityAt + 1,
                  })
                );
                return true;
              })
            );
            await expect(
              t.mutation((ctx) => runConvexProgram(retireAttempt(ctx, plan)))
            ).rejects.toMatchObject({
              data: { code: "TRYOUT_EMPTY_RETIREMENT_REFUSED" },
            });
            expect(await t.query(stored)).toEqual(before);
          })
        )
      )
  );
});
