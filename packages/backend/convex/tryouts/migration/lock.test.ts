import { describe, expect, it } from "@effect/vitest";
import { internal } from "@repo/backend/convex/_generated/api";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
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

/** Inserts the first irreversible signed migration phase. */
function seedReadyMigration(ctx: MutationCtx) {
  return ctx.db.insert("tryoutHistoryMigrations", {
    artifactMapCount: 0,
    authorization: {
      planHash: digest,
      planJson: "{}",
      sourceScaleVersionIds: [],
    },
    catalogMapCount: 0,
    createdAt: 1,
    migrationId: MIGRATION_ID,
    phase: "ready",
    placementMapCount: 0,
    sourceSnapshotId: digest,
    target: {
      bundleCreated: false,
      bundleHash: digest,
      kind: "staged",
      snapshotCreated: false,
      snapshotId: digest,
    },
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
  it.effect("blocks candidate activation after signed authorization", () =>
    Effect.gen(function* () {
      const t = convexTest(schema, convexModules);
      yield* Effect.promise(() =>
        t.mutation(async (ctx) => {
          await seedVerifiedPair(ctx);
          await seedReadyMigration(ctx);
        })
      );

      yield* Effect.promise(() =>
        expect(t.mutation(activate, candidateRequest)).rejects.toMatchObject({
          data: {
            code: "CONTENT_RELEASE_STATE",
            message:
              "Content activation is locked by try-out history migration activation-lock-test in ready phase.",
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
        yield* Effect.promise(() => t.mutation(seedReadyMigration));

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
