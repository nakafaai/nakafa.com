import { query } from "@repo/backend/convex/_generated/server";
import { readContentReference } from "@repo/backend/convex/contentRelease/reference/read";
import {
  contentReferenceInputValidator,
  contentReferenceReturnValidator,
} from "@repo/backend/convex/contentRelease/reference/spec";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";

/** Resolves one current public identity across active signed content families. */
export const read = query({
  args: { input: contentReferenceInputValidator },
  returns: contentReferenceReturnValidator,
  handler: (ctx, { input }) =>
    runConvexProgram(readContentReference(ctx, input)),
});
