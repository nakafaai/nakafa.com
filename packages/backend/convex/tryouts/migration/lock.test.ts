import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
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

/** Inserts an authorized migration before permanent writes begin. */
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

/** Inserts a migration that owns its permanent target identity. */
function seedRunningMigration(ctx: MutationCtx) {
  return ctx.db.insert("tryoutHistoryMigrations", {
    artifactMapCount: 0,
    authorization,
    catalogMapCount: 0,
    createdAt: 1,
    migrationId: MIGRATION_ID,
    phase: "running",
    placementMapCount: 0,
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
    sourceSnapshotId: digest,
    target,
    updatedAt: 1,
  });
}

/** Inserts cleanup ownership before the migration root is deleted. */
function seedCleaningMigration(ctx: MutationCtx) {
  return ctx.db.insert("tryoutHistoryMigrations", {
    artifactMapCount: 0,
    authorization,
    catalogMapCount: 0,
    cleanup: initialCleanupState(1),
    completion,
    createdAt: 1,
    migrationId: MIGRATION_ID,
    phase: "cleaning",
    placementMapCount: 0,
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
  it.effect("blocks candidate activation while migration runs", () =>
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

  it.effect("allows ready activation before migration begins", () =>
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

  it.effect("locks cleanup ownership until root deletion", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation((ctx) => seedCleaningMigration(ctx))
      );
      yield* Effect.promise(() =>
        expect(
          t.mutation((ctx) =>
            runConvexProgram(requireContentActivationUnlocked(ctx))
          )
        ).rejects.toMatchObject({
          data: { code: "CONTENT_RELEASE_STATE" },
        })
      );
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          const migration = await ctx.db
            .query("tryoutHistoryMigrations")
            .unique();
          if (migration) {
            await ctx.db.delete(migration._id);
          }
        })
      );
      const result = yield* Effect.promise(() =>
        t.mutation((ctx) =>
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
