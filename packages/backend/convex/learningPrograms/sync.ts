import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import { internalMutation } from "@repo/backend/convex/functions";
import {
  learningProgramCoverageInputValidator,
  learningProgramInputValidator,
  type programSourceInputValidator,
} from "@repo/backend/convex/learningPrograms/schema";
import { LearningProgramSchema } from "@repo/contents/_types/program/schema";
import { ConvexError, type Infer, v } from "convex/values";
import { Either, Schema } from "effect";

const SOURCE_LIMIT = 20;
const PROGRAM_RECONCILE_LIMIT = 100;
const STALE_COVERAGE_DELETE_LIMIT = 200;
type ProgramSourceInput = Infer<typeof programSourceInputValidator>;
const LearningProgramSyncInputSchema = Schema.Array(LearningProgramSchema);

const syncResultValidator = v.object({
  created: v.number(),
  skipped: v.number(),
  updated: v.number(),
});
const deleteResultValidator = v.object({
  deleted: v.number(),
});

/** Upserts the program catalog and its source references from contents contracts. */
export const syncLearningPrograms = internalMutation({
  args: {
    programs: v.array(learningProgramInputValidator),
    syncedAt: v.number(),
  },
  returns: syncResultValidator,
  handler: async (ctx, args) => {
    const programs = decodeLearningProgramsForSync(args.programs);

    if (programs.length === 0) {
      throw new ConvexError({
        code: "LEARNING_PROGRAM_CATALOG_EMPTY",
        message: "Learning program catalog sync requires at least one row.",
      });
    }

    let created = 0;
    let updated = 0;

    for (const program of programs) {
      const existing = await ctx.db
        .query("learningPrograms")
        .withIndex("by_key", (q) => q.eq("key", program.key))
        .unique();
      const row = {
        defaultCoverageStatus: program.defaultCoverageStatus,
        displayOrder: program.displayOrder,
        key: program.key,
        kind: program.kind,
        navigation: {
          levels: [...program.navigation.levels],
          model: program.navigation.model,
        },
        providerCountry: program.provider.country,
        providerKind: program.provider.kind,
        providerName: program.provider.name,
        recommendedCountry: program.recommendedCountry,
        syncedAt: args.syncedAt,
        translations: program.translations,
        updatedAt: args.syncedAt,
        versionEndsAt: program.version.endsAt,
        versionLabel: program.version.label,
        versionStartsAt: program.version.startsAt,
      };

      const programId = existing
        ? existing._id
        : await ctx.db.insert("learningPrograms", row);

      if (existing) {
        await ctx.db.replace(existing._id, row);
        updated++;
      } else {
        created++;
      }

      await syncProgramSources(ctx, {
        programId,
        sources: program.sources,
        syncedAt: args.syncedAt,
      });
    }

    updated += await hideOmittedCatalogPrograms(ctx, {
      incomingKeys: new Set(programs.map((program) => program.key)),
      syncedAt: args.syncedAt,
    });

    return { created, skipped: 0, updated };
  },
});

/** Decodes sync rows through the Effect-owned program registry contract before writes. */
function decodeLearningProgramsForSync(
  programs: Infer<typeof learningProgramInputValidator>[]
) {
  const decoded = Schema.decodeUnknownEither(LearningProgramSyncInputSchema)(
    programs
  );

  if (Either.isLeft(decoded)) {
    throw new ConvexError({
      code: "LEARNING_PROGRAM_CATALOG_INVALID",
      message:
        "Learning program catalog sync received rows outside the contents registry contract.",
    });
  }

  return decoded.right;
}

/** Upserts graph-backed program coverage rows from the content sync projection. */
export const syncLearningProgramCoverage = internalMutation({
  args: {
    coverageRows: v.array(learningProgramCoverageInputValidator),
  },
  returns: syncResultValidator,
  handler: async (ctx, args) => {
    let created = 0;
    let skipped = 0;
    let updated = 0;

    for (const row of args.coverageRows) {
      const program = await ctx.db
        .query("learningPrograms")
        .withIndex("by_key", (q) => q.eq("key", row.programKey))
        .unique();

      if (!program) {
        skipped++;
        continue;
      }

      const existing = await ctx.db
        .query("learningProgramCoverage")
        .withIndex("by_programId_and_locale_and_lensId", (q) =>
          q
            .eq("programId", program._id)
            .eq("locale", row.locale)
            .eq("lensId", row.lensId)
        )
        .unique();
      const patch = {
        contentCount: row.contentCount,
        coverageStatus: row.coverageStatus,
        lensId: row.lensId,
        lensScope: row.lensScope,
        locale: row.locale,
        programId: program._id,
        sampleContentId: row.sampleContentId,
        syncedAt: row.syncedAt,
      };

      if (!existing) {
        await ctx.db.insert("learningProgramCoverage", patch);
        created++;
        continue;
      }

      await ctx.db.patch(existing._id, patch);
      updated++;
    }

    return { created, skipped, updated };
  },
});

/** Deletes older derived coverage rows for one locale through bounded batches. */
export const deleteStaleLearningProgramCoverage = internalMutation({
  args: {
    limit: v.number(),
    locale: learningProgramCoverageInputValidator.fields.locale,
    syncedAt: v.number(),
  },
  returns: deleteResultValidator,
  handler: async (ctx, args) => {
    if (args.limit < 1 || args.limit > STALE_COVERAGE_DELETE_LIMIT) {
      throw new ConvexError({
        code: "LEARNING_PROGRAM_COVERAGE_DELETE_LIMIT_INVALID",
        message: `Learning program coverage delete limit must be between 1 and ${STALE_COVERAGE_DELETE_LIMIT}.`,
      });
    }

    const staleRows = await ctx.db
      .query("learningProgramCoverage")
      .withIndex("by_locale_and_syncedAt", (q) =>
        q.eq("locale", args.locale).lt("syncedAt", args.syncedAt)
      )
      .take(args.limit);

    for (const row of staleRows) {
      await ctx.db.delete(row._id);
    }

    return { deleted: staleRows.length };
  },
});

/** Replaces bounded program source rows for one catalog program. */
async function syncProgramSources(
  ctx: MutationCtx,
  {
    programId,
    sources,
    syncedAt,
  }: {
    programId: Id<"learningPrograms">;
    sources: readonly ProgramSourceInput[];
    syncedAt: number;
  }
) {
  if (sources.length > SOURCE_LIMIT) {
    throw new ConvexError({
      code: "LEARNING_PROGRAM_SOURCE_LIMIT_EXCEEDED",
      message: "Learning program source count exceeds the sync limit.",
    });
  }

  const existingSources = await ctx.db
    .query("learningProgramSources")
    .withIndex("by_programId", (q) => q.eq("programId", programId))
    .take(SOURCE_LIMIT + 1);

  if (existingSources.length > SOURCE_LIMIT) {
    throw new ConvexError({
      code: "LEARNING_PROGRAM_SOURCE_LIMIT_EXCEEDED",
      message: "Existing learning program sources exceed the sync limit.",
    });
  }

  for (const row of existingSources) {
    await ctx.db.delete(row._id);
  }

  for (const source of sources) {
    await ctx.db.insert("learningProgramSources", {
      ...source,
      programId,
      syncedAt,
    });
  }
}

/** Hides rows omitted from the latest full content-catalog sync without deleting referenced program IDs. */
async function hideOmittedCatalogPrograms(
  ctx: MutationCtx,
  {
    incomingKeys,
    syncedAt,
  }: {
    incomingKeys: ReadonlySet<string>;
    syncedAt: number;
  }
) {
  const existingPrograms = await ctx.db
    .query("learningPrograms")
    .withIndex("by_displayOrder")
    .take(PROGRAM_RECONCILE_LIMIT + 1);

  if (existingPrograms.length > PROGRAM_RECONCILE_LIMIT) {
    throw new ConvexError({
      code: "LEARNING_PROGRAM_RECONCILE_LIMIT_EXCEEDED",
      message: `Learning program catalog reconciliation is limited to ${PROGRAM_RECONCILE_LIMIT} rows.`,
    });
  }

  let hidden = 0;

  for (const program of existingPrograms) {
    if (
      program.providerKind !== "official" &&
      program.providerKind !== "nakafa"
    ) {
      continue;
    }

    if (incomingKeys.has(program.key)) {
      continue;
    }

    if (
      program.defaultCoverageStatus === "hidden" ||
      program.defaultCoverageStatus === "archived"
    ) {
      continue;
    }

    await ctx.db.patch(program._id, {
      defaultCoverageStatus: "hidden",
      syncedAt,
      updatedAt: syncedAt,
    });
    hidden++;
  }

  return hidden;
}
