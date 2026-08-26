import { internalQuery } from "@repo/backend/convex/_generated/server";
import {
  agentContentSourceValidator,
  readAgentContentSource,
} from "@repo/backend/convex/contentRelease/reference/agent";
import { contentReferenceInputValidator } from "@repo/backend/convex/contentRelease/reference/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/** Reads one agent source through a single consistent query transaction. */
export const readAgentContent = internalQuery({
  args: { input: contentReferenceInputValidator },
  returns: agentContentSourceValidator,
  handler: (ctx, { input }) =>
    runConvexProgram(readAgentContentSource(ctx, input)),
});
