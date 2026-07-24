import { internalQuery } from "@repo/backend/convex/_generated/server";
import { runConvexProgram } from "@repo/backend/convex/lib/effect";
import { readTryoutContent } from "@repo/backend/convex/tryouts/content/impl";
import {
  tryoutContentReadArgsValidator,
  tryoutContentReadResultValidator,
} from "@repo/backend/convex/tryouts/content/spec";

/** Reads frozen artifacts for one server-authenticated attempt route. */
export const read = internalQuery({
  args: tryoutContentReadArgsValidator,
  returns: tryoutContentReadResultValidator,
  handler: (ctx, args) => runConvexProgram(readTryoutContent(ctx, args)),
});
