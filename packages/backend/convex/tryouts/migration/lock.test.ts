import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { PREDECESSOR_ROUTES } from "@repo/backend/convex/contentRelease/predecessor/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import { initialCleanupState } from "@repo/backend/convex/tryouts/migration/cleanup/count";
import { requireContentActivationUnlocked } from "@repo/backend/convex/tryouts/migration/lock";
import {
  CANDIDATE,
  RECOVERY,
  seedVerifiedPair,
} from "@repo/backend/test/activation/fixture";
import { testRendererJson } from "@repo/backend/test/content/release";
import { convexTest } from "convex-test";
import { Effect } from "effect";

const MIGRATION_ID = "activation-lock-test";
const digest = `sha256:${"a".repeat(64)}`;
const activate = internal.contentRelease.activate.activate;
const activateRecovery = internal.contentRelease.activate.activateRecovery;
const authorization = {
  planHash: digest,
  planJson: "{}",
  sourceScaleVersionIds: [],
};
const target = {
  bundleCreated: false,
  bundleHash: digest,
  kind: "staged" as const,
  snapshotCreated: false,
  snapshotId: digest,
};
const completion = {
  cleanupLimit: 1,
  completedAt: 1,
  migratedAttempts: 0,
  migratedScaleItems: 0,
  migratedScaleRuns: 0,
  migratedScaleVersions: 0,
};

/** Inserts an authorized migration before its observation becomes binding. */
function seedReadyMigration(ctx: MutationCtx) {
  return ctx.db.insert("tryoutHistoryMigrations", {
    artifactMapCount: 0,
    authorization,
    catalogMapCount: 0,
    createdAt: 1,
    migrationId: MIGRATION_ID,
    phase: "ready",
    placementMapCount: 0,
    sourceSnapshotId: digest,
    target,
    updatedAt: 1,
  });
}

/** Inserts a migration that has bound its sealed predecessor observation. */
function seedRunningMigration(ctx: MutationCtx) {
  return ctx.db.insert("tryoutHistoryMigrations", {
    artifactMapCount: 0,
    authorization,
    catalogMapCount: 0,
    createdAt: 1,
    migrationId: MIGRATION_ID,
    phase: "running",
    placementMapCount: 0,
    predecessorObservationId: "activation-lock-observation",
    progress: {
      migratedAttempts: 0,
      migratedScaleItems: 0,
      migratedScaleRuns: 0,
      migratedScaleVersions: 0,
    },
    sourceSnapshotId: digest,
    target,
    updatedAt: 1,
  });
}

/** Inserts terminal migration ownership before destructive cleanup begins. */
function seedCompletedMigration(ctx: MutationCtx) {
  return ctx.db.insert("tryoutHistoryMigrations", {
    artifactMapCount: 0,
    authorization,
    catalogMapCount: 0,
    completion,
    createdAt: 1,
    migrationId: MIGRATION_ID,
    phase: "completed",
    placementMapCount: 0,
    predecessorObservationId: "activation-lock-observation",
    sourceSnapshotId: digest,
    target,
    updatedAt: 1,
  });
}

/** Inserts cleanup ownership before or after observer deletion. */
function seedCleaningMigration(ctx: MutationCtx, observerCount: number) {
  const cleanup = initialCleanupState(1);
  return ctx.db.insert("tryoutHistoryMigrations", {
    artifactMapCount: 0,
    authorization,
    catalogMapCount: 0,
    cleanup: {
      ...cleanup,
      counts: { ...cleanup.counts, observer: observerCount },
      kind: "observer",
    },
    completion,
    createdAt: 1,
    migrationId: MIGRATION_ID,
    phase: "cleaning",
    placementMapCount: 0,
    predecessorObservationId: "activation-lock-observation",
    sourceSnapshotId: digest,
    target,
    updatedAt: 1,
  });
}

/** Inserts a reversible root whose staged bytes can still be aborted. */
function seedStagingMigration(ctx: MutationCtx) {
  return ctx.db.insert("tryoutHistoryMigrations", {
    artifactMapCount: 0,
    catalogMapCount: 0,
    createdAt: 1,
    migrationId: MIGRATION_ID,
    phase: "staging",
    placementMapCount: 0,
    sourceSnapshotId: digest,
    target: { kind: "pending" },
    updatedAt: 1,
  });
}

const candidateRequest = {
  manifestHash: CANDIDATE.manifestHash,
  releaseId: CANDIDATE.releaseId,
  rendererJson: testRendererJson(),
};
const recoveryRequest = {
  manifestHash: RECOVERY.manifestHash,
  releaseId: RECOVERY.releaseId,
  rendererJson: testRendererJson(),
};

describe("tryouts/migration/lock", () => {
  it.effect("blocks candidate activation after observer binding", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          await seedVerifiedPair(ctx);
          await seedRunningMigration(ctx);
        })
      );

      yield* Effect.promise(() =>
        expect(t.mutation(activate, candidateRequest)).rejects.toMatchObject({
          data: {
            code: "CONTENT_RELEASE_STATE",
            message:
              "Content activation is locked by try-out history migration activation-lock-test in running phase.",
          },
        })
      );
      const state = yield* Effect.promise(() =>
        t.query((ctx) => ctx.db.query("contentState").unique())
      );
      expect(state?.activeReleaseId).toBeUndefined();
    })
  );

  it.effect(
    "blocks recovery activation without blocking completed retries",
    () =>
      Effect.gen(function* () {
        const t = convexTest(schema, convexModules);
        yield* Effect.promise(() => t.mutation(seedVerifiedPair));
        const activated = yield* Effect.promise(() =>
          t.mutation(activate, candidateRequest)
        );
        yield* Effect.promise(() => t.mutation(seedRunningMigration));

        const repeated = yield* Effect.promise(() =>
          t.mutation(activate, candidateRequest)
        );
        expect(repeated).toEqual({
          kind: "completed",
          receipt: activated.receipt,
        });
        yield* Effect.promise(() =>
          expect(
            t.mutation(activateRecovery, recoveryRequest)
          ).rejects.toMatchObject({
            data: { code: "CONTENT_RELEASE_STATE" },
          })
        );
      })
  );

  it.effect("allows ready activation before observer binding", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          await seedVerifiedPair(ctx);
          await seedReadyMigration(ctx);
        })
      );

      const result = yield* Effect.promise(() =>
        t.mutation(activate, candidateRequest)
      );
      expect(result.kind).toBe("activated");
    })
  );

  it.effect("allows activation while staged work remains abortable", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          await seedVerifiedPair(ctx);
          await seedStagingMigration(ctx);
        })
      );

      const result = yield* Effect.promise(() =>
        t.mutation(activate, candidateRequest)
      );
      expect(result.kind).toBe("activated");
    })
  );

  it.effect("locks completed ownership", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() => t.mutation(seedCompletedMigration));

      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(requireContentActivationUnlocked(ctx))
          )
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_STATE" },
        })
      );
    })
  );

  it.effect("releases cleanup ownership after observer deletion", () =>
    Effect.gen(function* () {
      const locked = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        locked.mutation((ctx) => seedCleaningMigration(ctx, 0))
      );
      yield* Effect.promise(() =>
        expect(
          locked.mutation((ctx) =>
            runConvexProgram(requireContentActivationUnlocked(ctx))
          )
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_STATE" },
        })
      );

      const released = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        released.mutation((ctx) =>
          seedCleaningMigration(ctx, PREDECESSOR_ROUTES.length)
        )
      );
      const result = yield* Effect.promise(() =>
        released.mutation((ctx) =>
          runConvexProgram(requireContentActivationUnlocked(ctx))
        )
      );
      expect(result).toBeNull();
    })
  );

  it.effect("rejects corrupt duplicate migration ownership", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          await seedVerifiedPair(ctx);
          await seedStagingMigration(ctx);
          await ctx.db.insert("tryoutHistoryMigrations", {
            artifactMapCount: 0,
            catalogMapCount: 0,
            createdAt: 2,
            migrationId: `${MIGRATION_ID}-duplicate`,
            phase: "staging",
            placementMapCount: 0,
            sourceSnapshotId: digest,
            target: { kind: "pending" },
            updatedAt: 2,
          });
        })
      );

      yield* Effect.promise(() =>
        expect(t.mutation(activate, candidateRequest)).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_INTEGRITY" },
        })
      );
    })
  );
});
