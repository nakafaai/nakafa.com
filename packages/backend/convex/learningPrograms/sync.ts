import { internalMutation } from "@repo/backend/convex/functions";
import {
  deleteOmittedCatalogProgramBatch,
  deleteOmittedCatalogPrograms,
} from "@repo/backend/convex/learningPrograms/omitted";
import { learningProgramInputValidator } from "@repo/backend/convex/learningPrograms/schema";
import { syncProgramSources } from "@repo/backend/convex/learningPrograms/sources";
import { LearningProgramSchema } from "@repo/contents/_types/program/schema";
import { ConvexError, type Infer, v } from "convex/values";
import { Either, Schema } from "effect";

const LearningProgramSyncInputSchema = Schema.Array(LearningProgramSchema);

const syncResultValidator = v.object({
  created: v.number(),
  skipped: v.number(),
  updated: v.number(),
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
        iconKey: program.iconKey,
        key: program.key,
        kind: program.kind,
        navigation: {
          levels: [...program.navigation.levels],
          model: program.navigation.model,
        },
        providerHomeCountry: program.provider.homeCountry,
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

    updated += await deleteOmittedCatalogPrograms(ctx, {
      incomingKeys: new Set(programs.map((program) => program.key)),
      omittedAt: args.syncedAt,
    });

    return { created, skipped: 0, updated };
  },
});

/** Continues bounded omitted-program dependency cleanup after a catalog sync. */
export const continueOmittedProgramDelete = internalMutation({
  args: {
    omittedAt: v.number(),
    programId: v.id("learningPrograms"),
  },
  returns: v.object({
    deleted: v.boolean(),
    scheduled: v.boolean(),
  }),
  handler: async (ctx, args) =>
    await deleteOmittedCatalogProgramBatch(ctx, args),
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
