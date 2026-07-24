import { Sha256HashSchema } from "@nakafa/aksara-contracts/ids";
import { canonicalizeContentSnapshotManifest } from "@nakafa/aksara-contracts/release/snapshot-data";
import { loadVerifiedProgramCatalog } from "@repo/backend/convex/learningPrograms/snapshot";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import schema from "@repo/backend/convex/schema";
import { convexModules } from "@repo/backend/convex/test.setup";
import {
  makeProgramSnapshotData,
  stageProgramSnapshot,
} from "@repo/backend/test/content-snapshot";
import type { TestConvex } from "convex-test";
import { convexTest } from "convex-test";
import { Effect } from "effect";
import { describe, expect, it } from "vitest";

/** Marks the staged technical snapshot as proof-verified. */
async function verifySnapshot(t: TestConvex<typeof schema>) {
  await t.mutation(async (ctx) => {
    const snapshot = await ctx.db.query("contentSnapshots").unique();
    if (!snapshot) {
      throw new Error("Expected a staged program snapshot.");
    }
    await ctx.db.patch("contentSnapshots", snapshot._id, { verifiedAt: 1 });
  });
}

describe("learningPrograms/snapshot", () => {
  it("loads every row only after proof verification", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await stageProgramSnapshot(t, data);

    await expect(
      t.query((ctx) =>
        runConvexProgram(loadVerifiedProgramCatalog(ctx, data.snapshotId))
      )
    ).rejects.toThrow("LEARNING_PROGRAM_SNAPSHOT_UNVERIFIED");

    await verifySnapshot(t);
    await expect(
      t.query((ctx) =>
        runConvexProgram(loadVerifiedProgramCatalog(ctx, data.snapshotId))
      )
    ).resolves.toHaveLength(6);
  });

  it("rejects manifest, row-count, and row-identity drift", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const manifestDrift = convexTest(schema, convexModules);
    await stageProgramSnapshot(manifestDrift, data);
    await verifySnapshot(manifestDrift);
    await manifestDrift.mutation(async (ctx) => {
      const snapshot = await ctx.db.query("contentSnapshots").unique();
      if (!snapshot) {
        throw new Error("Expected a staged program snapshot.");
      }
      await ctx.db.patch("contentSnapshots", snapshot._id, {
        snapshotJson: canonicalizeContentSnapshotManifest({
          family: "program",
          manifest: {
            ...data.snapshot.manifest,
            snapshotId: Sha256HashSchema.make(`sha256:${"f".repeat(64)}`),
          },
        }),
      });
    });
    await expect(
      manifestDrift.query((ctx) =>
        runConvexProgram(loadVerifiedProgramCatalog(ctx, data.snapshotId))
      )
    ).rejects.toThrow("LEARNING_PROGRAM_SNAPSHOT_INVALID");

    const missingRow = convexTest(schema, convexModules);
    await stageProgramSnapshot(missingRow, data);
    await verifySnapshot(missingRow);
    await missingRow.mutation(async (ctx) => {
      const row = await ctx.db.query("programRows").first();
      if (!row) {
        throw new Error("Expected a staged program row.");
      }
      await ctx.db.delete(row._id);
    });
    await expect(
      missingRow.query((ctx) =>
        runConvexProgram(loadVerifiedProgramCatalog(ctx, data.snapshotId))
      )
    ).rejects.toThrow("LEARNING_PROGRAM_SNAPSHOT_INVALID");

    const identityDrift = convexTest(schema, convexModules);
    await stageProgramSnapshot(identityDrift, data);
    await verifySnapshot(identityDrift);
    await identityDrift.mutation(async (ctx) => {
      const row = await ctx.db.query("programRows").first();
      if (!row) {
        throw new Error("Expected a staged program row.");
      }
      await ctx.db.patch("programRows", row._id, {
        programKey: "tampered",
      });
    });
    await expect(
      identityDrift.query((ctx) =>
        runConvexProgram(loadVerifiedProgramCatalog(ctx, data.snapshotId))
      )
    ).rejects.toThrow("LEARNING_PROGRAM_SNAPSHOT_INVALID");
  });

  it("maps malformed stored JSON to one stable source failure", async () => {
    const data = await Effect.runPromise(makeProgramSnapshotData());
    const t = convexTest(schema, convexModules);
    await stageProgramSnapshot(t, data);
    await verifySnapshot(t);
    await t.mutation(async (ctx) => {
      const row = await ctx.db.query("programRows").first();
      if (!row) {
        throw new Error("Expected a staged program row.");
      }
      await ctx.db.patch("programRows", row._id, { rowJson: "{" });
    });

    await expect(
      t.query((ctx) =>
        runConvexProgram(loadVerifiedProgramCatalog(ctx, data.snapshotId))
      )
    ).rejects.toThrow("LEARNING_PROGRAM_SNAPSHOT_INVALID");
  });
});
