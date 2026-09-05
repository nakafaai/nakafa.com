import { convexPublicationLayer } from "@repo/backend/content/publication/convex";
import { readPageCatalog } from "@repo/backend/content/publication/page";
import { query } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";
import { Effect } from "effect";

const pageCatalogValidator = v.object({
  activeReleaseId: v.union(v.string(), v.null()),
  managed: v.boolean(),
  projectionJson: v.array(v.string()),
});

/** Returns every verified locale-equivalent Page projection in one release. */
export const catalog = query({
  args: {},
  returns: pageCatalogValidator,
  handler: (ctx) =>
    runConvexProgram(
      readPageCatalog().pipe(Effect.provide(convexPublicationLayer(ctx)))
    ),
});
