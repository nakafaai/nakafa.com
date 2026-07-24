import {
  digestProgramRows,
  makeProgramSnapshotRow,
} from "@nakafa/aksara-contracts/program/row-hash";
import {
  PROGRAM_SNAPSHOT_FORMAT,
  ProgramSnapshotSchema,
} from "@nakafa/aksara-contracts/program/snapshot";
import { hashProgramSnapshot } from "@nakafa/aksara-contracts/program/snapshot-hash";
import { LearningProgramSchema } from "@nakafa/aksara-contracts/program/spec";
import {
  canonicalizeContentSnapshotManifest,
  canonicalizeContentSnapshotRow,
} from "@nakafa/aksara-contracts/release/snapshot-data";
import { internal } from "@repo/backend/convex/_generated/api";
import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { getLearningProgramCatalogInputs } from "@repo/backend/convex/learningPrograms/catalog";
import type schema from "@repo/backend/convex/schema";
import { createLearningGraphIdentityFromRoute } from "@repo/contents/_types/learning-graph";
import { makeFunctionReference } from "convex/server";
import type { Value } from "convex/values";
import type { TestConvex } from "convex-test";
import { Effect, Schema, Stream } from "effect";

const NOW = 1_798_752_000_000;
const graph = createLearningGraphIdentityFromRoute({
  locale: "id",
  route: "material/lesson/chemistry/atomic-structure",
});

/** Exact arguments accepted by the temporary program identity route. */
export interface ProgramMigrationArgs extends Record<string, Value> {
  readonly apply: boolean;
  readonly expected: {
    readonly coverage: number;
    readonly items: number;
    readonly plans: number;
    readonly profiles: number;
    readonly programs: number;
    readonly sources: number;
  };
  readonly expectedMissing: number;
  readonly legacyMappings: {
    readonly historicalKey: "id-kurikulum-merdeka" | "snbt-2026";
    readonly programId: Id<"learningPrograms">;
  }[];
  readonly snapshotId: string;
  readonly table: "coverage" | "items" | "plans" | "profiles";
}

interface ProgramMigrationResult {
  readonly missing: number;
  readonly remaining: number;
  readonly total: number;
  readonly updated: number;
}

/** Internal function reference used by migration integration tests. */
export const migrateProgramIdentity = makeFunctionReference<
  "mutation",
  ProgramMigrationArgs,
  ProgramMigrationResult
>("learningPrograms/migrations/identity:migrateProgramIdentity");

/** Publishes the real six-row catalog as one proof-verified test snapshot. */
export async function stageVerifiedPrograms(t: TestConvex<typeof schema>) {
  const programs = Schema.decodeUnknownSync(
    Schema.Array(LearningProgramSchema)
  )(getLearningProgramCatalogInputs());
  const records = await Effect.runPromise(
    Effect.forEach(programs, makeProgramSnapshotRow)
  );
  const summary = await Effect.runPromise(
    digestProgramRows(Stream.fromIterable(records))
  );
  const snapshotId = await Effect.runPromise(
    hashProgramSnapshot({
      ...summary,
      format: PROGRAM_SNAPSHOT_FORMAT,
      locales: ["en", "id"],
    })
  );
  const manifest = {
    family: "program" as const,
    manifest: ProgramSnapshotSchema.make({
      ...summary,
      format: PROGRAM_SNAPSHOT_FORMAT,
      locales: ["en", "id"],
      snapshotId,
    }),
  };
  await t.mutation(async (ctx) => {
    await ctx.db.insert("contentSnapshots", {
      createdAt: NOW,
      family: "program",
      retainUntil: Number.MAX_SAFE_INTEGER,
      snapshotId,
      snapshotJson: canonicalizeContentSnapshotManifest(manifest),
      verifiedAt: NOW,
    });
    for (const [index, record] of records.entries()) {
      await ctx.db.insert("programRows", {
        index,
        programKey: record.row.key,
        rowHash: record.rowHash,
        rowJson: canonicalizeContentSnapshotRow({
          family: "program",
          record,
        }),
        snapshotId,
      });
    }
  });
  return snapshotId;
}

/** Inserts one minimal app user for relational migration fixtures. */
async function insertUser(ctx: MutationCtx, suffix: string) {
  return await ctx.db.insert("users", {
    authId: `auth-${suffix}`,
    credits: 0,
    creditsResetAt: NOW,
    email: `${suffix}@example.test`,
    name: suffix,
    plan: "free",
  });
}

/** Seeds current catalog state plus one reviewed historical Merdeka identity. */
export async function seedProgramMigration(
  t: TestConvex<typeof schema>,
  itemCount = 1
) {
  await t.mutation(internal.learningPrograms.sync.syncLearningPrograms, {
    programs: getLearningProgramCatalogInputs(),
    syncedAt: NOW,
  });
  return await t.mutation(async (ctx) => {
    const merdeka = await ctx.db
      .query("learningPrograms")
      .withIndex("by_key", (query) => query.eq("key", "merdeka"))
      .unique();
    if (!(merdeka && graph)) {
      throw new Error("Expected real Merdeka program and graph identity.");
    }
    const { _creationTime, _id, ...programFields } = merdeka;
    const orphanId = await ctx.db.insert("learningPrograms", {
      ...programFields,
      key: "id-kurikulum-merdeka",
    });
    await ctx.db.delete(orphanId);

    const orphanUserId = await insertUser(ctx, "orphan");
    const currentUserId = await insertUser(ctx, "current");
    const orphanProfileId = await ctx.db.insert("learningProfiles", {
      interests: ["school-curriculum"],
      programId: orphanId,
      updatedAt: NOW,
      userId: orphanUserId,
    });
    const orphanPlanId = await ctx.db.insert("learningPlans", {
      createdAt: NOW,
      profileId: orphanProfileId,
      programId: orphanId,
      status: "active",
      updatedAt: NOW,
      userId: orphanUserId,
      version: 1,
    });
    await ctx.db.patch(orphanProfileId, { activePlanId: orphanPlanId });

    const currentProfileId = await ctx.db.insert("learningProfiles", {
      interests: ["school-curriculum"],
      programId: merdeka._id,
      updatedAt: NOW,
      userId: currentUserId,
    });
    const currentPlanId = await ctx.db.insert("learningPlans", {
      createdAt: NOW,
      profileId: currentProfileId,
      programId: merdeka._id,
      status: "active",
      updatedAt: NOW,
      userId: currentUserId,
      version: 1,
    });
    await ctx.db.patch(currentProfileId, { activePlanId: currentPlanId });
    for (let position = 1; position <= itemCount; position += 1) {
      await ctx.db.insert("learningPlanItems", {
        content_id: `${graph.assetId}:${position}`,
        coverageStatus: "partial",
        createdAt: NOW,
        lensId: graph.lensId,
        lensScope: "curriculum",
        planId: currentPlanId,
        position,
        programId: merdeka._id,
        reason: "program-alignment",
        status: "ready",
        updatedAt: NOW,
        userId: currentUserId,
      });
    }
    await ctx.db.insert("learningProgramCoverage", {
      contentCount: 1,
      coverageStatus: "partial",
      lensId: graph.lensId,
      lensScope: "curriculum",
      locale: "id",
      programId: merdeka._id,
      sampleContentId: graph.assetId,
      syncedAt: NOW,
    });
    return { currentPlanId, currentProfileId, orphanId, orphanPlanId };
  });
}

/** Builds exact migration arguments for the seeded bounded state. */
export function programMigrationArgs(
  snapshotId: string,
  orphanId: Id<"learningPrograms">,
  table: ProgramMigrationArgs["table"],
  expectedMissing: number,
  itemCount = 1
): ProgramMigrationArgs {
  return {
    apply: false,
    expected: {
      coverage: 1,
      items: itemCount,
      plans: 2,
      profiles: 2,
      programs: 6,
      sources: 18,
    },
    expectedMissing,
    legacyMappings: [
      { historicalKey: "id-kurikulum-merdeka", programId: orphanId },
    ],
    snapshotId,
    table,
  };
}
