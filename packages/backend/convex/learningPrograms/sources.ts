import type { Id } from "@repo/backend/convex/_generated/dataModel";
import type { MutationCtx } from "@repo/backend/convex/_generated/server";
import type { programSourceInputValidator } from "@repo/backend/convex/learningPrograms/schema";
import { ConvexError, type Infer } from "convex/values";

const SOURCE_LIMIT = 20;
type ProgramSourceInput = Infer<typeof programSourceInputValidator>;

/** Replaces bounded official-source rows for one learning program catalog row. */
export async function syncProgramSources(
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
