import { internalMutation } from "@repo/backend/convex/_generated/server";
import { migrateMaterialCatalog } from "@repo/backend/convex/contentRelease/material/migration/impl";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

/** Temporarily migrates authenticated pre-cutover material catalog rows. */
export const migrate = internalMutation({
  args: {
    apply: v.boolean(),
    expectedMissing: v.number(),
  },
  returns: v.object({
    candidates: v.number(),
    updated: v.number(),
  }),
  handler: (ctx, input) => runConvexProgram(migrateMaterialCatalog(ctx, input)),
});
