import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { listPublishedSets } from "@repo/backend/convex/tryouts/sets/published";
import {
  listArgsValidator,
  statusArgsValidator,
  trackSetPageValidator,
  unattemptedArgsValidator,
} from "@repo/backend/convex/tryouts/sets/spec";

/** Lists signed sets with combined status filtering and stable sorting. */
export const list = query({
  args: listArgsValidator.fields,
  returns: trackSetPageValidator,
  handler: (ctx, args) => runConvexProgram(listPublishedSets(ctx, args)),
});

/** Retained for deployed clients until the catalog rollout observes no readers. */
export const byStatus = query({
  args: statusArgsValidator.fields,
  returns: trackSetPageValidator,
  handler: (ctx, { status, ...args }) =>
    runConvexProgram(
      listPublishedSets(ctx, {
        ...args,
        filter: status,
        sort: { direction: "asc", field: "order" },
      })
    ),
});

/** Retained for deployed clients until the catalog rollout observes no readers. */
export const unattempted = query({
  args: unattemptedArgsValidator.fields,
  returns: trackSetPageValidator,
  handler: (ctx, args) =>
    runConvexProgram(
      listPublishedSets(ctx, {
        ...args,
        filter: "not-started",
        sort: { direction: "asc", field: "order" },
      })
    ),
});
