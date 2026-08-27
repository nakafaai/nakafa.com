import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from "@effect/vitest";
import { sealPredecessorObservation } from "@repo/backend/convex/contentRelease/predecessor/control";
import { recordPredecessorRead } from "@repo/backend/convex/contentRelease/predecessor/record";
import { PREDECESSOR_QUIET_WINDOW_MS } from "@repo/backend/convex/contentRelease/predecessor/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  PREDECESSOR_OBSERVATION_ID,
  seedPredecessorObservation,
} from "@repo/backend/test/predecessor";
import {
  insertTryoutAttempt,
  insertTryoutUser,
} from "@repo/backend/test/tryout/runtime";
import { makeTryoutSet } from "@repo/backend/test/tryouts";
import { makeFunctionReference } from "convex/server";
import { convexTest } from "convex-test";

const MIGRATION_ID = "late-read-migration";
const SOURCE_SNAPSHOT_ID = `sha256:${"a".repeat(64)}`;
const TARGET_SNAPSHOT_ID = `sha256:${"b".repeat(64)}`;
const TARGET_BUNDLE_HASH = `sha256:${"c".repeat(64)}`;

const nextAttempt = makeFunctionReference<
  "mutation",
  { migrationId: string },
  { done: boolean; migrated: 0 | 1 }
>("tryouts/migration/attempt/run:next");

describe("tryouts/migration/attempt/run", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it("fails closed when a late predecessor read follows migration start", async () => {
    const target = convexTest(schema, convexModules);
    const armedAt = Date.UTC(2026, 7, 26, 8);
    vi.setSystemTime(armedAt);
    await seedPredecessorObservation(target);
    const state = await target.mutation(async (ctx) => {
      const userId = await insertTryoutUser(ctx, {
        authId: "late-read-user",
        email: "late-read@example.com",
        name: "Late Read",
      });
      const attemptId = await insertTryoutAttempt(ctx, {
        sectionSnapshots: [],
        set: makeTryoutSet(),
        snapshotId: SOURCE_SNAPSHOT_ID,
        snapshotReleaseId: "source-release",
        status: "completed",
        userId,
      });
      const markerId = await ctx.db.insert("tryoutAttemptHistory", {
        snapshotReleaseId: "source-release",
        tryoutAttemptId: attemptId,
        tryoutSnapshotId: SOURCE_SNAPSHOT_ID,
      });
      const rootId = await ctx.db.insert("tryoutHistoryMigrations", {
        artifactMapCount: 0,
        authorization: {
          planHash: TARGET_BUNDLE_HASH,
          planJson: "{}",
          sourceScaleVersionIds: [],
        },
        catalogMapCount: 0,
        createdAt: armedAt,
        migrationId: MIGRATION_ID,
        phase: "running",
        placementMapCount: 0,
        predecessorObservationId: PREDECESSOR_OBSERVATION_ID,
        progress: {
          migratedAttempts: 0,
          migratedScaleItems: 0,
          migratedScaleRuns: 0,
          migratedScaleVersions: 0,
        },
        sourceSnapshotId: SOURCE_SNAPSHOT_ID,
        target: {
          bundleCreated: true,
          bundleHash: TARGET_BUNDLE_HASH,
          kind: "staged",
          snapshotCreated: true,
          snapshotId: TARGET_SNAPSHOT_ID,
        },
        updatedAt: armedAt,
      });
      return { attemptId, markerId, rootId };
    });

    vi.setSystemTime(armedAt + PREDECESSOR_QUIET_WINDOW_MS);
    await target.mutation((ctx) =>
      runConvexProgram(
        sealPredecessorObservation(ctx, PREDECESSOR_OBSERVATION_ID)
      )
    );
    vi.setSystemTime(armedAt + PREDECESSOR_QUIET_WINDOW_MS + 1);
    await target.mutation((ctx) =>
      runConvexProgram(recordPredecessorRead(ctx, "history"))
    );

    await expect(
      target.mutation(nextAttempt, { migrationId: MIGRATION_ID })
    ).rejects.toMatchObject({
      data: {
        code: "CONTENT_RELEASE_STATE",
        message:
          "Every predecessor route must complete its observation window before migration.",
      },
    });
    await expect(
      target.run(async (ctx) => ({
        attempt: await ctx.db.get("tryoutAttempts", state.attemptId),
        marker: await ctx.db.get("tryoutAttemptHistory", state.markerId),
        root: await ctx.db.get("tryoutHistoryMigrations", state.rootId),
      }))
    ).resolves.toMatchObject({
      attempt: { tryoutSnapshotId: SOURCE_SNAPSHOT_ID },
      marker: { tryoutSnapshotId: SOURCE_SNAPSHOT_ID },
      root: { progress: { migratedAttempts: 0 } },
    });
  });
});
