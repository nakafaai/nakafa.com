import { query } from "@repo/backend/convex/_generated/server";
import { listTrendingSubjects } from "@repo/backend/convex/contents/trending/impl";
import {
  getTrendingSubjectsArgs,
  getTrendingSubjectsResultValidator,
} from "@repo/backend/convex/contents/trending/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/** Returns current signed materials from the bounded popularity ranking. */
export const getTrendingSubjects = query({
  args: getTrendingSubjectsArgs,
  returns: getTrendingSubjectsResultValidator,
  handler: async (ctx, args) =>
    await runConvexProgram(listTrendingSubjects(ctx, args)),
});
