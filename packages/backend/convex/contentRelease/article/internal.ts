import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  agentArticleTaxonomyValidator,
  readAgentArticleTaxonomy,
} from "@repo/backend/convex/contentRelease/article/agent";
import { appLocaleValidator } from "@repo/backend/convex/contentRelease/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/** Reads agent taxonomy through one bounded, consistent query transaction. */
export const readAgentTaxonomy = internalQuery({
  args: { appLocale: appLocaleValidator },
  returns: agentArticleTaxonomyValidator,
  handler: (ctx, { appLocale }) =>
    runConvexProgram(readAgentArticleTaxonomy(ctx, appLocale)),
});
