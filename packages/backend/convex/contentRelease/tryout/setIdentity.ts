import { internalMutation } from "@repo/backend/convex/_generated/server";
import { migrateTryoutSetIdentity } from "@repo/backend/convex/contentRelease/tryout/setIdentity/impl";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { v } from "convex/values";

/** Audits or applies the bounded signed try-out set-identity migration. */
export const migrate = internalMutation({
  args: {
    apply: v.boolean(),
    expectedMissing: v.number(),
  },
  returns: v.object({
    candidates: v.number(),
    updated: v.number(),
  }),
  handler: (ctx, input) =>
    runConvexProgram(migrateTryoutSetIdentity(ctx, input)),
});
