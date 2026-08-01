import {
  hasSnapshotArtifactReference,
  isSnapshotReferenced,
} from "@repo/backend/convex/contentRelease/snapshot/retention";
import { tryoutPlacementFacts } from "@repo/backend/convex/contentRelease/tryout/facts";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { createConvexTestWithBetterAuth } from "@repo/backend/convex/test.helpers";
import { convexModules } from "@repo/backend/convex/test.setup";
import { TEST_ARTIFACT_HASH } from "@repo/backend/test/content-release";
import { insertTestRelease } from "@repo/backend/test/content-stage";
import { makeProgramSnapshotData } from "@repo/backend/test/program-snapshot";
import { seedTryoutMigration } from "@repo/backend/test/tryout-migration";
import { makeTryoutPlacementRow } from "@repo/backend/test/tryout-snapshot";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

describe("contentRelease/snapshot/retention", () => {
  it("protects snapshots selected by publication slots and recent history", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const candidate = convexTest(schema, convexModules);
    await candidate.mutation((ctx) =>
      insertTestRelease(ctx, { snapshots: data.snapshots })
    );
    await expect(
      candidate.mutation((ctx) =>
        runConvexProgram(isSnapshotReferenced(ctx, "program", data.snapshotId))
      )
    ).resolves.toBe(true);
    await expect(
      candidate.mutation((ctx) =>
        runConvexProgram(
          isSnapshotReferenced(ctx, "program", `sha256:${"9".repeat(64)}`)
        )
      )
    ).resolves.toBe(false);

    await candidate.mutation(async (ctx) => {
      const [release, state] = await Promise.all([
        ctx.db.query("contentReleases").unique(),
        ctx.db.query("contentState").unique(),
      ]);
      if (!(release && state)) {
        throw new Error("Expected candidate snapshot release.");
      }
      await ctx.db.patch("contentReleases", release._id, {
        completedAt: 1,
        status: "completed",
      });
      await ctx.db.patch("contentState", state._id, {
        candidateManifestHash: undefined,
        candidateReleaseId: undefined,
        candidateSequence: undefined,
      });
    });
    await expect(
      candidate.mutation((ctx) =>
        runConvexProgram(isSnapshotReferenced(ctx, "program", data.snapshotId))
      )
    ).resolves.toBe(true);
  });

  it("finds question and answer artifacts retained by try-out placements", async () => {
    const t = convexTest(schema, convexModules);
    const answerHash = `sha256:${"3".repeat(64)}`;
    const placement = makeTryoutPlacementRow().record;
    await t.mutation((ctx) =>
      ctx.db.insert("tryoutPlacements", {
        ...tryoutPlacementFacts(placement),
        answerArtifactHash: answerHash,
        index: 0,
        questionArtifactHash: TEST_ARTIFACT_HASH,
        rowHash: placement.rowHash,
        rowJson: "{}",
        snapshotId: `sha256:${"5".repeat(64)}`,
      })
    );

    await expect(
      t.mutation((ctx) =>
        runConvexProgram(hasSnapshotArtifactReference(ctx, TEST_ARTIFACT_HASH))
      )
    ).resolves.toBe(true);
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(hasSnapshotArtifactReference(ctx, answerHash))
      )
    ).resolves.toBe(true);
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          hasSnapshotArtifactReference(ctx, `sha256:${"6".repeat(64)}`)
        )
      )
    ).resolves.toBe(false);
  });

  it("protects try-out snapshots referenced by attempts and IRT scales", async () => {
    const t = createConvexTestWithBetterAuth();
    await t.mutation(seedTryoutMigration);
    const transactionSnapshotId = `sha256:${"7".repeat(64)}`;

    await t.mutation(async (ctx) => {
      const attempt = await ctx.db.query("tryoutAttempts").unique();
      if (!attempt) {
        throw new Error("Expected one technical try-out attempt.");
      }
      await ctx.db.patch("tryoutAttempts", attempt._id, {
        tryoutSnapshotId: transactionSnapshotId,
      });
    });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          isSnapshotReferenced(ctx, "tryout", transactionSnapshotId)
        )
      )
    ).resolves.toBe(true);

    await t.mutation(async (ctx) => {
      const [attempt, scale] = await Promise.all([
        ctx.db.query("tryoutAttempts").unique(),
        ctx.db.query("irtScaleVersions").unique(),
      ]);
      if (!(attempt && scale)) {
        throw new Error("Expected technical try-out history.");
      }
      await ctx.db.patch("tryoutAttempts", attempt._id, {
        tryoutSnapshotId: undefined,
      });
      await ctx.db.patch("irtScaleVersions", scale._id, {
        tryoutSnapshotId: transactionSnapshotId,
      });
    });
    await expect(
      t.mutation((ctx) =>
        runConvexProgram(
          isSnapshotReferenced(ctx, "tryout", transactionSnapshotId)
        )
      )
    ).resolves.toBe(true);
  });
});
