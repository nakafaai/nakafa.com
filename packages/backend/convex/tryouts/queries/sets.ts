import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { listPublishedSets } from "@repo/backend/convex/tryouts/sets/published";
import {
  listArgsValidator,
  trackSetPageValidator,
} from "@repo/backend/convex/tryouts/sets/spec";

/** Lists signed sets with combined status filtering and stable sorting. */
export const list = query({
  args: listArgsValidator.fields,
  returns: trackSetPageValidator,
  handler: (ctx, args) => runConvexProgram(listPublishedSets(ctx, args)),
});
